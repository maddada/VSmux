import { useState, useRef, useEffect, useCallback } from "react";
import {
  type JsonlFile,
  saveDirectoryHandle,
  loadDirectoryHandle,
  scanDirectoryForJsonl,
} from "@/lib/directory-utils";
import { getOrPromptUsername } from "@/lib/username-utils";
import { clearCache } from "@/lib/cache";

export interface UseDirectoryHandleReturn {
  files: JsonlFile[];
  folderName: string | null;
  isScanning: boolean;
  currentDirHandle: FileSystemDirectoryHandle | null;
  handleSelectFolder: () => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleDeleteFile: (file: JsonlFile) => Promise<void>;
}

export function useDirectoryHandle(): UseDirectoryHandleReturn {
  const [files, setFiles] = useState<JsonlFile[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const hasTriedAutoLoad = useRef(false);
  const currentDirHandle = useRef<FileSystemDirectoryHandle | null>(null);

  const loadDirectory = useCallback(async (dirHandle: FileSystemDirectoryHandle, save = true) => {
    currentDirHandle.current = dirHandle;
    setFolderName(dirHandle.name);
    setIsScanning(true);

    try {
      const foundFiles = await scanDirectoryForJsonl(dirHandle);
      foundFiles.sort((a, b) => {
        if (a.folder !== b.folder) {
          return a.folder.localeCompare(b.folder);
        }
        return a.lastModified - b.lastModified;
      });

      setFiles(foundFiles);

      if (save) {
        await saveDirectoryHandle(dirHandle);
      }
    } catch {
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!currentDirHandle.current || isScanning) return;

    clearCache();
    await loadDirectory(currentDirHandle.current, false);
  }, [isScanning, loadDirectory]);

  const handleDeleteFile = useCallback(async (file: JsonlFile) => {
    if (!file.name.endsWith(".jsonl")) {
      return;
    }

    try {
      await file.parentDirHandle.removeEntry(file.name);
      setFiles((prev) => prev.filter((f) => f.path !== file.path));
    } catch {
      alert("Failed to delete the file. You may need read-write permission.");
    }
  }, []);

  const handleSelectFolder = useCallback(async () => {
    try {
      const username = getOrPromptUsername();
      if (username) {
        await navigator.clipboard.writeText(`/Users/${username}/.claude/projects`);
      }

      const dirHandle = await window.showDirectoryPicker({
        id: "claude-projects",
        startIn: "documents",
        mode: "readwrite",
      });
      await loadDirectory(dirHandle);
    } catch {}
  }, [loadDirectory]);

  useEffect(() => {
    if (hasTriedAutoLoad.current) return;
    hasTriedAutoLoad.current = true;

    const tryRestoreFolder = async () => {
      try {
        const savedHandle = await loadDirectoryHandle();
        if (savedHandle) {
          let permission = await savedHandle.queryPermission?.({ mode: "readwrite" });
          if (permission !== "granted") {
            permission = await savedHandle.queryPermission?.({ mode: "read" });
          }
          if (permission === "granted") {
            await loadDirectory(savedHandle, false);
          }
        }
      } catch {
        // Failed to restore - user can select manually
      }
    };

    tryRestoreFolder();
  }, [loadDirectory]);

  return {
    files,
    folderName,
    isScanning,
    currentDirHandle: currentDirHandle.current,
    handleSelectFolder,
    handleRefresh,
    handleDeleteFile,
  };
}
