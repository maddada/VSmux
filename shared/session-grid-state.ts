import {
  type CreateSessionRecordOptions,
  MAX_SESSION_COUNT,
  type SessionGridDirection,
  type SessionGridSnapshot,
  type SessionRecord,
  type TerminalViewMode,
  type VisibleSessionCount,
  clampTerminalViewMode,
  clampVisibleSessionCount,
  createDefaultSessionGridSnapshot,
  createSessionRecord,
  getOrderedSessions,
} from "./session-grid-contract";
import {
  findDirectionalNeighbor,
  normalizeFullscreenRestoreVisibleCount,
  normalizeSessionRecord,
  normalizeVisibleSessionIds,
  reindexSessionsInOrder,
  replaceFocusedVisibleSession,
  restoreLayoutVisibleCountInSnapshot,
  revealSessionId,
} from "./session-grid-state-helpers";

export function createSessionInSnapshot(
  snapshot: SessionGridSnapshot,
  sessionNumber: number,
  options?: CreateSessionRecordOptions,
): {
  session?: SessionRecord;
  snapshot: SessionGridSnapshot;
} {
  const normalizedSnapshot = normalizeSessionGridSnapshot(snapshot);
  const orderedSessions = getOrderedSessions(normalizedSnapshot);
  if (orderedSessions.length >= MAX_SESSION_COUNT) {
    return { snapshot: normalizedSnapshot };
  }

  const slotIndex = orderedSessions.length;
  const session = createSessionRecord(sessionNumber, slotIndex, options);
  const sessions = reindexSessionsInOrder([...orderedSessions, session]);
  const visibleSessionIds =
    normalizedSnapshot.visibleSessionIds.length < normalizedSnapshot.visibleCount
      ? [...normalizedSnapshot.visibleSessionIds, session.sessionId]
      : replaceFocusedVisibleSession(normalizedSnapshot, session.sessionId);

  return {
    session,
    snapshot: normalizeSessionGridSnapshot({
      ...normalizedSnapshot,
      focusedSessionId: session.sessionId,
      sessions,
      visibleSessionIds,
    }),
  };
}

export function focusDirectionInSnapshot(
  snapshot: SessionGridSnapshot,
  direction: SessionGridDirection,
): { changed: boolean; snapshot: SessionGridSnapshot } {
  const normalizedSnapshot = normalizeSessionGridSnapshot(snapshot);
  const currentSession = normalizedSnapshot.focusedSessionId
    ? normalizedSnapshot.sessions.find(
        (session) => session.sessionId === normalizedSnapshot.focusedSessionId,
      )
    : undefined;
  if (!currentSession) {
    return {
      changed: false,
      snapshot: normalizedSnapshot,
    };
  }

  const nextSession = findDirectionalNeighbor(
    normalizedSnapshot.sessions,
    currentSession,
    direction,
  );
  if (!nextSession) {
    return {
      changed: false,
      snapshot: normalizedSnapshot,
    };
  }

  return focusSessionInSnapshot(normalizedSnapshot, nextSession.sessionId);
}

export function focusSessionInSnapshot(
  snapshot: SessionGridSnapshot,
  sessionId: string,
): { changed: boolean; snapshot: SessionGridSnapshot } {
  const normalizedSnapshot = normalizeSessionGridSnapshot(snapshot);
  const hasSession = normalizedSnapshot.sessions.some((session) => session.sessionId === sessionId);
  if (!hasSession) {
    return {
      changed: false,
      snapshot: normalizedSnapshot,
    };
  }

  return {
    changed: normalizedSnapshot.focusedSessionId !== sessionId,
    snapshot: normalizeSessionGridSnapshot({
      ...normalizedSnapshot,
      focusedSessionId: sessionId,
      visibleSessionIds: revealSessionId(normalizedSnapshot, sessionId),
    }),
  };
}

export function normalizeSessionGridSnapshot(
  snapshot: SessionGridSnapshot | undefined,
): SessionGridSnapshot {
  const normalizedSnapshot = snapshot ?? createDefaultSessionGridSnapshot();
  const orderedSessions = getOrderedSessions({
    ...normalizedSnapshot,
    sessions: normalizedSnapshot.sessions
      .filter((session) => session.slotIndex < MAX_SESSION_COUNT)
      .map((session) => normalizeSessionRecord(session)),
  });
  const sessionIds = new Set(orderedSessions.map((session) => session.sessionId));
  const visibleCount = clampVisibleSessionCount(normalizedSnapshot.visibleCount);
  const viewMode = clampTerminalViewMode(normalizedSnapshot.viewMode);

  const focusFallback = orderedSessions[0]?.sessionId;
  const focusedSessionId =
    normalizedSnapshot.focusedSessionId && sessionIds.has(normalizedSnapshot.focusedSessionId)
      ? normalizedSnapshot.focusedSessionId
      : focusFallback;

  const desiredVisibleSize = Math.min(visibleCount, orderedSessions.length);
  const normalizedVisibleIds = normalizeVisibleSessionIds(
    orderedSessions,
    normalizedSnapshot.visibleSessionIds,
    desiredVisibleSize,
    focusedSessionId,
  );
  const fullscreenRestoreVisibleCount = normalizeFullscreenRestoreVisibleCount(
    normalizedSnapshot.fullscreenRestoreVisibleCount,
    visibleCount,
  );

  return {
    focusedSessionId,
    fullscreenRestoreVisibleCount,
    sessions: orderedSessions,
    visibleCount,
    visibleSessionIds: normalizedVisibleIds,
    viewMode,
  };
}

export function setVisibleCountInSnapshot(
  snapshot: SessionGridSnapshot,
  visibleCount: VisibleSessionCount,
): SessionGridSnapshot {
  const normalizedSnapshot = normalizeSessionGridSnapshot(snapshot);
  return normalizeSessionGridSnapshot({
    ...normalizedSnapshot,
    fullscreenRestoreVisibleCount: undefined,
    visibleCount,
  });
}

export function toggleFullscreenSessionInSnapshot(
  snapshot: SessionGridSnapshot,
): SessionGridSnapshot {
  const normalizedSnapshot = normalizeSessionGridSnapshot(snapshot);
  if (normalizedSnapshot.visibleCount === 1 && normalizedSnapshot.fullscreenRestoreVisibleCount) {
    return restoreLayoutVisibleCountInSnapshot(normalizedSnapshot, normalizeSessionGridSnapshot);
  }

  return normalizeSessionGridSnapshot({
    ...normalizedSnapshot,
    fullscreenRestoreVisibleCount:
      normalizedSnapshot.visibleCount > 1 ? normalizedSnapshot.visibleCount : undefined,
    visibleCount: 1,
  });
}

export function setViewModeInSnapshot(
  snapshot: SessionGridSnapshot,
  viewMode: TerminalViewMode,
): SessionGridSnapshot {
  const normalizedSnapshot = restoreLayoutVisibleCountInSnapshot(
    snapshot,
    normalizeSessionGridSnapshot,
  );
  return normalizeSessionGridSnapshot({
    ...normalizedSnapshot,
    viewMode,
  });
}

export function syncSessionOrderInSnapshot(
  snapshot: SessionGridSnapshot,
  sessionIds: readonly string[],
): { changed: boolean; snapshot: SessionGridSnapshot } {
  const normalizedSnapshot = normalizeSessionGridSnapshot(snapshot);
  const orderedSessions = getOrderedSessions(normalizedSnapshot);
  const currentSessionIds = orderedSessions.map((session) => session.sessionId);

  if (sessionIds.length !== currentSessionIds.length) {
    return {
      changed: false,
      snapshot: normalizedSnapshot,
    };
  }

  const hasSameOrder = currentSessionIds.every(
    (sessionId, index) => sessionId === sessionIds[index],
  );
  if (hasSameOrder) {
    return {
      changed: false,
      snapshot: normalizedSnapshot,
    };
  }

  const currentSessionIdSet = new Set(currentSessionIds);
  const incomingSessionIdSet = new Set(sessionIds);
  if (
    incomingSessionIdSet.size !== sessionIds.length ||
    currentSessionIds.some((sessionId) => !incomingSessionIdSet.has(sessionId)) ||
    sessionIds.some((sessionId) => !currentSessionIdSet.has(sessionId))
  ) {
    return {
      changed: false,
      snapshot: normalizedSnapshot,
    };
  }

  const sessionById = new Map(orderedSessions.map((session) => [session.sessionId, session]));
  const sessions = reindexSessionsInOrder(
    sessionIds.map((sessionId) => {
      const session = sessionById.get(sessionId);
      if (!session) {
        throw new Error(`Missing session for reorder: ${sessionId}`);
      }

      return session;
    }),
  );

  const visibleSessionIds = sessionIds.slice(
    0,
    Math.min(normalizedSnapshot.visibleCount, sessions.length),
  );
  const focusedSessionId =
    normalizedSnapshot.focusedSessionId &&
    visibleSessionIds.includes(normalizedSnapshot.focusedSessionId)
      ? normalizedSnapshot.focusedSessionId
      : visibleSessionIds[0];

  return {
    changed: true,
    snapshot: normalizeSessionGridSnapshot({
      ...normalizedSnapshot,
      focusedSessionId,
      sessions,
      visibleSessionIds,
    }),
  };
}

export function renameSessionAliasInSnapshot(
  snapshot: SessionGridSnapshot,
  sessionId: string,
  alias: string,
): { changed: boolean; snapshot: SessionGridSnapshot } {
  const normalizedSnapshot = normalizeSessionGridSnapshot(snapshot);
  const normalizedAlias = alias.trim();
  if (normalizedAlias.length === 0) {
    return {
      changed: false,
      snapshot: normalizedSnapshot,
    };
  }

  let changed = false;
  const sessions = normalizedSnapshot.sessions.map((session) => {
    if (session.sessionId !== sessionId || session.alias === normalizedAlias) {
      return session;
    }

    changed = true;
    return {
      ...session,
      alias: normalizedAlias,
    };
  });

  return {
    changed,
    snapshot: changed
      ? normalizeSessionGridSnapshot({
          ...normalizedSnapshot,
          sessions,
        })
      : normalizedSnapshot,
  };
}

export function setSessionTitleInSnapshot(
  snapshot: SessionGridSnapshot,
  sessionId: string,
  title: string,
): { changed: boolean; snapshot: SessionGridSnapshot } {
  const normalizedSnapshot = normalizeSessionGridSnapshot(snapshot);
  const normalizedTitle = title.trim();
  if (normalizedTitle.length === 0) {
    return {
      changed: false,
      snapshot: normalizedSnapshot,
    };
  }

  let changed = false;
  const sessions = normalizedSnapshot.sessions.map((session) => {
    if (session.sessionId !== sessionId || session.title === normalizedTitle) {
      return session;
    }

    changed = true;
    return {
      ...session,
      title: normalizedTitle,
    };
  });

  return {
    changed,
    snapshot: changed
      ? normalizeSessionGridSnapshot({
          ...normalizedSnapshot,
          sessions,
        })
      : normalizedSnapshot,
  };
}

export function setBrowserSessionMetadataInSnapshot(
  snapshot: SessionGridSnapshot,
  sessionId: string,
  title: string,
  url: string,
): { changed: boolean; snapshot: SessionGridSnapshot } {
  const normalizedSnapshot = normalizeSessionGridSnapshot(snapshot);
  const normalizedTitle = title.trim();
  const normalizedUrl = url.trim();
  if (!normalizedTitle || !normalizedUrl) {
    return {
      changed: false,
      snapshot: normalizedSnapshot,
    };
  }

  let changed = false;
  const sessions = normalizedSnapshot.sessions.map((session) => {
    if (session.sessionId !== sessionId || session.kind !== "browser") {
      return session;
    }

    if (session.title === normalizedTitle && session.browser.url === normalizedUrl) {
      return session;
    }

    changed = true;
    return {
      ...session,
      browser: {
        url: normalizedUrl,
      },
      title: normalizedTitle,
    };
  });

  return {
    changed,
    snapshot: changed
      ? normalizeSessionGridSnapshot({
          ...normalizedSnapshot,
          sessions,
        })
      : normalizedSnapshot,
  };
}

export function removeSessionInSnapshot(
  snapshot: SessionGridSnapshot,
  sessionId: string,
): { changed: boolean; snapshot: SessionGridSnapshot } {
  const normalizedSnapshot = normalizeSessionGridSnapshot(snapshot);
  if (!normalizedSnapshot.sessions.some((session) => session.sessionId === sessionId)) {
    return {
      changed: false,
      snapshot: normalizedSnapshot,
    };
  }

  const sessions = normalizedSnapshot.sessions.filter((session) => session.sessionId !== sessionId);
  const visibleSessionIds = normalizedSnapshot.visibleSessionIds.filter(
    (visibleSessionId) => visibleSessionId !== sessionId,
  );

  return {
    changed: true,
    snapshot: normalizeSessionGridSnapshot({
      ...normalizedSnapshot,
      focusedSessionId:
        normalizedSnapshot.focusedSessionId === sessionId
          ? (visibleSessionIds[0] ?? sessions[0]?.sessionId)
          : normalizedSnapshot.focusedSessionId,
      sessions,
      visibleSessionIds,
    }),
  };
}
