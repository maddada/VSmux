import { useEffect, useRef } from "react";
import { FitAddon, Ghostty, Terminal } from "ghostty-web";
import ghosttyWasmUrl from "ghostty-web/ghostty-vt.wasm?url";
import type {
  WorkspacePanelConnection,
  WorkspacePanelTerminalAppearance,
  WorkspacePanelTerminalPane,
} from "../shared/workspace-panel-contract";
import type {
  TerminalResizeMessage,
  TerminalStateMessage,
} from "../shared/terminal-host-protocol";
import { logWorkspaceDebug } from "./workspace-debug";
import { getTerminalTheme } from "./terminal-theme";
import "./terminal-pane.css";

const DATA_BUFFER_FLUSH_MS = 5;
const GHOSTTY_SCROLLBAR_GUTTER_PX = 15;
const GHOSTTY_SCROLLBAR_TRACK_WIDTH_PX = 8;
const GHOSTTY_SCROLLBAR_VERTICAL_INSET_PX = 4;

type GhosttySelectionManager = {
  copyToClipboard?: (text: string) => void;
};

type GhosttyLineCell = {
  hyperlink_id?: number;
  width: number;
};

type GhosttyLinkRange = {
  endY: number;
  startY: number;
};

type GhosttyCursor = {
  visible: boolean;
  x: number;
  y: number;
};

type GhosttyDimensions = {
  cols: number;
  rows: number;
};

type GhosttyBufferLike = {
  clearDirty: () => void;
  getCursor: () => GhosttyCursor;
  getDimensions: () => GhosttyDimensions;
  getLine: (row: number) => GhosttyLineCell[] | null;
  isRowDirty: (row: number) => boolean;
  needsFullRedraw?: () => boolean;
};

type GhosttyRendererLike = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cursorBlink?: boolean;
  currentBuffer?: GhosttyBufferLike;
  currentSelectionCoords?: unknown;
  devicePixelRatio: number;
  getCanvas: () => HTMLCanvasElement;
  hoveredHyperlinkId: number;
  hoveredLinkRange?: GhosttyLinkRange | null;
  isInSelection: (col: number, row: number) => boolean;
  lastCursorPosition: { x: number; y: number };
  lastViewportY: number;
  metrics: { height: number; width: number };
  previousHoveredHyperlinkId: number;
  previousHoveredLinkRange?: GhosttyLinkRange | null;
  render: (
    buffer: GhosttyBufferLike,
    fullRedraw?: boolean,
    viewportY?: number,
    terminal?: GhosttyTerminalWithSelectionManager,
    scrollbarOpacity?: number,
  ) => void;
  renderCellBackground: (cell: GhosttyLineCell, col: number, row: number) => void;
  renderCellText: (cell: GhosttyLineCell, col: number, row: number) => void;
  renderCursor: (x: number, y: number) => void;
  renderLine: (line: GhosttyLineCell[], row: number, cols: number) => void;
  renderScrollbar: (viewportY: number, scrollbackLength: number, rows: number, opacity?: number) => void;
  resize: (cols: number, rows: number) => void;
  selectionManager?: {
    clearDirtySelectionRows: () => void;
    getDirtySelectionRows: () => Set<number>;
    getSelectionCoords: () => unknown;
    hasSelection: () => boolean;
  };
  theme: {
    background: string;
    selectionBackground?: string;
  };
};

type GhosttyTerminalWithSelectionManager = Terminal & {
  __vsmuxScrollbarLayoutPatched?: boolean;
  canvas?: HTMLCanvasElement;
  copySelection: () => boolean;
  getSelection: () => string;
  hasSelection: () => boolean;
  handleFontChange?: () => void;
  handleMouseDown?: (event: MouseEvent) => void;
  inputHandler?: unknown;
  isDraggingScrollbar?: boolean;
  renderer?: GhosttyRendererLike;
  rows: number;
  scrollbarDragStart?: number | null;
  scrollbarDragStartViewportY?: number;
  selectionManager?: GhosttySelectionManager;
  showScrollbar?: () => void;
  scrollToLine: (line: number) => void;
  textarea?: HTMLTextAreaElement;
  viewportY: number;
  wasmTerm?: {
    getDimensions: () => GhosttyDimensions;
    getLine: (row: number) => GhosttyLineCell[] | null;
    getScrollbackLength: () => number;
    getScrollbackLine: (row: number) => GhosttyLineCell[] | null;
    isRowDirty: (row: number) => boolean;
    needsFullRedraw?: () => boolean;
  };
  writeInternal?: (data: string | Uint8Array, callback?: () => void) => void;
};

let ghosttyReadyPromise: Promise<Ghostty> | undefined;

function ensureGhosttyReady(): Promise<Ghostty> {
  ghosttyReadyPromise ??= Ghostty.load(ghosttyWasmUrl);
  return ghosttyReadyPromise;
}

function copyTextToClipboard(text: string): boolean {
  if (!text) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => {
      fallbackCopyText(text);
    });
    return true;
  }

  return fallbackCopyText(text);
}

function fallbackCopyText(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function disableGhosttySelectionAutoCopy(terminal: Terminal): void {
  const ghosttyTerminal = terminal as GhosttyTerminalWithSelectionManager;
  const selectionManager = ghosttyTerminal.selectionManager;
  if (!selectionManager?.copyToClipboard) {
    return;
  }

  selectionManager.copyToClipboard = () => {};

  ghosttyTerminal.copySelection = () => {
    if (!ghosttyTerminal.hasSelection()) {
      return false;
    }

    const text = ghosttyTerminal.getSelection();
    if (!text) {
      return false;
    }

    copyTextToClipboard(text);
    return true;
  };
}

function disableGhosttyScrollFollowWhileScrolledUp(terminal: Terminal): void {
  const ghosttyTerminal = terminal as GhosttyTerminalWithSelectionManager;
  const originalWriteInternal = ghosttyTerminal.writeInternal?.bind(ghosttyTerminal);
  if (!originalWriteInternal) {
    return;
  }

  ghosttyTerminal.writeInternal = (data: string | Uint8Array, callback?: () => void) => {
    if (ghosttyTerminal.getViewportY() === 0) {
      originalWriteInternal(data, callback);
      return;
    }

    const originalScrollToBottom = ghosttyTerminal.scrollToBottom.bind(ghosttyTerminal);
    ghosttyTerminal.scrollToBottom = () => {};
    try {
      originalWriteInternal(data, callback);
    } finally {
      ghosttyTerminal.scrollToBottom = originalScrollToBottom;
    }
  };
}

function resizeGhosttyCanvasWithScrollbarGutter(
  renderer: GhosttyRendererLike,
  cols: number,
  rows: number,
): void {
  const textWidth = cols * renderer.metrics.width;
  const height = rows * renderer.metrics.height;
  const canvasWidth = textWidth + GHOSTTY_SCROLLBAR_GUTTER_PX;

  renderer.canvas.style.width = `${canvasWidth}px`;
  renderer.canvas.style.height = `${height}px`;
  renderer.canvas.width = Math.max(1, Math.round(canvasWidth * renderer.devicePixelRatio));
  renderer.canvas.height = Math.max(1, Math.round(height * renderer.devicePixelRatio));
  renderer.ctx.setTransform(renderer.devicePixelRatio, 0, 0, renderer.devicePixelRatio, 0, 0);
  renderer.ctx.textBaseline = "alphabetic";
  renderer.ctx.textAlign = "left";
  renderer.ctx.fillStyle = renderer.theme.background;
  renderer.ctx.fillRect(0, 0, canvasWidth, height);
}

function renderGhosttyScrollbarAtPaneEdge(
  renderer: GhosttyRendererLike,
  viewportY: number,
  scrollbackLength: number,
  rows: number,
  opacity = 1,
): void {
  const canvasHeight = renderer.canvas.height / renderer.devicePixelRatio;
  const canvasWidth = renderer.canvas.width / renderer.devicePixelRatio;
  const trackX = canvasWidth - GHOSTTY_SCROLLBAR_TRACK_WIDTH_PX;
  const usableHeight = canvasHeight - GHOSTTY_SCROLLBAR_VERTICAL_INSET_PX * 2;

  renderer.ctx.fillStyle = renderer.theme.background;
  renderer.ctx.fillRect(trackX - 2, 0, GHOSTTY_SCROLLBAR_TRACK_WIDTH_PX + 2, canvasHeight);

  if (opacity <= 0 || scrollbackLength === 0) {
    return;
  }

  const totalRows = scrollbackLength + rows;
  const thumbHeight = Math.max(20, (rows / totalRows) * usableHeight);
  const scrollRatio = viewportY / scrollbackLength;
  const thumbTop =
    GHOSTTY_SCROLLBAR_VERTICAL_INSET_PX + (usableHeight - thumbHeight) * (1 - scrollRatio);

  renderer.ctx.fillStyle = `rgba(128, 128, 128, ${0.1 * opacity})`;
  renderer.ctx.fillRect(
    trackX,
    GHOSTTY_SCROLLBAR_VERTICAL_INSET_PX,
    GHOSTTY_SCROLLBAR_TRACK_WIDTH_PX,
    usableHeight,
  );

  const thumbAlpha = viewportY > 0 ? 0.5 : 0.3;
  renderer.ctx.fillStyle = `rgba(128, 128, 128, ${thumbAlpha * opacity})`;
  renderer.ctx.fillRect(trackX, thumbTop, GHOSTTY_SCROLLBAR_TRACK_WIDTH_PX, thumbHeight);
}

function applyGhosttyScrollbarLayoutPatch(terminal: Terminal): void {
  const ghosttyTerminal = terminal as GhosttyTerminalWithSelectionManager;
  if (ghosttyTerminal.__vsmuxScrollbarLayoutPatched) {
    return;
  }

  const renderer = ghosttyTerminal.renderer;
  if (!renderer) {
    return;
  }

  ghosttyTerminal.__vsmuxScrollbarLayoutPatched = true;

  const originalResize = renderer.resize.bind(renderer);
  renderer.resize = (cols: number, rows: number) => {
    originalResize(cols, rows);
    resizeGhosttyCanvasWithScrollbarGutter(renderer, cols, rows);
  };

  renderer.renderScrollbar = (
    viewportY: number,
    scrollbackLength: number,
    rows: number,
    opacity = 1,
  ) => {
    renderGhosttyScrollbarAtPaneEdge(renderer, viewportY, scrollbackLength, rows, opacity);
  };

  renderer.render = (
    buffer: GhosttyBufferLike,
    fullRedraw = false,
    viewportY = 0,
    terminalInstance?: GhosttyTerminalWithSelectionManager,
    scrollbarOpacity = 1,
  ) => {
    renderer.currentBuffer = buffer;

    const cursor = buffer.getCursor();
    const dimensions = buffer.getDimensions();
    const scrollbackLength = terminalInstance?.wasmTerm?.getScrollbackLength() ?? 0;
    const expectedWidth =
      (dimensions.cols * renderer.metrics.width + GHOSTTY_SCROLLBAR_GUTTER_PX) *
      renderer.devicePixelRatio;
    const expectedHeight = dimensions.rows * renderer.metrics.height * renderer.devicePixelRatio;

    if (buffer.needsFullRedraw?.()) {
      fullRedraw = true;
    }
    if (
      renderer.canvas.width !== expectedWidth ||
      renderer.canvas.height !== expectedHeight
    ) {
      renderer.resize(dimensions.cols, dimensions.rows);
      fullRedraw = true;
    }
    if (viewportY !== renderer.lastViewportY) {
      fullRedraw = true;
      renderer.lastViewportY = viewportY;
    }

    const cursorMoved =
      cursor.x !== renderer.lastCursorPosition.x || cursor.y !== renderer.lastCursorPosition.y;
    if (cursorMoved || renderer.cursorBlink) {
      if (!fullRedraw && !buffer.isRowDirty(cursor.y)) {
        const currentCursorLine = buffer.getLine(cursor.y);
        if (currentCursorLine) {
          renderer.renderLine(currentCursorLine, cursor.y, dimensions.cols);
        }
      }
      if (
        cursorMoved &&
        renderer.lastCursorPosition.y !== cursor.y &&
        !fullRedraw &&
        !buffer.isRowDirty(renderer.lastCursorPosition.y)
      ) {
        const previousCursorLine = buffer.getLine(renderer.lastCursorPosition.y);
        if (previousCursorLine) {
          renderer.renderLine(previousCursorLine, renderer.lastCursorPosition.y, dimensions.cols);
        }
      }
    }

    const hasSelection = renderer.selectionManager?.hasSelection() ?? false;
    const selectionDirtyRows = new Set<number>();
    renderer.currentSelectionCoords = hasSelection
      ? renderer.selectionManager?.getSelectionCoords() ?? null
      : null;
    const selectionCoords = renderer.currentSelectionCoords as
      | { endRow: number; startRow: number }
      | null;
    if (selectionCoords) {
      for (let row = selectionCoords.startRow; row <= selectionCoords.endRow; row += 1) {
        selectionDirtyRows.add(row);
      }
    }
    if (renderer.selectionManager) {
      const dirtyRows = renderer.selectionManager.getDirtySelectionRows();
      if (dirtyRows.size > 0) {
        for (const row of dirtyRows) {
          selectionDirtyRows.add(row);
        }
        renderer.selectionManager.clearDirtySelectionRows();
      }
    }

    const hyperlinkDirtyRows = new Set<number>();
    const hyperlinkIdChanged =
      renderer.hoveredHyperlinkId !== renderer.previousHoveredHyperlinkId;
    const hyperlinkRangeChanged =
      JSON.stringify(renderer.hoveredLinkRange ?? null) !==
      JSON.stringify(renderer.previousHoveredLinkRange ?? null);

    if (hyperlinkIdChanged) {
      for (let row = 0; row < dimensions.rows; row += 1) {
        let line: GhosttyLineCell[] | null = null;
        if (viewportY > 0) {
          if (row < viewportY && terminalInstance?.wasmTerm) {
            const scrollbackRow = scrollbackLength - Math.floor(viewportY) + row;
            line = terminalInstance.wasmTerm.getScrollbackLine(scrollbackRow);
          } else {
            const bufferRow = row - Math.floor(viewportY);
            line = buffer.getLine(bufferRow);
          }
        } else {
          line = buffer.getLine(row);
        }
        if (
          line?.some(
            (cell) =>
              cell.hyperlink_id === renderer.hoveredHyperlinkId ||
              cell.hyperlink_id === renderer.previousHoveredHyperlinkId,
          )
        ) {
          hyperlinkDirtyRows.add(row);
        }
      }
      renderer.previousHoveredHyperlinkId = renderer.hoveredHyperlinkId;
    }

    if (hyperlinkRangeChanged) {
      if (renderer.previousHoveredLinkRange) {
        for (
          let row = renderer.previousHoveredLinkRange.startY;
          row <= renderer.previousHoveredLinkRange.endY;
          row += 1
        ) {
          hyperlinkDirtyRows.add(row);
        }
      }
      if (renderer.hoveredLinkRange) {
        for (
          let row = renderer.hoveredLinkRange.startY;
          row <= renderer.hoveredLinkRange.endY;
          row += 1
        ) {
          hyperlinkDirtyRows.add(row);
        }
      }
      renderer.previousHoveredLinkRange = renderer.hoveredLinkRange;
    }

    const rowsToRender = new Set<number>();
    for (let row = 0; row < dimensions.rows; row += 1) {
      const shouldRender =
        viewportY > 0 ||
        fullRedraw ||
        buffer.isRowDirty(row) ||
        selectionDirtyRows.has(row) ||
        hyperlinkDirtyRows.has(row);
      if (!shouldRender) {
        continue;
      }

      rowsToRender.add(row);
      if (row > 0) {
        rowsToRender.add(row - 1);
      }
      if (row < dimensions.rows - 1) {
        rowsToRender.add(row + 1);
      }
    }

    for (let row = 0; row < dimensions.rows; row += 1) {
      if (!rowsToRender.has(row)) {
        continue;
      }

      let line: GhosttyLineCell[] | null = null;
      if (viewportY > 0) {
        if (row < viewportY && terminalInstance?.wasmTerm) {
          const scrollbackRow = scrollbackLength - Math.floor(viewportY) + row;
          line = terminalInstance.wasmTerm.getScrollbackLine(scrollbackRow);
        } else {
          const bufferRow = row - Math.floor(viewportY);
          line = buffer.getLine(bufferRow);
        }
      } else {
        line = buffer.getLine(row);
      }

      if (line) {
        renderer.renderLine(line, row, dimensions.cols);
      }
    }

    if (viewportY === 0 && cursor.visible) {
      renderer.renderCursor(cursor.x, cursor.y);
    }
    if (terminalInstance && scrollbarOpacity > 0) {
      renderer.renderScrollbar(viewportY, scrollbackLength, dimensions.rows, scrollbarOpacity);
    }

    renderer.lastCursorPosition = { x: cursor.x, y: cursor.y };
    buffer.clearDirty();
  };

  ghosttyTerminal.handleFontChange = () => {
    if (!ghosttyTerminal.renderer || !ghosttyTerminal.wasmTerm || !ghosttyTerminal.canvas) {
      return;
    }

    ghosttyTerminal.renderer.selectionManager?.clearDirtySelectionRows();
    ghosttyTerminal.renderer.resize(ghosttyTerminal.cols, ghosttyTerminal.rows);
    ghosttyTerminal.renderer.render(
      ghosttyTerminal.wasmTerm,
      true,
      ghosttyTerminal.viewportY,
      ghosttyTerminal,
    );
  };

  ghosttyTerminal.handleMouseDown = (event: MouseEvent) => {
    if (!ghosttyTerminal.canvas || !ghosttyTerminal.renderer || !ghosttyTerminal.wasmTerm) {
      return;
    }

    const scrollbackLength = ghosttyTerminal.wasmTerm.getScrollbackLength();
    if (scrollbackLength === 0) {
      return;
    }

    const rect = ghosttyTerminal.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const gutterLeft = rect.width - GHOSTTY_SCROLLBAR_GUTTER_PX;

    if (mouseX < gutterLeft || mouseX > rect.width) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const usableHeight = rect.height - GHOSTTY_SCROLLBAR_VERTICAL_INSET_PX * 2;
    const totalRows = scrollbackLength + ghosttyTerminal.rows;
    const thumbHeight = Math.max(20, (ghosttyTerminal.rows / totalRows) * usableHeight);
    const scrollRatio = ghosttyTerminal.viewportY / scrollbackLength;
    const thumbTop =
      GHOSTTY_SCROLLBAR_VERTICAL_INSET_PX + (usableHeight - thumbHeight) * (1 - scrollRatio);

    if (mouseY >= thumbTop && mouseY <= thumbTop + thumbHeight) {
      ghosttyTerminal.isDraggingScrollbar = true;
      ghosttyTerminal.scrollbarDragStart = mouseY;
      ghosttyTerminal.scrollbarDragStartViewportY = ghosttyTerminal.viewportY;
      ghosttyTerminal.canvas.style.userSelect = "none";
      ghosttyTerminal.canvas.style.webkitUserSelect = "none";
      return;
    }

    const clickRatio =
      1 - (mouseY - GHOSTTY_SCROLLBAR_VERTICAL_INSET_PX) / Math.max(1, usableHeight);
    const scrollTarget = Math.round(clickRatio * scrollbackLength);
    ghosttyTerminal.scrollToLine(Math.max(0, Math.min(scrollbackLength, scrollTarget)));
  };
}

function focusTerminalInput(terminal: Terminal | null | undefined): void {
  terminal?.focus();
}

export type TerminalPaneProps = {
  connection: WorkspacePanelConnection;
  debuggingMode: boolean;
  onActivate: () => void;
  pane: WorkspacePanelTerminalPane;
  terminalAppearance: WorkspacePanelTerminalAppearance;
};

export const TerminalPane: React.FC<TerminalPaneProps> = ({
  connection,
  debuggingMode,
  onActivate,
  pane,
  terminalAppearance,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lastMeasuredSizeRef = useRef<{ height: number; width: number }>();
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let didDispose = false;
    let websocket: WebSocket | undefined;
    let didApplyHistory = false;
    let dataBuffer: string[] = [];
    let flushTimer: number | undefined;
    let pendingSocketMessages: string[] = [];
    let rafId = 0;
    let terminal: Terminal | undefined;
    let fit: FitAddon | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let cleanupWindowFocus: (() => void) | undefined;

    const sendSocketMessage = (message: string) => {
      if (!websocket) {
        pendingSocketMessages.push(message);
        return;
      }

      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(message);
        return;
      }

      if (websocket.readyState === WebSocket.CONNECTING) {
        pendingSocketMessages.push(message);
      }
    };

    const connectWebsocket = () => {
      if (connection.mock || websocket || didDispose || !terminal) {
        return;
      }

      const socketUrl = new URL("/session", connection.baseUrl);
      socketUrl.searchParams.set("token", connection.token);
      socketUrl.searchParams.set("sessionId", pane.sessionId);
      socketUrl.searchParams.set("cols", String(terminal.cols));
      socketUrl.searchParams.set("rows", String(terminal.rows));

      websocket = new WebSocket(socketUrl.toString());
      websocket.onmessage = (event) => {
        if (typeof event.data !== "string") {
          return;
        }

        if (event.data.startsWith("{")) {
          const message = JSON.parse(event.data) as TerminalStateMessage;
          handleTerminalStateMessage(message);
          return;
        }

        dataBuffer.push(event.data);
        if (flushTimer === undefined) {
          flushTimer = window.setTimeout(flushData, DATA_BUFFER_FLUSH_MS);
        }
      };
      websocket.onopen = () => {
        logWorkspaceDebug(debuggingMode, "terminal.socketOpen", {
          cols: terminal.cols,
          rows: terminal.rows,
          sessionId: pane.sessionId,
        });
        for (const message of pendingSocketMessages) {
          websocket?.send(message);
        }
        pendingSocketMessages = [];
      };
      websocket.onclose = () => {
        logWorkspaceDebug(debuggingMode, "terminal.socketClose", {
          sessionId: pane.sessionId,
        });
        pendingSocketMessages = [];
      };
      websocket.onerror = () => {
        logWorkspaceDebug(debuggingMode, "terminal.socketError", {
          sessionId: pane.sessionId,
        });
        pendingSocketMessages = [];
      };
    };

    const flushData = () => {
      const chunk = dataBuffer.join("");
      dataBuffer = [];
      flushTimer = undefined;
      if (!chunk || !terminal) {
        return;
      }

      terminal.write(chunk);
    };

    const handleTerminalStateMessage = (message: TerminalStateMessage) => {
      if (message.type !== "terminalSessionState") {
        return;
      }

      if (!didApplyHistory) {
        didApplyHistory = true;
        if (message.session.history && terminal) {
          logWorkspaceDebug(debuggingMode, "terminal.applyHistory", {
            historyLength: message.session.history.length,
            sessionId: pane.sessionId,
          });
          terminal.write(message.session.history);
        }
      }
    };

    if (connection.mock) {
      logWorkspaceDebug(debuggingMode, "terminal.mockConnected", {
        sessionId: pane.sessionId,
      });
    }

    void ensureGhosttyReady().then((ghostty) => {
      if (didDispose || !containerRef.current) {
        return;
      }

      terminal = new Terminal({
        ghostty,
        theme: getTerminalTheme(),
        cursorBlink: terminalAppearance.cursorBlink,
        cursorStyle: terminalAppearance.cursorStyle,
        fontFamily: terminalAppearance.fontFamily,
        fontSize: terminalAppearance.fontSize,
        scrollback: 200_000,
      });
      terminalRef.current = terminal;

      fit = new FitAddon();
      fitRef.current = fit;
      terminal.loadAddon(fit);
      terminal.open(containerRef.current);
      applyGhosttyScrollbarLayoutPatch(terminal);
      disableGhosttySelectionAutoCopy(terminal);
      disableGhosttyScrollFollowWhileScrolledUp(terminal);

      if (document.hasFocus()) {
        focusTerminalInput(terminal);
      }

      const onWindowFocus = () => {
        focusTerminalInput(terminal);
      };
      window.addEventListener("focus", onWindowFocus);
      cleanupWindowFocus = () => {
        window.removeEventListener("focus", onWindowFocus);
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (didDispose || !terminal || !fit) {
            return;
          }

          logWorkspaceDebug(debuggingMode, "terminal.initialFit", {
            cols: terminal.cols,
            sessionId: pane.sessionId,
          });
          fit.fit();
          lastMeasuredSizeRef.current = {
            height: Math.round(containerRef.current?.getBoundingClientRect().height ?? 0),
            width: Math.round(containerRef.current?.getBoundingClientRect().width ?? 0),
          };
          connectWebsocket();
        });
      });

      terminal.attachCustomKeyEventHandler((event) => {
        if (event.key === "Enter" && event.shiftKey) {
          if (event.type === "keydown") {
            sendSocketMessage("\x1b[13;2u");
          }
          return true;
        }

        if (event.type === "keydown" && event.metaKey) {
          if (event.key === "t" || (event.key >= "1" && event.key <= "9")) {
            return true;
          }
        }

        return false;
      });

      terminal.onData((data) => {
        sendSocketMessage(data);
      });

      terminal.onResize(({ cols, rows }) => {
        const resizeMessage: TerminalResizeMessage = {
          cols,
          rows,
          sessionId: pane.sessionId,
          type: "terminalResize",
        };
        sendSocketMessage(JSON.stringify(resizeMessage));
      });

      if (connection.mock && pane.snapshot?.history) {
        handleTerminalStateMessage({
          session: pane.snapshot,
          type: "terminalSessionState",
        });
      }

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        const { height, width } = entry.contentRect;
        if (width > 0 && height > 0) {
          const nextMeasuredSize = {
            height: Math.round(height),
            width: Math.round(width),
          };
          const previousMeasuredSize = lastMeasuredSizeRef.current;
          if (
            previousMeasuredSize &&
            previousMeasuredSize.width === nextMeasuredSize.width &&
            previousMeasuredSize.height === nextMeasuredSize.height
          ) {
            return;
          }

          lastMeasuredSizeRef.current = nextMeasuredSize;
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            if (!fit) {
              return;
            }

            logWorkspaceDebug(debuggingMode, "terminal.resizeObserverFit", {
              height: nextMeasuredSize.height,
              sessionId: pane.sessionId,
              width: nextMeasuredSize.width,
            });
            fit.fit();
          });
        }
      });
      resizeObserver.observe(containerRef.current);
    });

    const onThemeChange = () => {
      if (!terminal) {
        return;
      }

      terminal.options.theme = getTerminalTheme();
    };
    const themeObserver = new MutationObserver(() => {
      onThemeChange();
    });
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["class", "data-vscode-theme-id", "style"],
      attributes: true,
    });
    if (document.body) {
      themeObserver.observe(document.body, {
        attributeFilter: ["class", "data-vscode-theme-id", "style"],
        attributes: true,
      });
    }

    return () => {
      didDispose = true;
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
        flushData();
      }
      cancelAnimationFrame(rafId);
      cleanupWindowFocus?.();
      resizeObserver?.disconnect();
      themeObserver.disconnect();
      websocket?.close();
      terminal?.dispose();
      lastMeasuredSizeRef.current = undefined;
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [
    connection.baseUrl,
    connection.token,
    pane.sessionId,
    debuggingMode,
    terminalAppearance.cursorBlink,
    terminalAppearance.cursorStyle,
    terminalAppearance.fontFamily,
    terminalAppearance.fontSize,
  ]);

  return (
    <div
      className="terminal-pane-root"
      onMouseDown={(event) => {
        event.stopPropagation();
        logWorkspaceDebug(debuggingMode, "terminal.mouseActivate", {
          sessionId: pane.sessionId,
        });
        onActivate();
        requestAnimationFrame(() => {
          focusTerminalInput(terminalRef.current);
        });
      }}
    >
      <div className="terminal-pane-canvas terminal-tab" ref={containerRef} />
    </div>
  );
};
