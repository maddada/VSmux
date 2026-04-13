import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import WebSocket from "ws";

const HARNESS_PORT = 41738;
const WORKSPACE_ID = "workspace-reconnect-harness";
const SESSION_ID = "reconnect-codex";
const SESSION_ALIAS = "Codex Resume";
const SESSION_DISPLAY_ID = "00";
const SESSION_TITLE = "Codex Resume";
const DEFAULT_RESUME_COMMAND =
  "cd /Users/madda/dev/_active/agent-tiler/ && codex resume 019d5672-af38-7af0-b45c-98ff4fd70c7a";

const CONTENT_TYPE_BY_EXTENSION = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

const repoRoot = process.cwd();
const tmpRoot = path.join(repoRoot, ".tmp", "workspace-reconnect-harness");
const daemonStateDir = path.join(tmpRoot, "daemon");
const sessionStateDir = path.join(tmpRoot, "session-state");
const infoFilePath = path.join(daemonStateDir, "daemon-info.json");
const workspaceOutDir = path.join(repoRoot, "out", "workspace");
const resumeCommand = process.env.VSMUX_RECONNECT_COMMAND?.trim() || DEFAULT_RESUME_COMMAND;

let daemonInfo;
let daemonProcess;
let controlSocket;
let httpServer;
let latestSnapshot;
let requestNumber = 0;
let didPrimeSession = false;
const pendingRequests = new Map();

await rm(tmpRoot, { force: true, recursive: true });
await mkdir(daemonStateDir, { recursive: true });
await mkdir(sessionStateDir, { recursive: true });

try {
  daemonProcess = spawn(
    process.execPath,
    [
      path.join(repoRoot, "out", "extension", "terminal-daemon-process.js"),
      "--state-dir",
      daemonStateDir,
    ],
    {
      stdio: "ignore",
    },
  );

  daemonInfo = await waitForDaemonInfo();
  controlSocket = await openControlSocket(daemonInfo);
  await configureDaemon();
  await primeHarnessSession();
  await startHarnessServer();

  const pageUrl = `http://127.0.0.1:${String(HARNESS_PORT)}/`;
  void pageUrl;
  await waitForExit();
} finally {
  await cleanup();
}

async function waitForDaemonInfo() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const rawInfo = await readFile(infoFilePath, "utf8");
      return JSON.parse(rawInfo);
    } catch {
      await delay(150);
    }
  }

  throw new Error("Timed out waiting for terminal daemon info.");
}

function openControlSocket(info) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `ws://127.0.0.1:${String(info.port)}/control?token=${encodeURIComponent(info.token)}`,
    );

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out connecting to reconnect harness control socket."));
    }, 5_000);

    socket.on("open", () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.on("message", (buffer) => {
      handleControlMessage(buffer.toString());
    });

    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function handleControlMessage(rawMessage) {
  let message;
  try {
    message = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (message.type === "response") {
    const pendingRequest = pendingRequests.get(message.requestId);
    if (!pendingRequest) {
      return;
    }

    pendingRequests.delete(message.requestId);
    if (message.ok) {
      pendingRequest.resolve(message);
    } else {
      pendingRequest.reject(new Error(message.error));
    }
    return;
  }

  if (message.type === "sessionState" && message.session?.sessionId === SESSION_ID) {
    latestSnapshot = message.session;
  }
}

async function configureDaemon() {
  await sendRequest({
    idleShutdownTimeoutMs: null,
    requestId: nextRequestId(),
    type: "configure",
  });
}

async function primeHarnessSession() {
  if (didPrimeSession) {
    return;
  }

  const response = await sendRequest({
    cols: 140,
    cwd: repoRoot,
    requestId: nextRequestId(),
    rows: 42,
    sessionId: SESSION_ID,
    sessionStateFilePath: path.join(sessionStateDir, `${SESSION_ID}.state`),
    shell: process.env.SHELL || "/bin/zsh",
    type: "createOrAttach",
    workspaceId: WORKSPACE_ID,
  });

  latestSnapshot = response.session;
  sendFireAndForget({
    data: `${resumeCommand}\r`,
    sessionId: SESSION_ID,
    type: "write",
    workspaceId: WORKSPACE_ID,
  });
  didPrimeSession = true;
}

function sendFireAndForget(request) {
  controlSocket.send(JSON.stringify(request));
}

function sendRequest(request) {
  return new Promise((resolve, reject) => {
    pendingRequests.set(request.requestId, { reject, resolve });
    controlSocket.send(JSON.stringify(request), (error) => {
      if (!error) {
        return;
      }

      pendingRequests.delete(request.requestId);
      reject(error);
    });
  });
}

async function fetchLatestSessionSnapshot() {
  const response = await sendRequest({
    requestId: nextRequestId(),
    type: "listSessions",
    workspaceId: WORKSPACE_ID,
  });

  const currentSnapshot =
    response.sessions?.find((session) => session.sessionId === SESSION_ID) ?? latestSnapshot;
  latestSnapshot = currentSnapshot;
  return currentSnapshot;
}

async function startHarnessServer() {
  httpServer = createServer(async (request, response) => {
    addNoStoreHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== "GET") {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    const url = new URL(request.url ?? "/", `http://127.0.0.1:${String(HARNESS_PORT)}`);
    if (url.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(getHarnessHtml());
      return;
    }

    if (url.pathname === "/bootstrap") {
      try {
        const sessionSnapshot = await fetchLatestSessionSnapshot();
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(createHydrateMessage(sessionSnapshot)));
      } catch (error) {
        response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        response.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      return;
    }

    if (url.pathname.startsWith("/workspace/")) {
      await serveWorkspaceAsset(url.pathname.replace(/^\/workspace\//u, ""), response);
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(HARNESS_PORT, "127.0.0.1", () => {
      httpServer.off("error", reject);
      resolve();
    });
  });
}

async function serveWorkspaceAsset(relativePath, response) {
  try {
    const normalizedPath = path.posix.normalize(relativePath).replace(/^\/+/u, "");
    const assetPath = path.join(workspaceOutDir, normalizedPath || "index.html");
    const rootWithSeparator = workspaceOutDir.endsWith(path.sep)
      ? workspaceOutDir
      : `${workspaceOutDir}${path.sep}`;
    if (assetPath !== workspaceOutDir && !assetPath.startsWith(rootWithSeparator)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const file = await readFile(assetPath);
    const contentType =
      CONTENT_TYPE_BY_EXTENSION[path.extname(assetPath)] ?? "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

function createHydrateMessage(sessionSnapshot) {
  return {
    activeGroupId: "group-1",
    connection: {
      baseUrl: `ws://127.0.0.1:${String(daemonInfo.port)}`,
      token: daemonInfo.token,
      workspaceId: WORKSPACE_ID,
    },
    debuggingMode: true,
    focusedSessionId: SESSION_ID,
    layoutAppearance: {
      activePaneBorderColor: "rgba(90, 134, 255, 0.95)",
      paneGap: 12,
    },
    panes: [
      {
        isVisible: true,
        kind: "terminal",
        sessionId: SESSION_ID,
        sessionRecord: {
          alias: SESSION_ALIAS,
          column: 0,
          createdAt: sessionSnapshot?.startedAt ?? new Date().toISOString(),
          displayId: SESSION_DISPLAY_ID,
          kind: "terminal",
          row: 0,
          sessionId: SESSION_ID,
          slotIndex: 0,
          title: sessionSnapshot?.title || SESSION_TITLE,
        },
        snapshot: sessionSnapshot,
        terminalTitle: sessionSnapshot?.title || SESSION_TITLE,
      },
    ],
    terminalAppearance: {
      cursorBlink: false,
      cursorStyle: "bar",
      fontFamily: "monospace",
      fontSize: 18,
      letterSpacing: 0,
      lineHeight: 1,
    },
    type: "hydrate",
    viewMode: "vertical",
    visibleCount: 1,
    workspaceSnapshot: {
      activeGroupId: "group-1",
      groups: [
        {
          groupId: "group-1",
          snapshot: {
            focusedSessionId: SESSION_ID,
            fullscreenRestoreVisibleCount: undefined,
            sessions: [
              {
                alias: SESSION_ALIAS,
                column: 0,
                createdAt: sessionSnapshot?.startedAt ?? new Date().toISOString(),
                displayId: SESSION_DISPLAY_ID,
                kind: "terminal",
                row: 0,
                sessionId: SESSION_ID,
                slotIndex: 0,
                title: sessionSnapshot?.title || SESSION_TITLE,
              },
            ],
            viewMode: "vertical",
            visibleCount: 1,
            visibleSessionIds: [SESSION_ID],
          },
          title: "Main",
        },
      ],
      nextGroupNumber: 2,
      nextSessionDisplayId: 1,
      nextSessionNumber: 2,
    },
  };
}

function getHarnessHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Cache-Control" content="no-store" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VSmux Reconnect Harness</title>
    <link href="/workspace/style.css" rel="stylesheet" />
    <style>
      html, body, #root {
        background: #0f1117;
        height: 100%;
        margin: 0;
      }
      .harness-status {
        position: fixed;
        top: 10px;
        right: 12px;
        z-index: 9999;
        background: rgba(12, 14, 20, 0.9);
        color: #cfd8ff;
        border: 1px solid rgba(135, 153, 255, 0.18);
        border-radius: 10px;
        padding: 8px 10px;
        font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <div class="harness-status" id="harness-status">booting…</div>
    <script>
      const statusElement = document.getElementById("harness-status");
      window.__vsmuxHarness = {
        bootstraps: 0,
        lastBootstrapAt: undefined,
      };
      const vscodeApi = {
        postMessage(message) {
          if (message && message.type === "ready") {
            void loadBootstrap();
          }
        },
      };

      function setStatus(text) {
        if (statusElement) {
          statusElement.textContent = text;
        }
      }

      async function loadBootstrap() {
        setStatus("loading bootstrap…");
        const response = await fetch("/bootstrap", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Bootstrap failed with " + String(response.status));
        }

        const message = await response.json();
        window.__vsmuxHarness.bootstraps += 1;
        window.__vsmuxHarness.lastBootstrapAt = Date.now();
        window.postMessage(message, "*");
        setStatus("hydrated at " + new Date().toLocaleTimeString());
      }

      window.acquireVsCodeApi = () => vscodeApi;
      window.addEventListener("error", () => {});
      window.addEventListener("unhandledrejection", () => {});
    </script>
    <script type="module" src="/workspace/workspace.js"></script>
  </body>
</html>`;
}

async function waitForExit() {
  await new Promise((resolve) => {
    const onSignal = () => resolve();
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  });
}

async function cleanup() {
  controlSocket?.close();
  httpServer?.close();
  daemonProcess?.kill("SIGTERM");
  await delay(150);
}

function nextRequestId() {
  requestNumber += 1;
  return `workspace-reconnect-harness-${String(requestNumber)}`;
}

function addNoStoreHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Cache-Control", "no-store");
}

async function delay(durationMs) {
  await new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
