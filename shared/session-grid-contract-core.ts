export const GRID_COLUMN_COUNT = 3;
export const MAX_SESSION_COUNT = GRID_COLUMN_COUNT * GRID_COLUMN_COUNT;
export const MAX_GROUP_COUNT = 20;
export const MAX_SESSION_DISPLAY_ID_COUNT = 100;
export const DEFAULT_AGENT_MANAGER_ZOOM_PERCENT = 100;
export const MIN_AGENT_MANAGER_ZOOM_PERCENT = 50;
export const MAX_AGENT_MANAGER_ZOOM_PERCENT = 200;
export const DEFAULT_MAIN_GROUP_ID = "group-1";
export const DEFAULT_MAIN_GROUP_TITLE = "Main";

export type VisibleSessionCount = 1 | 2 | 3 | 4 | 6 | 9;

export type TerminalViewMode = "horizontal" | "vertical" | "grid";

export type SessionGridDirection = "up" | "right" | "down" | "left";

export type SidebarSessionActivityState = "idle" | "working" | "attention";
export type SessionLifecycleState = "running" | "done" | "sleeping" | "error";

export type SidebarTheme =
  | "plain-dark"
  | "plain-light"
  | "dark-green"
  | "dark-blue"
  | "dark-red"
  | "dark-pink"
  | "dark-orange"
  | "light-blue"
  | "light-green"
  | "light-pink"
  | "light-orange";

export type SidebarThemeSetting =
  | "auto"
  | "plain"
  | "dark-green"
  | "dark-blue"
  | "dark-red"
  | "dark-pink"
  | "dark-orange"
  | "light-blue"
  | "light-green"
  | "light-pink"
  | "light-orange";

export type SidebarThemeVariant = "light" | "dark";

export type SessionKind = "browser" | "terminal" | "t3";
export type TerminalEngine = "ghostty" | "xterm";

export type T3SessionMetadata = {
  projectId: string;
  serverOrigin: string;
  threadId: string;
  workspaceRoot: string;
};

export type WorkspaceFolderAssociation = {
  workspaceFolderId?: string;
  workspaceFolderName?: string;
  workspaceFolderPath?: string;
};

export type BrowserSessionMetadata = {
  url: string;
};

export type BaseSessionRecord = WorkspaceFolderAssociation & {
  kind: SessionKind;
  sessionId: string;
  displayId: string;
  title: string;
  alias: string;
  legacyGroupTitle?: string;
  isFavorite?: boolean;
  isSleeping?: boolean;
  slotIndex: number;
  row: number;
  column: number;
  createdAt: string;
};

export type TerminalSessionRecord = BaseSessionRecord & {
  kind: "terminal";
  terminalEngine: TerminalEngine;
};

export type T3SessionRecord = BaseSessionRecord & {
  kind: "t3";
  t3: T3SessionMetadata;
};

export type BrowserSessionRecord = BaseSessionRecord & {
  browser: BrowserSessionMetadata;
  kind: "browser";
};

export type SessionRecord = BrowserSessionRecord | TerminalSessionRecord | T3SessionRecord;

type CreateSessionRecordBaseOptions = WorkspaceFolderAssociation & {
  displayId?: string;
  legacyGroupTitle?: string;
  title?: string;
};

export type CreateSessionRecordOptions =
  | (CreateSessionRecordBaseOptions & {
      browser: BrowserSessionMetadata;
      kind: "browser";
    })
  | (CreateSessionRecordBaseOptions & {
      kind?: "terminal";
      terminalEngine?: TerminalEngine;
    })
  | (CreateSessionRecordBaseOptions & {
      kind: "t3";
      t3: T3SessionMetadata;
    });

export type SessionGridSnapshot = {
  focusedSessionId?: string;
  fullscreenRestoreVisibleCount?: VisibleSessionCount;
  sessions: SessionRecord[];
  visibleCount: VisibleSessionCount;
  visibleSessionIds: string[];
  viewMode: TerminalViewMode;
};

export type SessionGroupRecord = WorkspaceFolderAssociation & {
  groupId: string;
  snapshot: SessionGridSnapshot;
  title: string;
};

export type GroupedSessionWorkspaceSnapshot = {
  activeGroupId: string;
  groups: SessionGroupRecord[];
  nextGroupNumber: number;
  nextSessionDisplayId: number;
  nextSessionNumber: number;
};
