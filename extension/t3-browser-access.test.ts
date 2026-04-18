import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

const mockState = vi.hoisted(() => ({
  asExternalUri: vi.fn(async (uri: { toString(): string }) => uri),
  networkInterfaces: vi.fn(() => ({})),
  spawnSync: vi.fn(() => ({ status: 1, stdout: "" })),
}));

vi.mock("vscode", () => ({
  Uri: {
    parse: (value: string) => ({
      toString: () => value,
    }),
  },
  env: {
    asExternalUri: mockState.asExternalUri,
  },
}));

vi.mock("node:os", () => ({
  networkInterfaces: mockState.networkInterfaces,
}));

vi.mock("node:child_process", () => ({
  spawnSync: mockState.spawnSync,
}));

describe("resolveT3BrowserAccessLink", () => {
  beforeEach(() => {
    vi.resetModules();
    mockState.asExternalUri.mockReset();
    mockState.networkInterfaces.mockReset();
    mockState.spawnSync.mockReset();
    mockState.asExternalUri.mockImplementation(async (uri: { toString(): string }) => uri);
    mockState.networkInterfaces.mockReturnValue({});
    mockState.spawnSync.mockReturnValue({ status: 1, stdout: "" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("should prefer a LAN address over Tailscale for the QR flow", async () => {
    mockState.networkInterfaces.mockReturnValue({
      en0: [
        {
          address: "192.168.1.50",
          family: "IPv4",
          internal: false,
        },
      ],
    });
    mockState.spawnSync.mockReturnValue({
      status: 0,
      stdout: "100.64.0.9\n",
    });

    const { resolveT3BrowserAccessLink } = await import("./t3-browser-access");

    await expect(resolveT3BrowserAccessLink("http://127.0.0.1:45438/t3-share")).resolves.toEqual({
      endpointUrl: "http://192.168.1.50:45438/t3-share",
      localUrl: "http://127.0.0.1:45438/t3-share",
      mode: "local-network",
      note: "This uses your machine's local network address for the simplest same-network phone access. Tailscale is still available if you need cross-network access.",
      tailscaleEnabled: true,
    });
  });

  test("should fall back to Tailscale when no LAN address is available", async () => {
    mockState.spawnSync.mockReturnValue({
      status: 0,
      stdout: "100.64.0.9\n",
    });

    const { resolveT3BrowserAccessLink } = await import("./t3-browser-access");

    await expect(resolveT3BrowserAccessLink("http://127.0.0.1:45438/t3-share")).resolves.toEqual({
      endpointUrl: "http://100.64.0.9:45438/t3-share",
      localUrl: "http://127.0.0.1:45438/t3-share",
      mode: "tailscale",
      note: "This uses your machine's Tailscale address. Open it while your phone is connected to the same Tailnet.",
      tailscaleEnabled: true,
    });
  });

  test("should keep preferring an external VS Code URL when available", async () => {
    mockState.asExternalUri.mockResolvedValue({
      toString: () => "https://example.test/t3-share",
    });
    mockState.networkInterfaces.mockReturnValue({
      en0: [
        {
          address: "192.168.1.50",
          family: "IPv4",
          internal: false,
        },
      ],
    });
    mockState.spawnSync.mockReturnValue({
      status: 0,
      stdout: "100.64.0.9\n",
    });

    const { resolveT3BrowserAccessLink } = await import("./t3-browser-access");

    await expect(resolveT3BrowserAccessLink("http://127.0.0.1:45438/t3-share")).resolves.toEqual({
      endpointUrl: "https://example.test/t3-share",
      localUrl: "http://127.0.0.1:45438/t3-share",
      mode: "external",
      note: "This link is being exposed by VS Code and can be opened outside the editor.",
      tailscaleEnabled: true,
    });
  });
});
