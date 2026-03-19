import { Tooltip } from "@base-ui/react/tooltip";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  ExtensionToSidebarMessage,
  SidebarHudState,
  SidebarSessionItem,
  SidebarToExtensionMessage,
  TerminalViewMode,
  VisibleSessionCount,
} from "../shared/session-grid-contract";

type WebviewApi = {
  postMessage: (message: SidebarToExtensionMessage) => void;
};

export type SidebarAppProps = {
  vscode: WebviewApi;
};

type SidebarState = {
  hud: SidebarHudState;
  sessions: SidebarSessionItem[];
};

const COUNT_OPTIONS: VisibleSessionCount[] = [1, 2, 3, 4, 6, 9];
const MODE_OPTIONS: { tooltip: string; viewMode: TerminalViewMode }[] = [
  { tooltip: "Vertical", viewMode: "vertical" },
  { tooltip: "Horizontal", viewMode: "horizontal" },
  { tooltip: "Grid", viewMode: "grid" },
];

const INITIAL_STATE: SidebarState = {
  hud: {
    focusedSessionTitle: undefined,
    theme: "dark-modern",
    viewMode: "grid",
    visibleCount: 1,
    visibleSlotLabels: [],
  },
  sessions: [],
};

export function SidebarApp({ vscode }: SidebarAppProps) {
  const [serverState, setServerState] = useState<SidebarState>(INITIAL_STATE);
  const [draftSessionIds, setDraftSessionIds] = useState<string[] | undefined>();
  const requestNewSession = () => {
    vscode.postMessage({ type: "createSession" });
  };
  const handleEmptySpaceDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    requestNewSession();
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToSidebarMessage>) => {
      if (!event.data || (event.data.type !== "hydrate" && event.data.type !== "sessionState")) {
        return;
      }

      startTransition(() => {
        setServerState({
          hud: event.data.hud,
          sessions: event.data.sessions,
        });
        setDraftSessionIds((previousDraft) =>
          reconcileDraftSessionIds(previousDraft, event.data.sessions),
        );
      });
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  useEffect(() => {
    vscode.postMessage({ type: "ready" });
  }, [vscode]);

  useEffect(() => {
    document.body.dataset.sidebarTheme = serverState.hud.theme;

    return () => {
      delete document.body.dataset.sidebarTheme;
    };
  }, [serverState.hud.theme]);

  const syncedSessionIds = useMemo(
    () => serverState.sessions.map((session) => session.sessionId),
    [serverState.sessions],
  );

  const orderedSessionIds = useMemo(() => {
    if (!draftSessionIds) {
      return syncedSessionIds;
    }

    return mergeDraftSessionIds(draftSessionIds, syncedSessionIds);
  }, [draftSessionIds, syncedSessionIds]);

  const orderedSessions = useMemo(() => {
    const sessionById = new Map(
      serverState.sessions.map((session) => [session.sessionId, session] as const),
    );

    return orderedSessionIds
      .map((sessionId) => sessionById.get(sessionId))
      .filter((session): session is SidebarSessionItem => session !== undefined);
  }, [orderedSessionIds, serverState.sessions]);

  const handleDragEnd = (event: {
    canceled?: boolean;
    operation: {
      source: unknown;
    };
  }) => {
    if (event.canceled) {
      return;
    }

    const { source } = event.operation;
    if (!isSortable(source)) {
      return;
    }

    const { index, initialIndex } = source;
    if (index == null || initialIndex === index) {
      return;
    }

    const nextSessionIds = moveSessionId(orderedSessionIds, initialIndex, index);
    startTransition(() => {
      setDraftSessionIds(nextSessionIds);
    });

    vscode.postMessage({
      sessionIds: nextSessionIds,
      type: "syncSessionOrder",
    });
  };

  return (
    <div
      className="stack"
      data-sidebar-theme={serverState.hud.theme}
      onDoubleClick={handleEmptySpaceDoubleClick}
    >
      <section className="card hud" onDoubleClick={handleEmptySpaceDoubleClick}>
        <div className="toolbar-row">
          <div className="toolbar-section">
            <div className="control-label">Sessions Shown</div>
            <div className="button-group">
              {COUNT_OPTIONS.map((visibleCount) => (
                <button
                  key={visibleCount}
                  className="toolbar-button"
                  data-selected={String(serverState.hud.visibleCount === visibleCount)}
                  onClick={() => vscode.postMessage({ type: "setVisibleCount", visibleCount })}
                  type="button"
                >
                  {visibleCount}
                </button>
              ))}
            </div>
          </div>
          <div className="toolbar-section">
            <div className="control-label">Layout</div>
            <Tooltip.Provider delay={200}>
              <div className="toolbar-inline-row">
                <div className="button-group">
                  {MODE_OPTIONS.map((mode) => (
                    <ModeButton
                      key={mode.viewMode}
                      mode={mode}
                      viewMode={serverState.hud.viewMode}
                      visibleCount={serverState.hud.visibleCount}
                      vscode={vscode}
                    />
                  ))}
                </div>
                <div className="button-group button-group-end">
                  <ToolbarActionButton
                    ariaLabel="Open sidebar theme settings"
                    tooltip="Sidebar Settings"
                    onClick={() => vscode.postMessage({ type: "openSettings" })}
                  >
                    <SettingsIcon />
                  </ToolbarActionButton>
                </div>
              </div>
            </Tooltip.Provider>
          </div>
        </div>
        <div className="action-row">
          <button className="primary" onClick={requestNewSession} type="button">
            New Session
          </button>
        </div>
      </section>
      <section className="card" onDoubleClick={handleEmptySpaceDoubleClick}>
        <div className="eyebrow">Sessions</div>
        <div className="sessions" onDoubleClick={handleEmptySpaceDoubleClick}>
          <DragDropProvider onDragEnd={handleDragEnd}>
            {orderedSessions.map((session, index) => (
              <SortableSessionCard
                key={session.sessionId}
                index={index}
                session={session}
                vscode={vscode}
              />
            ))}
          </DragDropProvider>
        </div>
        {orderedSessions.length === 0 ? (
          <div className="empty">Create the first session to start the workspace.</div>
        ) : null}
      </section>
    </div>
  );
}

type ToolbarActionButtonProps = {
  ariaLabel: string;
  children: React.ReactNode;
  onClick: () => void;
  tooltip: string;
};

function ToolbarActionButton({ ariaLabel, children, onClick, tooltip }: ToolbarActionButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <button aria-label={ariaLabel} className="toolbar-button" onClick={onClick} type="button">
            {children}
          </button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner className="tooltip-positioner" sideOffset={8}>
          <Tooltip.Popup className="tooltip-popup">{tooltip}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

type ModeButtonProps = {
  mode: (typeof MODE_OPTIONS)[number];
  viewMode: TerminalViewMode;
  visibleCount: VisibleSessionCount;
  vscode: WebviewApi;
};

function ModeButton({ mode, viewMode, visibleCount, vscode }: ModeButtonProps) {
  const isDisabled = isViewModeDisabled(mode.viewMode, visibleCount);

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <button
            aria-label={mode.tooltip}
            aria-disabled={isDisabled}
            className="toolbar-button"
            data-disabled={String(isDisabled)}
            data-selected={String(viewMode === mode.viewMode)}
            onClick={() => {
              if (isDisabled) {
                return;
              }

              vscode.postMessage({ type: "setViewMode", viewMode: mode.viewMode });
            }}
            tabIndex={isDisabled ? -1 : 0}
            type="button"
          >
            <LayoutModeIcon viewMode={mode.viewMode} />
          </button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner className="tooltip-positioner" sideOffset={8}>
          <Tooltip.Popup className="tooltip-popup">{mode.tooltip}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

type SortableSessionCardProps = {
  index: number;
  session: SidebarSessionItem;
  vscode: WebviewApi;
};

function SortableSessionCard({ index, session, vscode }: SortableSessionCardProps) {
  const [draftAlias, setDraftAlias] = useState(session.alias);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const secondaryText = session.detail ?? session.primaryTitle ?? session.activityLabel;
  const secondaryTitle =
    session.primaryTitle && session.detail
      ? `${session.primaryTitle}\n${session.detail}`
      : secondaryText;
  const sortable = useSortable({
    disabled: isEditing,
    id: session.sessionId,
    index,
  });

  useEffect(() => {
    if (!isEditing) {
      setDraftAlias(session.alias);
    }
  }, [isEditing, session.alias]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const commitRename = () => {
    const nextAlias = draftAlias.trim();
    setIsEditing(false);
    if (!nextAlias || nextAlias === session.alias) {
      setDraftAlias(session.alias);
      return;
    }

    vscode.postMessage({
      sessionId: session.sessionId,
      title: nextAlias,
      type: "renameSession",
    });
  };

  const cancelRename = () => {
    setDraftAlias(session.alias);
    setIsEditing(false);
  };

  return (
    <article
      className="session"
      data-activity={session.activity}
      data-dragging={String(Boolean(sortable.isDragging))}
      data-focused={String(session.isFocused)}
      data-running={String(session.isRunning)}
      data-visible={String(session.isVisible)}
      aria-pressed={session.isFocused}
      onAuxClick={(event) => {
        if (event.button !== 1) {
          return;
        }

        event.preventDefault();
        vscode.postMessage({ sessionId: session.sessionId, type: "closeSession" });
      }}
      onClick={() => {
        if (isEditing) {
          return;
        }

        vscode.postMessage({
          sessionId: session.sessionId,
          type: "focusSession",
        });
      }}
      onKeyDown={(event) => {
        if (isEditing) {
          return;
        }

        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        vscode.postMessage({ sessionId: session.sessionId, type: "focusSession" });
      }}
      ref={sortable.ref}
      role="button"
      tabIndex={0}
      title="Click to activate the terminal. Click the alias to rename. Middle-click to close."
    >
      <div className="session-head">
        {isEditing ? (
          <input
            aria-label={`Rename alias for ${session.alias}`}
            className="session-alias-input"
            onBlur={commitRename}
            onChange={(event) => setDraftAlias(event.target.value)}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename();
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                cancelRename();
              }
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            ref={inputRef}
            type="text"
            value={draftAlias}
          />
        ) : (
          <div
            className="session-alias-trigger"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDraftAlias(session.alias);
              setIsEditing(true);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              setDraftAlias(session.alias);
              setIsEditing(true);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            role="button"
            tabIndex={0}
          >
            <div className="session-alias-heading">{session.alias}</div>
          </div>
        )}
        <button
          aria-label="Close session"
          className="close-button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            vscode.postMessage({ sessionId: session.sessionId, type: "closeSession" });
          }}
          type="button"
        >
          ×
        </button>
      </div>
      <div className="session-footer">
        {secondaryText ? (
          <div className="session-secondary" title={secondaryTitle}>
            {secondaryText}
          </div>
        ) : (
          <div />
        )}
        <div className="session-meta">{session.shortcutLabel}</div>
      </div>
    </article>
  );
}

function moveSessionId(
  sessionIds: readonly string[],
  initialIndex: number,
  index: number,
): string[] {
  const nextSessionIds = [...sessionIds];
  const [sessionId] = nextSessionIds.splice(initialIndex, 1);

  if (sessionId === undefined) {
    return nextSessionIds;
  }

  nextSessionIds.splice(index, 0, sessionId);
  return nextSessionIds;
}

function mergeDraftSessionIds(
  draftSessionIds: readonly string[],
  syncedSessionIds: readonly string[],
): string[] {
  const syncedSessionIdSet = new Set(syncedSessionIds);
  const mergedSessionIds = draftSessionIds.filter((sessionId) => syncedSessionIdSet.has(sessionId));

  for (const sessionId of syncedSessionIds) {
    if (!mergedSessionIds.includes(sessionId)) {
      mergedSessionIds.push(sessionId);
    }
  }

  return mergedSessionIds;
}

function reconcileDraftSessionIds(
  draftSessionIds: readonly string[] | undefined,
  sessions: readonly SidebarSessionItem[],
): string[] | undefined {
  if (!draftSessionIds) {
    return undefined;
  }

  const syncedSessionIds = sessions.map((session) => session.sessionId);
  const nextDraftSessionIds = mergeDraftSessionIds(draftSessionIds, syncedSessionIds);

  return haveSameSessionOrder(nextDraftSessionIds, syncedSessionIds)
    ? undefined
    : nextDraftSessionIds;
}

function haveSameSessionOrder(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((sessionId, index) => sessionId === right[index]);
}

function isViewModeDisabled(
  viewMode: TerminalViewMode,
  visibleCount: VisibleSessionCount,
): boolean {
  if (visibleCount === 1) {
    return true;
  }

  if (visibleCount === 2 && viewMode === "grid") {
    return true;
  }

  return false;
}

type LayoutModeIconProps = {
  viewMode: TerminalViewMode;
};

function LayoutModeIcon({ viewMode }: LayoutModeIconProps) {
  switch (viewMode) {
    case "horizontal":
      return (
        <svg aria-hidden="true" className="toolbar-icon" viewBox="0 0 16 16">
          <rect className="toolbar-icon-frame" height="12" rx="2" width="12" x="2" y="2" />
          <path className="toolbar-icon-line" d="M6 4v8M10 4v8" />
        </svg>
      );
    case "vertical":
      return (
        <svg aria-hidden="true" className="toolbar-icon" viewBox="0 0 16 16">
          <rect className="toolbar-icon-frame" height="12" rx="2" width="12" x="2" y="2" />
          <path className="toolbar-icon-line" d="M4 6h8M4 10h8" />
        </svg>
      );
    case "grid":
      return (
        <svg aria-hidden="true" className="toolbar-icon" viewBox="0 0 16 16">
          <rect className="toolbar-icon-frame" height="12" rx="2" width="12" x="2" y="2" />
          <path className="toolbar-icon-line" d="M8 4v8M4 8h8" />
        </svg>
      );
  }
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="toolbar-icon" viewBox="0 0 16 16">
      <path
        className="toolbar-icon-line"
        d="M8 2.2v1.4M8 12.4v1.4M3.76 3.76l1 1M11.24 11.24l1 1M2.2 8h1.4M12.4 8h1.4M3.76 12.24l1-1M11.24 4.76l1-1"
      />
      <circle className="toolbar-icon-frame" cx="8" cy="8" r="2.4" />
      <circle className="toolbar-icon-frame" cx="8" cy="8" r="4.6" />
    </svg>
  );
}
