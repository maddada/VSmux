import { useEffect, useRef, useState } from "react";
import { IconArrowBigDownFilled, IconArrowBigUpFilled } from "@tabler/icons-react";
import type {
  WorkspacePanelAcknowledgeSessionAttentionReason,
  WorkspacePanelAutoFocusRequest,
  WorkspacePanelConnection,
  WorkspacePanelTerminalAppearance,
  WorkspacePanelTerminalPane,
} from "../shared/workspace-panel-contract";
import { Search, type SearchMatch, type SearchOptions } from "../shared/wterm-vendor-search";
import { WTerm } from "../shared/wterm-vendor-dom";
import { getWindowsCtrlWordDeleteInputSequence } from "./terminal-input-shortcuts";
import { logWorkspaceDebug } from "./workspace-debug";
import { applyWtermHostAppearance, ensureWtermWebFontsLoaded } from "./wterm-appearance";
import {
  createWorkspaceWtermTransport,
  type WorkspaceWtermTransportController,
} from "./wterm-session-transport";
import "./terminal-pane.css";

const IS_WINDOWS = navigator.platform.toLowerCase().includes("win");
const SEARCH_RESULTS_EMPTY = {
  resultCount: 0,
  resultIndex: -1,
};
const SCROLL_TO_BOTTOM_SHOW_THRESHOLD_PX = 40;

type SearchResultsState = {
  resultCount: number;
  resultIndex: number;
};

type WtermTerminalPaneProps = {
  autoFocusRequest?: WorkspacePanelAutoFocusRequest;
  connection: WorkspacePanelConnection;
  debugLog?: (event: string, payload?: Record<string, unknown>) => void;
  debuggingMode: boolean;
  isFocused: boolean;
  isVisible: boolean;
  onAttentionInteraction: (reason: WorkspacePanelAcknowledgeSessionAttentionReason) => void;
  onTerminalEnter?: () => void;
  onActivate: (source: "focusin" | "pointer") => void;
  pane: WorkspacePanelTerminalPane;
  refreshRequestId: number;
  scrollToBottomRequestId?: number;
  terminalAppearance: WorkspacePanelTerminalAppearance;
};

export const WtermTerminalPane: React.FC<WtermTerminalPaneProps> = ({
  autoFocusRequest,
  connection,
  debugLog,
  debuggingMode,
  isFocused,
  isVisible,
  onAttentionInteraction,
  onTerminalEnter,
  onActivate,
  pane,
  refreshRequestId,
  scrollToBottomRequestId,
  terminalAppearance,
}) => {
  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<WTerm | null>(null);
  const transportRef = useRef<WorkspaceWtermTransportController | null>(null);
  const searchRef = useRef<Search | null>(null);
  const searchMatchesRef = useRef<SearchMatch[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const handledAutoFocusRequestIdRef = useRef<number | undefined>(undefined);
  const handledRefreshRequestIdRef = useRef(refreshRequestId);
  const handledScrollRequestIdRef = useRef<number | undefined>(undefined);
  const debugLogRef = useRef(debugLog);
  const isFocusedRef = useRef(isFocused);
  const isVisibleRef = useRef(isVisible);
  const isInitializingRef = useRef(true);
  const lastFocusActivationAtRef = useRef(0);
  const lastFocusActivationTargetRef = useRef<EventTarget | null>(null);
  const onAttentionInteractionRef = useRef(onAttentionInteraction);
  const onTerminalEnterRef = useRef(onTerminalEnter);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchRegex, setSearchRegex] = useState(false);
  const [searchWholeWord, setSearchWholeWord] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultsState>(SEARCH_RESULTS_EMPTY);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  useEffect(() => {
    debugLogRef.current = debugLog;
  }, [debugLog]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    onAttentionInteractionRef.current = onAttentionInteraction;
  }, [onAttentionInteraction]);

  useEffect(() => {
    onTerminalEnterRef.current = onTerminalEnter;
  }, [onTerminalEnter]);

  const reportDebug = (event: string, payload?: Record<string, unknown>) => {
    const decoratedPayload = {
      renderNonce: pane.renderNonce,
      sessionId: pane.sessionId,
      terminalEngine: pane.sessionRecord.terminalEngine,
      ...payload,
    };
    logWorkspaceDebug(debuggingMode, event, decoratedPayload);
    debugLogRef.current?.(event, decoratedPayload);
  };

  const getSearchOptions = (): SearchOptions => ({
    caseSensitive: searchCaseSensitive,
    regex: searchRegex,
    wholeWord: searchWholeWord,
  });

  const focusTerminal = (reason: string) => {
    const term = termRef.current;
    const host = terminalHostRef.current;
    if (!term || !host) {
      return false;
    }

    if (host.contains(document.activeElement)) {
      reportDebug("wterm.focusSkippedAlreadyWithin", {
        activeElementTag: document.activeElement?.tagName,
        reason,
        sessionId: pane.sessionId,
      });
      return true;
    }

    reportDebug("wterm.focusRequested", {
      activeElementTag: document.activeElement?.tagName,
      reason,
      sessionId: pane.sessionId,
    });
    term.focus();
    return true;
  };

  const updateScrollButtons = () => {
    const host = terminalHostRef.current;
    if (!host) {
      return;
    }

    const remainingBottom = host.scrollHeight - host.clientHeight - host.scrollTop;
    setShowScrollToBottom(remainingBottom > SCROLL_TO_BOTTOM_SHOW_THRESHOLD_PX);
    setShowScrollToTop(host.scrollTop > SCROLL_TO_BOTTOM_SHOW_THRESHOLD_PX);
  };

  const scrollTerminalToBottom = () => {
    const host = terminalHostRef.current;
    if (!host) {
      return false;
    }

    focusTerminal("scroll-to-bottom");
    host.scrollTop = host.scrollHeight;
    updateScrollButtons();
    return true;
  };

  const scrollTerminalToTop = () => {
    const host = terminalHostRef.current;
    if (!host) {
      return false;
    }

    focusTerminal("scroll-to-top");
    host.scrollTop = 0;
    updateScrollButtons();
    return true;
  };

  const focusSearchInput = () => {
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  };

  const closeSearch = () => {
    searchRef.current?.reset();
    searchMatchesRef.current = [];
    setIsSearchOpen(false);
    setSearchResults(SEARCH_RESULTS_EMPTY);
    requestAnimationFrame(() => {
      focusTerminal("close-search");
    });
  };

  const scrollToMatch = (match: SearchMatch) => {
    const host = terminalHostRef.current;
    const bridge = termRef.current?.bridge;
    if (!host || !bridge) {
      return;
    }

    const scrollbackCount = bridge.getScrollbackCount();
    const rowElements = host.querySelectorAll<HTMLElement>(".term-scrollback-row, .term-row");
    const rowIndex = Math.max(0, Math.min(rowElements.length - 1, scrollbackCount + match.row));
    rowElements.item(rowIndex)?.scrollIntoView({ block: "center" });
    updateScrollButtons();
  };

  const updateSearchState = (activeMatch: SearchMatch | null) => {
    const matches = searchMatchesRef.current;
    if (matches.length === 0 || !activeMatch) {
      setSearchResults(
        matches.length === 0
          ? SEARCH_RESULTS_EMPTY
          : {
              resultCount: matches.length,
              resultIndex: 0,
            },
      );
      return;
    }

    const activeIndex = matches.findIndex(
      (match) =>
        match.row === activeMatch.row &&
        match.col === activeMatch.col &&
        match.length === activeMatch.length,
    );

    setSearchResults({
      resultCount: matches.length,
      resultIndex: activeIndex >= 0 ? activeIndex : 0,
    });
  };

  const seekLastMatch = (query: string, options: SearchOptions): SearchMatch | null => {
    const search = searchRef.current;
    if (!search) {
      return null;
    }

    search.reset();
    let lastMatch: SearchMatch | null = null;
    while (true) {
      const nextMatch = search.findNext(query, options);
      if (!nextMatch) {
        break;
      }
      lastMatch = nextMatch;
    }
    return lastMatch;
  };

  const refreshSearch = () => {
    const search = searchRef.current;
    if (!search || !searchQuery) {
      searchMatchesRef.current = [];
      setSearchResults(SEARCH_RESULTS_EMPTY);
      return;
    }

    try {
      const options = getSearchOptions();
      search.reset();
      const matches = search.findAll(searchQuery, options);
      searchMatchesRef.current = matches;
      if (matches.length === 0) {
        setSearchResults(SEARCH_RESULTS_EMPTY);
        return;
      }

      const activeMatch = search.findNext(searchQuery, options) ?? matches[0] ?? null;
      if (activeMatch) {
        scrollToMatch(activeMatch);
      }
      updateSearchState(activeMatch);
    } catch (error) {
      reportDebug("terminal.searchRefreshError", {
        message: error instanceof Error ? error.message : String(error),
        query: searchQuery,
        sessionId: pane.sessionId,
      });
      searchMatchesRef.current = [];
      setSearchResults(SEARCH_RESULTS_EMPTY);
    }
  };

  const moveSearch = (direction: "next" | "previous") => {
    const search = searchRef.current;
    if (!search || !searchQuery) {
      return;
    }

    try {
      const options = getSearchOptions();
      let activeMatch =
        direction === "next"
          ? search.findNext(searchQuery, options)
          : search.findPrevious(searchQuery, options);

      if (!activeMatch) {
        activeMatch =
          direction === "next"
            ? (search.reset(), search.findNext(searchQuery, options))
            : seekLastMatch(searchQuery, options);
      }

      if (!activeMatch) {
        return;
      }

      scrollToMatch(activeMatch);
      updateSearchState(activeMatch);
      focusTerminal(`search-${direction}`);
    } catch (error) {
      reportDebug("terminal.searchMoveError", {
        direction,
        message: error instanceof Error ? error.message : String(error),
        query: searchQuery,
        sessionId: pane.sessionId,
      });
    }
  };

  useEffect(() => {
    const host = terminalHostRef.current;
    if (!host) {
      return;
    }

    let didDispose = false;
    let activeTransport: WorkspaceWtermTransportController | null = null;
    let cleanupScrollListener: (() => void) | undefined;
    let themeObserver: MutationObserver | undefined;

    const initializeTerminal = async () => {
      isInitializingRef.current = true;
      reportDebug("wterm.initRequested", {
        hostClientHeight: host.clientHeight,
        hostClientWidth: host.clientWidth,
        snapshotCols: pane.snapshot?.cols,
        snapshotHistoryBytes: pane.snapshot?.history?.length ?? 0,
        snapshotRows: pane.snapshot?.rows,
        snapshotStatus: pane.snapshot?.status,
      });

      applyWtermHostAppearance(host, terminalAppearance);
      try {
        const { families } = await ensureWtermWebFontsLoaded(terminalAppearance.fontFamily);
        if (families.length > 0) {
          reportDebug("wterm.webFontsLoadSuccess", {
            families,
            fontFamily: terminalAppearance.fontFamily,
            sessionId: pane.sessionId,
          });
        }
      } catch (error) {
        reportDebug("wterm.webFontsLoadError", {
          fontFamily: terminalAppearance.fontFamily,
          message: error instanceof Error ? error.message : String(error),
          sessionId: pane.sessionId,
        });
      }

      const term = new WTerm(host, {
        autoResize: true,
        cols: pane.snapshot?.cols ?? 120,
        cursorBlink: terminalAppearance.cursorBlink,
        onData: (data) => {
          if (data === "\r") {
            onTerminalEnterRef.current?.();
          }
          onAttentionInteractionRef.current("typing");
          transportRef.current?.sendInput(data);
          if (terminalAppearance.scrollToBottomWhenTyping) {
            requestAnimationFrame(() => {
              scrollTerminalToBottom();
            });
          }
        },
        onResize: (cols, rows) => {
          reportDebug("wterm.resizeObserved", {
            cols,
            rows,
            sessionId: pane.sessionId,
          });
          transportRef.current?.updateTerminalSize(cols, rows);
          requestAnimationFrame(() => {
            updateScrollButtons();
          });
        },
        rows: pane.snapshot?.rows ?? 34,
      });

      reportDebug("wterm.initStart", {
        cols: term.cols,
        hostFontFamily: terminalAppearance.fontFamily,
        hostFontSize: terminalAppearance.fontSize,
        hostLineHeight: terminalAppearance.lineHeight,
        rows: term.rows,
        sessionId: pane.sessionId,
      });
      await term.init();
      if (didDispose) {
        term.destroy();
        return;
      }

      termRef.current = term;
      isInitializingRef.current = false;
      searchRef.current = new Search(term);
      reportDebug("wterm.initSucceeded", {
        bridgeCols: term.bridge?.getCols(),
        bridgeRows: term.bridge?.getRows(),
        hostClientHeight: host.clientHeight,
        hostClientWidth: host.clientWidth,
        scrollHeight: host.scrollHeight,
        scrollWidth: host.scrollWidth,
        sessionId: pane.sessionId,
      });

      const transport = createWorkspaceWtermTransport({
        onData: (data) => {
          term.write(data);
          requestAnimationFrame(() => {
            updateScrollButtons();
          });
        },
        onReconnectReplayStart: () => {
          reportDebug("wterm.reconnectReplayStart", {
            sessionId: pane.sessionId,
          });
          term.write("\x1bc");
        },
        reportDebug,
        sessionId: pane.sessionId,
      });

      transportRef.current = transport;
      activeTransport = transport;
      transport.setReconnectEnabled(
        isVisibleRef.current || pane.snapshot?.isAttached === true,
        isVisibleRef.current ? "visible" : "hidden-without-live-attach",
      );
      const socketUrl = buildSessionSocketUrl(connection, pane.sessionId);
      reportDebug("wterm.transportBootstrap", {
        isAttached: pane.snapshot?.isAttached ?? false,
        reconnectEnabled: isVisibleRef.current || pane.snapshot?.isAttached === true,
        sessionId: pane.sessionId,
        socketUrl,
      });
      transport.connect(socketUrl);
      transport.markTerminalReady(term.cols, term.rows);

      cleanupScrollListener = () => {
        host.removeEventListener("scroll", updateScrollButtons);
      };
      host.addEventListener("scroll", updateScrollButtons, { passive: true });
      requestAnimationFrame(() => {
        updateScrollButtons();
        if (isFocusedRef.current) {
          focusTerminal("initial-focus");
        }
      });

      const applyThemeAppearance = () => {
        applyWtermHostAppearance(host, terminalAppearance);
      };
      themeObserver = new MutationObserver(() => {
        applyThemeAppearance();
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
    };

    void initializeTerminal().catch((error) => {
      isInitializingRef.current = false;
      reportDebug("wterm.initFailed", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId: pane.sessionId,
      });
    });

    return () => {
      reportDebug("wterm.dispose", {
        sessionId: pane.sessionId,
      });
      isInitializingRef.current = false;
      didDispose = true;
      cleanupScrollListener?.();
      themeObserver?.disconnect();
      activeTransport?.disconnect();
      if (transportRef.current === activeTransport) {
        transportRef.current = null;
      }
      searchMatchesRef.current = [];
      searchRef.current = null;
      termRef.current?.destroy();
      termRef.current = null;
      if (terminalHostRef.current) {
        terminalHostRef.current.innerHTML = "";
      }
    };
  }, [
    connection.baseUrl,
    connection.token,
    connection.workspaceId,
    pane.sessionId,
    pane.snapshot?.cols,
    pane.snapshot?.isAttached,
    pane.snapshot?.rows,
    pane.renderNonce,
    terminalAppearance.cursorBlink,
    terminalAppearance.cursorStyle,
    terminalAppearance.fontFamily,
    terminalAppearance.fontSize,
    terminalAppearance.fontWeight,
    terminalAppearance.letterSpacing,
    terminalAppearance.lineHeight,
    terminalAppearance.scrollToBottomWhenTyping,
  ]);

  useEffect(() => {
    transportRef.current?.setReconnectEnabled(
      isVisible || pane.snapshot?.isAttached === true,
      isVisible ? "visible" : "hidden-without-live-attach",
    );
  }, [isVisible, pane.snapshot?.isAttached]);

  useEffect(() => {
    if (refreshRequestId === handledRefreshRequestIdRef.current) {
      return;
    }

    handledRefreshRequestIdRef.current = refreshRequestId;
    transportRef.current?.reconnect("manual-refresh");
  }, [refreshRequestId]);

  useEffect(() => {
    if (!scrollToBottomRequestId || scrollToBottomRequestId === handledScrollRequestIdRef.current) {
      return;
    }

    handledScrollRequestIdRef.current = scrollToBottomRequestId;
    scrollTerminalToBottom();
  }, [scrollToBottomRequestId]);

  useEffect(() => {
    if (!autoFocusRequest || autoFocusRequest.sessionId !== pane.sessionId) {
      return;
    }

    if (handledAutoFocusRequestIdRef.current === autoFocusRequest.requestId || !isVisible) {
      return;
    }

    handledAutoFocusRequestIdRef.current = autoFocusRequest.requestId;
    requestAnimationFrame(() => {
      focusTerminal(`auto-focus:${autoFocusRequest.source}`);
    });
  }, [autoFocusRequest, isVisible, pane.sessionId]);

  useEffect(() => {
    if (!isVisible || !isFocused) {
      return;
    }

    requestAnimationFrame(() => {
      focusTerminal("pane-focused");
    });
  }, [isFocused, isVisible]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    focusSearchInput();
  }, [isSearchOpen]);

  useEffect(() => {
    refreshSearch();
  }, [searchCaseSensitive, searchQuery, searchRegex, searchWholeWord]);

  return (
    <div
      className="terminal-pane-root terminal-pane-root-wterm"
      onFocusCapture={(event) => {
        if (isInitializingRef.current) {
          reportDebug("wterm.focusObservedDuringBootstrap", {
            sessionId: pane.sessionId,
            targetTag: event.target instanceof Element ? event.target.tagName : undefined,
          });
          return;
        }

        const now = performance.now();
        const isDuplicateFocus =
          lastFocusActivationTargetRef.current === event.target &&
          now - lastFocusActivationAtRef.current < 250;

        if (isDuplicateFocus) {
          reportDebug("wterm.focusObservedDuplicate", {
            sessionId: pane.sessionId,
            targetTag: event.target instanceof Element ? event.target.tagName : typeof event.target,
          });
          return;
        }

        lastFocusActivationAtRef.current = now;
        lastFocusActivationTargetRef.current = event.target;
        reportDebug("wterm.focusObserved", {
          relatedTargetTag:
            event.relatedTarget instanceof Element ? event.relatedTarget.tagName : undefined,
          sessionId: pane.sessionId,
          targetTag: event.target instanceof Element ? event.target.tagName : undefined,
        });
        onActivate("focusin");
      }}
      onKeyDownCapture={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
          event.preventDefault();
          setIsSearchOpen(true);
          return;
        }

        if (event.key === "Escape" && isSearchOpen) {
          event.preventDefault();
          closeSearch();
          onAttentionInteractionRef.current("escape");
          return;
        }

        if (
          IS_WINDOWS &&
          event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          event.key === "Backspace"
        ) {
          event.preventDefault();
          onAttentionInteractionRef.current("typing");
          const sequence = getWindowsCtrlWordDeleteInputSequence(event.key);
          if (sequence) {
            transportRef.current?.sendInput(sequence);
          }
        }
      }}
      onMouseDownCapture={() => {
        reportDebug("wterm.pointerActivate", {
          sessionId: pane.sessionId,
        });
        onActivate("pointer");
        onAttentionInteractionRef.current("click");
        focusTerminal("mouse-down");
      }}
    >
      <div ref={terminalHostRef} className="terminal-pane-canvas terminal-pane-wterm-host" />
      <button
        className={`terminal-pane-scroll-to-top${
          showScrollToTop ? " terminal-pane-scroll-button-visible" : ""
        }`}
        onClick={() => {
          scrollTerminalToTop();
        }}
        title="Scroll to top"
        type="button"
      >
        <IconArrowBigUpFilled size={16} stroke={1.8} />
      </button>
      <button
        className={`terminal-pane-scroll-to-bottom${
          showScrollToBottom ? " terminal-pane-scroll-button-visible" : ""
        }`}
        onClick={() => {
          scrollTerminalToBottom();
        }}
        title="Scroll to bottom"
        type="button"
      >
        <IconArrowBigDownFilled size={16} stroke={1.8} />
      </button>
      {isSearchOpen ? (
        <div className="terminal-pane-search">
          <input
            ref={searchInputRef}
            className="terminal-pane-search-input"
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            placeholder="Find in terminal"
            type="text"
            value={searchQuery}
          />
          <div className="terminal-pane-search-status">
            {searchResults.resultCount > 0
              ? `${searchResults.resultIndex + 1}/${searchResults.resultCount}`
              : "0/0"}
          </div>
          <button
            className="terminal-pane-search-button"
            onClick={() => {
              moveSearch("previous");
            }}
            type="button"
          >
            Prev
          </button>
          <button
            className="terminal-pane-search-button"
            onClick={() => {
              moveSearch("next");
            }}
            type="button"
          >
            Next
          </button>
          <button
            className={`terminal-pane-search-toggle${
              searchCaseSensitive ? " terminal-pane-search-toggle-active" : ""
            }`}
            onClick={() => {
              setSearchCaseSensitive((current) => !current);
            }}
            type="button"
          >
            Aa
          </button>
          <button
            className={`terminal-pane-search-toggle${
              searchRegex ? " terminal-pane-search-toggle-active" : ""
            }`}
            onClick={() => {
              setSearchRegex((current) => !current);
            }}
            type="button"
          >
            .*
          </button>
          <button
            className={`terminal-pane-search-toggle${
              searchWholeWord ? " terminal-pane-search-toggle-active" : ""
            }`}
            onClick={() => {
              setSearchWholeWord((current) => !current);
            }}
            type="button"
          >
            ab
          </button>
          <button
            className="terminal-pane-search-close"
            onClick={() => {
              closeSearch();
            }}
            type="button"
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
};

function buildSessionSocketUrl(connection: WorkspacePanelConnection, sessionId: string): string {
  const socketUrl = new URL("/session", connection.baseUrl);
  socketUrl.searchParams.set("token", connection.token);
  socketUrl.searchParams.set("workspaceId", connection.workspaceId);
  socketUrl.searchParams.set("sessionId", sessionId);
  return socketUrl.toString();
}
