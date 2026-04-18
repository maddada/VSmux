import * as path from "node:path";
import * as vscode from "vscode";
import {
  createDefaultSessionGridSnapshot,
  getOrderedSessions,
  type GroupedSessionWorkspaceSnapshot,
  type SessionGroupRecord,
  type SessionRecord,
} from "../shared/session-grid-contract";

export type WorkspaceFolderDescriptor = {
  workspaceFolderId: string;
  workspaceFolderName: string;
  workspaceFolderPath: string;
};

export function getWorkspaceFolderDescriptors(): WorkspaceFolderDescriptor[] {
  return (vscode.workspace.workspaceFolders ?? []).map((folder) => ({
    workspaceFolderId: folder.uri.toString(),
    workspaceFolderName: folder.name.trim() || path.basename(folder.uri.fsPath),
    workspaceFolderPath: folder.uri.fsPath,
  }));
}

export function shouldUseWorkspaceFolderGroups(
  folders: readonly WorkspaceFolderDescriptor[],
): boolean {
  return folders.length > 1;
}

export function syncWorkspaceSnapshotWithFolders(
  snapshot: GroupedSessionWorkspaceSnapshot,
  folders: readonly WorkspaceFolderDescriptor[],
): GroupedSessionWorkspaceSnapshot {
  if (folders.length === 0) {
    return snapshot;
  }

  const groupsByFolderId = new Map<string, SessionGroupRecord[]>();
  const unassignedGroups: SessionGroupRecord[] = [];
  for (const group of snapshot.groups) {
    const folder = resolveGroupWorkspaceFolder(group, folders);
    if (!folder) {
      unassignedGroups.push(group);
      continue;
    }

    const existingGroups = groupsByFolderId.get(folder.workspaceFolderId) ?? [];
    existingGroups.push(group);
    groupsByFolderId.set(folder.workspaceFolderId, existingGroups);
  }

  const nextGroups: SessionGroupRecord[] = [];
  let nextGroupNumber = Math.max(snapshot.nextGroupNumber, 2);
  let nextActiveGroupId: string | undefined;

  for (const folder of folders) {
    const assignedGroups = groupsByFolderId.get(folder.workspaceFolderId) ?? [];
    if (assignedGroups.length === 0 && unassignedGroups.length > 0) {
      assignedGroups.push(unassignedGroups.shift()!);
    }

    if (assignedGroups.length === 0) {
      const groupId = `group-${nextGroupNumber}`;
      nextGroupNumber += 1;
      const emptyGroup = createWorkspaceFolderGroup(groupId, folder);
      nextGroups.push(emptyGroup);
      if (!nextActiveGroupId) {
        nextActiveGroupId = emptyGroup.groupId;
      }
      continue;
    }

    const mergedGroup = mergeWorkspaceFolderGroups(assignedGroups, folder);
    nextGroups.push(mergedGroup);
    if (
      !nextActiveGroupId &&
      assignedGroups.some((group) => group.groupId === snapshot.activeGroupId)
    ) {
      nextActiveGroupId = mergedGroup.groupId;
    }
  }

  if (!nextActiveGroupId) {
    nextActiveGroupId = nextGroups[0]?.groupId ?? snapshot.activeGroupId;
  }

  return {
    ...snapshot,
    activeGroupId: nextActiveGroupId,
    groups: nextGroups,
    nextGroupNumber,
  };
}

export function resolveWorkspaceFolderForSession(
  session: Pick<SessionRecord, "kind" | "workspaceFolderId" | "workspaceFolderPath">,
  folders: readonly WorkspaceFolderDescriptor[],
): WorkspaceFolderDescriptor | undefined {
  const directMatch = folders.find(
    (folder) =>
      session.workspaceFolderId === folder.workspaceFolderId ||
      session.workspaceFolderPath === folder.workspaceFolderPath,
  );
  if (directMatch) {
    return directMatch;
  }

  if (session.kind === "t3") {
    return undefined;
  }

  return findBestWorkspaceFolderForPath(session.workspaceFolderPath, folders);
}

function resolveGroupWorkspaceFolder(
  group: SessionGroupRecord,
  folders: readonly WorkspaceFolderDescriptor[],
): WorkspaceFolderDescriptor | undefined {
  const directMatch = folders.find(
    (folder) =>
      folder.workspaceFolderId === group.workspaceFolderId ||
      folder.workspaceFolderPath === group.workspaceFolderPath,
  );
  if (directMatch) {
    return directMatch;
  }

  for (const session of getOrderedSessions(group.snapshot)) {
    const sessionFolder = resolveWorkspaceFolderFromRecord(session, folders);
    if (sessionFolder) {
      return sessionFolder;
    }
  }

  return undefined;
}

function resolveWorkspaceFolderFromRecord(
  session: SessionRecord,
  folders: readonly WorkspaceFolderDescriptor[],
): WorkspaceFolderDescriptor | undefined {
  const directMatch = folders.find(
    (folder) =>
      folder.workspaceFolderId === session.workspaceFolderId ||
      folder.workspaceFolderPath === session.workspaceFolderPath,
  );
  if (directMatch) {
    return directMatch;
  }

  if (session.kind === "t3") {
    return findBestWorkspaceFolderForPath(session.t3.workspaceRoot, folders);
  }

  return findBestWorkspaceFolderForPath(session.workspaceFolderPath, folders);
}

function mergeWorkspaceFolderGroups(
  groups: readonly SessionGroupRecord[],
  folder: WorkspaceFolderDescriptor,
): SessionGroupRecord {
  const primaryGroup = groups[0]!;
  const mergedSessions = groups.flatMap((group) =>
    getOrderedSessions(group.snapshot).map((session) =>
      withWorkspaceFolderAssociation(
        withLegacyGroupTitle(session, group.title, folder.workspaceFolderName),
        folder,
      ),
    ),
  );
  const focusedSessionId = groups.find((group) => group.snapshot.focusedSessionId)?.snapshot.focusedSessionId;
  const visibleCount = primaryGroup.snapshot.visibleCount;
  const visibleSessionIds = dedupeSessionIds(
    groups.flatMap((group) => group.snapshot.visibleSessionIds),
  );

  return {
    groupId: primaryGroup.groupId,
    snapshot: {
      ...createDefaultSessionGridSnapshot(),
      ...primaryGroup.snapshot,
      focusedSessionId:
        mergedSessions.some((session) => session.sessionId === focusedSessionId)
          ? focusedSessionId
          : mergedSessions[0]?.sessionId,
      sessions: mergedSessions,
      visibleSessionIds,
      visibleCount,
    },
    title: folder.workspaceFolderName,
    workspaceFolderId: folder.workspaceFolderId,
    workspaceFolderName: folder.workspaceFolderName,
    workspaceFolderPath: folder.workspaceFolderPath,
  };
}

function createWorkspaceFolderGroup(
  groupId: string,
  folder: WorkspaceFolderDescriptor,
): SessionGroupRecord {
  return {
    groupId,
    snapshot: createDefaultSessionGridSnapshot(),
    title: folder.workspaceFolderName,
    workspaceFolderId: folder.workspaceFolderId,
    workspaceFolderName: folder.workspaceFolderName,
    workspaceFolderPath: folder.workspaceFolderPath,
  };
}

function withLegacyGroupTitle(
  session: SessionRecord,
  groupTitle: string,
  workspaceFolderName: string,
): SessionRecord {
  const normalizedGroupTitle = groupTitle.trim();
  if (!normalizedGroupTitle || normalizedGroupTitle === workspaceFolderName.trim()) {
    return session;
  }

  return {
    ...session,
    legacyGroupTitle: session.legacyGroupTitle?.trim() || normalizedGroupTitle,
  };
}

function withWorkspaceFolderAssociation(
  session: SessionRecord,
  folder: WorkspaceFolderDescriptor,
): SessionRecord {
  return {
    ...session,
    workspaceFolderId: folder.workspaceFolderId,
    workspaceFolderName: folder.workspaceFolderName,
    workspaceFolderPath: folder.workspaceFolderPath,
  };
}

function findBestWorkspaceFolderForPath(
  candidatePath: string | undefined,
  folders: readonly WorkspaceFolderDescriptor[],
): WorkspaceFolderDescriptor | undefined {
  const normalizedCandidatePath = candidatePath?.trim();
  if (!normalizedCandidatePath) {
    return undefined;
  }

  return [...folders]
    .filter((folder) => isPathInsideWorkspaceFolder(normalizedCandidatePath, folder.workspaceFolderPath))
    .sort((left, right) => right.workspaceFolderPath.length - left.workspaceFolderPath.length)[0];
}

function isPathInsideWorkspaceFolder(candidatePath: string, workspaceFolderPath: string): boolean {
  const normalizedFolderPath = path.resolve(workspaceFolderPath);
  const normalizedCandidatePath = path.resolve(candidatePath);
  return (
    normalizedCandidatePath === normalizedFolderPath ||
    normalizedCandidatePath.startsWith(`${normalizedFolderPath}${path.sep}`)
  );
}

function dedupeSessionIds(sessionIds: readonly string[]): string[] {
  const deduped: string[] = [];
  for (const sessionId of sessionIds) {
    if (deduped.includes(sessionId)) {
      continue;
    }
    deduped.push(sessionId);
  }
  return deduped;
}
