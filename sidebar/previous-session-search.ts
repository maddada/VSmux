import type {
  SidebarPreviousSessionItem,
  SidebarSessionItem,
} from "../shared/session-grid-contract";

export type PreviousSessionsModalDayGroup = {
  dayLabel: string;
  sessions: SidebarPreviousSessionItem[];
};

export type FilterPreviousSessionsOptions = {
  favoritesOnly?: boolean;
};

export function filterPreviousSessions(
  previousSessions: readonly SidebarPreviousSessionItem[],
  query: string,
  options: FilterPreviousSessionsOptions = {},
): SidebarPreviousSessionItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSessions = options.favoritesOnly
    ? previousSessions.filter((session) => session.isFavorite)
    : [...previousSessions];

  if (!normalizedQuery) {
    return filteredSessions;
  }

  return filteredSessions.filter((session) => matchesSidebarSessionSearchQuery(session, query));
}

export function groupPreviousSessionsByDay(
  previousSessions: readonly SidebarPreviousSessionItem[],
): PreviousSessionsModalDayGroup[] {
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
  const sessionsByDay = new Map<string, SidebarPreviousSessionItem[]>();

  for (const session of previousSessions) {
    const date = new Date(session.closedAt);
    const key = Number.isNaN(date.getTime()) ? "Unknown day" : formatter.format(date);
    const grouped = sessionsByDay.get(key);
    if (grouped) {
      grouped.push(session);
      continue;
    }

    sessionsByDay.set(key, [session]);
  }

  return [...sessionsByDay.entries()].map(([dayLabel, sessions]) => ({
    dayLabel,
    sessions,
  }));
}

function fuzzyIncludes(text: string, query: string): boolean {
  let queryIndex = 0;

  for (const character of text) {
    if (character !== query[queryIndex]) {
      continue;
    }

    queryIndex += 1;
    if (queryIndex >= query.length) {
      return true;
    }
  }

  return query.length === 0;
}

export function matchesSidebarSessionSearchQuery(
  session: Pick<
    SidebarSessionItem,
    "alias" | "detail" | "primaryTitle" | "sessionNumber" | "terminalTitle"
  >,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    session.alias,
    session.primaryTitle,
    session.terminalTitle,
    session.detail,
    session.sessionNumber,
  ]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLowerCase();
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return queryTokens.every((token) => fuzzyIncludes(haystack, token));
}
