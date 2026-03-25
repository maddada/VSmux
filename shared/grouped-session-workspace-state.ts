import {
  DEFAULT_MAIN_GROUP_ID,
  DEFAULT_MAIN_GROUP_TITLE,
  MAX_GROUP_COUNT,
  MAX_SESSION_DISPLAY_ID_COUNT,
  type CreateSessionRecordOptions,
  createDefaultGroupedSessionWorkspaceSnapshot,
  createDefaultSessionGridSnapshot,
  type GroupedSessionWorkspaceSnapshot,
  type SessionGroupRecord,
  type SessionRecord,
  type TerminalViewMode,
  type VisibleSessionCount,
} from "./session-grid-contract";
import {
  createSessionInSnapshot,
  focusSessionInSnapshot,
  normalizeSessionGridSnapshot,
  removeSessionInSnapshot,
  renameSessionAliasInSnapshot,
  setBrowserSessionMetadataInSnapshot,
  setSessionTitleInSnapshot,
  setViewModeInSnapshot,
  setVisibleCountInSnapshot,
  syncSessionOrderInSnapshot,
  toggleFullscreenSessionInSnapshot,
} from "./session-grid-state";
import {
  claimNextSessionDisplayId,
  findGroupContainingSession,
  getSessionRecord,
  insertSessionIntoGroup,
  isGroupedWorkspaceSnapshot,
  isSessionGroupRecord,
  normalizeGroup,
  normalizeWorkspaceSessionDisplayIds,
  updateActiveGroupSnapshot,
  updateGroup,
  updateOwningGroupSnapshot,
} from "./grouped-session-workspace-state-helpers";

export function normalizeGroupedSessionWorkspaceSnapshot(
  snapshot: GroupedSessionWorkspaceSnapshot | undefined,
): GroupedSessionWorkspaceSnapshot {
  if (!isGroupedWorkspaceSnapshot(snapshot)) {
    return createDefaultGroupedSessionWorkspaceSnapshot();
  }

  const groups = snapshot.groups
    .filter((group) => isSessionGroupRecord(group))
    .slice(0, MAX_GROUP_COUNT)
    .map((group, index) => normalizeGroup(group, index));

  const normalizedGroups =
    groups.length > 0
      ? groups
      : [
          {
            groupId: DEFAULT_MAIN_GROUP_ID,
            snapshot: createDefaultSessionGridSnapshot(),
            title: DEFAULT_MAIN_GROUP_TITLE,
          },
        ];

  const activeGroupId = normalizedGroups.some((group) => group.groupId === snapshot.activeGroupId)
    ? snapshot.activeGroupId
    : normalizedGroups[0].groupId;
  const displayIdNormalization = normalizeWorkspaceSessionDisplayIds(normalizedGroups);

  return {
    activeGroupId,
    groups: displayIdNormalization.groups,
    nextGroupNumber:
      typeof snapshot.nextGroupNumber === "number" && snapshot.nextGroupNumber > 1
        ? snapshot.nextGroupNumber
        : normalizedGroups.length + 1,
    nextSessionDisplayId:
      typeof snapshot.nextSessionDisplayId === "number" &&
      Number.isInteger(snapshot.nextSessionDisplayId) &&
      snapshot.nextSessionDisplayId >= 0
        ? snapshot.nextSessionDisplayId % MAX_SESSION_DISPLAY_ID_COUNT
        : displayIdNormalization.nextSessionDisplayId,
    nextSessionNumber:
      typeof snapshot.nextSessionNumber === "number" && snapshot.nextSessionNumber > 0
        ? snapshot.nextSessionNumber
        : 1,
  };
}

export function getActiveGroup(
  snapshot: GroupedSessionWorkspaceSnapshot,
): SessionGroupRecord | undefined {
  return snapshot.groups.find((group) => group.groupId === snapshot.activeGroupId);
}

export function getGroupById(
  snapshot: GroupedSessionWorkspaceSnapshot,
  groupId: string,
): SessionGroupRecord | undefined {
  return snapshot.groups.find((group) => group.groupId === groupId);
}

export function getGroupForSession(
  snapshot: GroupedSessionWorkspaceSnapshot,
  sessionId: string,
): SessionGroupRecord | undefined {
  return findGroupContainingSession(snapshot, sessionId)?.group;
}

export function createSessionInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  options?: CreateSessionRecordOptions,
): {
  session?: SessionRecord;
  snapshot: GroupedSessionWorkspaceSnapshot;
} {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  const activeGroup = getActiveGroup(normalizedSnapshot);
  if (!activeGroup) {
    return { snapshot: normalizedSnapshot };
  }

  const nextDisplayId = claimNextSessionDisplayId(normalizedSnapshot);
  const result = createSessionInSnapshot(
    activeGroup.snapshot,
    normalizedSnapshot.nextSessionNumber,
    {
      ...options,
      displayId: nextDisplayId.displayId,
    } as CreateSessionRecordOptions & { displayId: string },
  );
  if (!result.session) {
    return { snapshot: normalizedSnapshot };
  }

  return {
    session: result.session,
    snapshot: {
      ...normalizedSnapshot,
      groups: updateGroup(normalizedSnapshot.groups, activeGroup.groupId, result.snapshot),
      nextSessionDisplayId: nextDisplayId.nextSessionDisplayId,
      nextSessionNumber: normalizedSnapshot.nextSessionNumber + 1,
    },
  };
}

export function focusGroupInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  groupId: string,
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  if (!normalizedSnapshot.groups.some((group) => group.groupId === groupId)) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  return {
    changed: normalizedSnapshot.activeGroupId !== groupId,
    snapshot:
      normalizedSnapshot.activeGroupId === groupId
        ? normalizedSnapshot
        : {
            ...normalizedSnapshot,
            activeGroupId: groupId,
          },
  };
}

export function focusGroupByIndexInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  groupIndex: number,
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  const targetGroup = normalizedSnapshot.groups[groupIndex - 1];
  if (!targetGroup) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  return focusGroupInWorkspace(normalizedSnapshot, targetGroup.groupId);
}

export function focusSessionInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  sessionId: string,
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  const location = findGroupContainingSession(normalizedSnapshot, sessionId);
  if (!location) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const result = focusSessionInSnapshot(location.group.snapshot, sessionId);
  const nextActiveGroupId = location.group.groupId;

  return {
    changed: result.changed || normalizedSnapshot.activeGroupId !== nextActiveGroupId,
    snapshot: {
      ...normalizedSnapshot,
      activeGroupId: nextActiveGroupId,
      groups: updateGroup(normalizedSnapshot.groups, location.group.groupId, result.snapshot),
    },
  };
}

export function applyObservedActiveGroupStateInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  focusedSessionId: string | undefined,
  visibleSessionIds: readonly string[],
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  const activeGroup = getActiveGroup(normalizedSnapshot);
  if (!activeGroup) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const nextGroupSnapshot = normalizeSessionGridSnapshot({
    ...activeGroup.snapshot,
    focusedSessionId,
    visibleSessionIds: [...visibleSessionIds],
  });
  const changed =
    activeGroup.snapshot.focusedSessionId !== nextGroupSnapshot.focusedSessionId ||
    activeGroup.snapshot.visibleSessionIds.length !== nextGroupSnapshot.visibleSessionIds.length ||
    activeGroup.snapshot.visibleSessionIds.some(
      (sessionId, index) => sessionId !== nextGroupSnapshot.visibleSessionIds[index],
    );
  if (!changed) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  return {
    changed: true,
    snapshot: {
      ...normalizedSnapshot,
      groups: updateGroup(normalizedSnapshot.groups, activeGroup.groupId, nextGroupSnapshot),
    },
  };
}

export function renameGroupInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  groupId: string,
  title: string,
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  let changed = false;
  const groups = normalizedSnapshot.groups.map((group) => {
    if (group.groupId !== groupId || group.title === normalizedTitle) {
      return group;
    }

    changed = true;
    return {
      ...group,
      title: normalizedTitle,
    };
  });

  return {
    changed,
    snapshot: changed
      ? {
          ...normalizedSnapshot,
          groups,
        }
      : normalizedSnapshot,
  };
}

export function removeGroupInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  groupId: string,
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  if (
    normalizedSnapshot.groups.length <= 1 ||
    !normalizedSnapshot.groups.some((group) => group.groupId === groupId)
  ) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const removedGroupIndex = normalizedSnapshot.groups.findIndex(
    (group) => group.groupId === groupId,
  );
  const groups = normalizedSnapshot.groups.filter((group) => group.groupId !== groupId);
  const nextActiveGroupId =
    normalizedSnapshot.activeGroupId !== groupId
      ? normalizedSnapshot.activeGroupId
      : (groups[Math.max(0, removedGroupIndex - 1)] ?? groups[0]).groupId;

  return {
    changed: true,
    snapshot: {
      ...normalizedSnapshot,
      activeGroupId: nextActiveGroupId,
      groups,
    },
  };
}

export function renameSessionAliasInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  sessionId: string,
  alias: string,
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  return updateOwningGroupSnapshot(snapshot, sessionId, (groupSnapshot) =>
    renameSessionAliasInSnapshot(groupSnapshot, sessionId, alias),
  );
}

export function setSessionTitleInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  sessionId: string,
  title: string,
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  return updateOwningGroupSnapshot(snapshot, sessionId, (groupSnapshot) =>
    setSessionTitleInSnapshot(groupSnapshot, sessionId, title),
  );
}

export function setBrowserSessionMetadataInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  sessionId: string,
  title: string,
  url: string,
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  return updateOwningGroupSnapshot(snapshot, sessionId, (groupSnapshot) =>
    setBrowserSessionMetadataInSnapshot(groupSnapshot, sessionId, title, url),
  );
}

export function removeSessionInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  sessionId: string,
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  return updateOwningGroupSnapshot(snapshot, sessionId, (groupSnapshot) =>
    removeSessionInSnapshot(groupSnapshot, sessionId),
  );
}

export function setVisibleCountInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  visibleCount: VisibleSessionCount,
): GroupedSessionWorkspaceSnapshot {
  return updateActiveGroupSnapshot(snapshot, getActiveGroup, (groupSnapshot) =>
    setVisibleCountInSnapshot(groupSnapshot, visibleCount),
  );
}

export function toggleFullscreenSessionInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
): GroupedSessionWorkspaceSnapshot {
  return updateActiveGroupSnapshot(snapshot, getActiveGroup, (groupSnapshot) =>
    toggleFullscreenSessionInSnapshot(groupSnapshot),
  );
}

export function setViewModeInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  viewMode: TerminalViewMode,
): GroupedSessionWorkspaceSnapshot {
  return updateActiveGroupSnapshot(snapshot, getActiveGroup, (groupSnapshot) =>
    setViewModeInSnapshot(groupSnapshot, viewMode),
  );
}

export function syncSessionOrderInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  groupId: string,
  sessionIds: readonly string[],
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  const group = getGroupById(normalizedSnapshot, groupId);
  if (!group) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const result = syncSessionOrderInSnapshot(group.snapshot, sessionIds);
  return {
    changed: result.changed,
    snapshot: result.changed
      ? {
          ...normalizedSnapshot,
          groups: updateGroup(normalizedSnapshot.groups, groupId, result.snapshot),
        }
      : normalizedSnapshot,
  };
}

export function syncGroupOrderInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  groupIds: readonly string[],
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  const currentGroupIds = normalizedSnapshot.groups.map((group) => group.groupId);
  if (groupIds.length !== currentGroupIds.length) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const hasSameOrder = currentGroupIds.every((groupId, index) => groupId === groupIds[index]);
  if (hasSameOrder) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const currentGroupIdSet = new Set(currentGroupIds);
  const incomingGroupIdSet = new Set(groupIds);
  if (
    incomingGroupIdSet.size !== groupIds.length ||
    currentGroupIds.some((groupId) => !incomingGroupIdSet.has(groupId)) ||
    groupIds.some((groupId) => !currentGroupIdSet.has(groupId))
  ) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const groupsById = new Map(normalizedSnapshot.groups.map((group) => [group.groupId, group]));
  return {
    changed: true,
    snapshot: {
      ...normalizedSnapshot,
      groups: groupIds.map((groupId) => {
        const group = groupsById.get(groupId);
        if (!group) {
          throw new Error(`Missing group for reorder: ${groupId}`);
        }

        return group;
      }),
    },
  };
}

export function moveSessionToGroupInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  sessionId: string,
  targetGroupId: string,
  targetIndex?: number,
): { changed: boolean; snapshot: GroupedSessionWorkspaceSnapshot } {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  const sourceLocation = findGroupContainingSession(normalizedSnapshot, sessionId);
  const targetGroup = getGroupById(normalizedSnapshot, targetGroupId);
  if (!sourceLocation || !targetGroup || sourceLocation.group.groupId === targetGroupId) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const sessionRecord = getSessionRecord(sourceLocation.group.snapshot, sessionId);
  if (!sessionRecord) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const removedSourceSnapshot = removeSessionInSnapshot(
    sourceLocation.group.snapshot,
    sessionId,
  ).snapshot;
  const targetSnapshot = insertSessionIntoGroup(targetGroup.snapshot, sessionRecord, targetIndex);
  const focusedTargetSnapshot = focusSessionInSnapshot(targetSnapshot, sessionId).snapshot;

  const nextGroups = normalizedSnapshot.groups.map((group) => {
    if (group.groupId === sourceLocation.group.groupId) {
      return {
        ...group,
        snapshot: removedSourceSnapshot,
      };
    }

    if (group.groupId === targetGroupId) {
      return {
        ...group,
        snapshot: focusedTargetSnapshot,
      };
    }

    return group;
  });

  return {
    changed: true,
    snapshot: {
      ...normalizedSnapshot,
      activeGroupId: targetGroupId,
      groups: nextGroups,
    },
  };
}

export function createGroupFromSessionInWorkspace(
  snapshot: GroupedSessionWorkspaceSnapshot,
  sessionId: string,
): { changed: boolean; groupId?: string; snapshot: GroupedSessionWorkspaceSnapshot } {
  const normalizedSnapshot = normalizeGroupedSessionWorkspaceSnapshot(snapshot);
  if (normalizedSnapshot.groups.length >= MAX_GROUP_COUNT) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const sourceLocation = findGroupContainingSession(normalizedSnapshot, sessionId);
  if (!sourceLocation) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const sessionRecord = getSessionRecord(sourceLocation.group.snapshot, sessionId);
  if (!sessionRecord) {
    return { changed: false, snapshot: normalizedSnapshot };
  }

  const removedSourceSnapshot = removeSessionInSnapshot(
    sourceLocation.group.snapshot,
    sessionId,
  ).snapshot;
  const groupId = `group-${normalizedSnapshot.nextGroupNumber}`;
  const groupTitle = `Group ${normalizedSnapshot.nextGroupNumber}`;
  const nextGroupSnapshot = focusSessionInSnapshot(
    insertSessionIntoGroup(createDefaultSessionGridSnapshot(), sessionRecord),
    sessionId,
  ).snapshot;

  return {
    changed: true,
    groupId,
    snapshot: {
      ...normalizedSnapshot,
      activeGroupId: groupId,
      groups: [
        ...normalizedSnapshot.groups.map((group) =>
          group.groupId === sourceLocation.group.groupId
            ? {
                ...group,
                snapshot: removedSourceSnapshot,
              }
            : group,
        ),
        {
          groupId,
          snapshot: nextGroupSnapshot,
          title: groupTitle,
        },
      ],
      nextGroupNumber: normalizedSnapshot.nextGroupNumber + 1,
    },
  };
}
