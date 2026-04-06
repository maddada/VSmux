import { getCachedFile, cacheFile } from "@/lib/cache";

const HANDLE_STORAGE_KEY = "convo-viewer-dir-handle";
export const MIN_FILE_SIZE = 1 * 1024; // 1KB minimum

export interface JsonlFile {
  name: string;
  path: string;
  file: File;
  folder: string;
  size: number;
  summary: string;
  lastModified: number;
  parentDirHandle: FileSystemDirectoryHandle;
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_STORAGE_KEY, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("handles");
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "directory");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_STORAGE_KEY, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("handles");
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("handles", "readonly");
      const getRequest = tx.objectStore("handles").get("directory");
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

function extractSummary(content: string): string {
  const lines = content.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      if (entry.type !== "user" || !entry.message?.content) continue;

      let text = "";
      const msgContent = entry.message.content;

      if (typeof msgContent === "string") {
        text = msgContent;
      } else if (Array.isArray(msgContent)) {
        const textBlock = msgContent.find(
          (b: { type: string; text?: string }) => b.type === "text" && b.text,
        );
        if (textBlock?.text) {
          text = textBlock.text;
        }
      }

      if (!text) continue;
      if (text.startsWith("<command")) continue;
      if (text.startsWith("<ide_opened_file>")) continue;
      if (text.startsWith("<local-")) continue;
      if (text.startsWith("[Tool Result]")) continue;
      if (text.startsWith("Caveat:")) continue;
      if (text.includes("tool_use_id")) continue;

      const cleaned = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

      if (cleaned.length > 0) {
        return cleaned.slice(0, 100);
      }
    } catch {
      continue;
    }
  }

  return "";
}

export async function scanDirectoryForJsonl(
  dirHandle: FileSystemDirectoryHandle,
  parentPath: string = "",
): Promise<JsonlFile[]> {
  const files: JsonlFile[] = [];

  for await (const entry of dirHandle.values()) {
    const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.kind === "directory") {
      const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
      const subFiles = await scanDirectoryForJsonl(subDirHandle, currentPath);
      files.push(...subFiles);
    } else if (entry.kind === "file" && entry.name.endsWith(".jsonl")) {
      const fileHandle = await dirHandle.getFileHandle(entry.name);
      const file = await fileHandle.getFile();

      if (file.size >= MIN_FILE_SIZE) {
        let summary = "";

        const cached = getCachedFile(currentPath, file.size, file.lastModified);
        if (cached) {
          summary = cached.summary;
        } else {
          const chunk = file.slice(0, 50 * 1024);
          const text = await chunk.text();
          summary = extractSummary(text);

          cacheFile(
            currentPath,
            parentPath || "(root)",
            entry.name,
            file.size,
            file.lastModified,
            summary,
          );
        }

        files.push({
          name: entry.name,
          path: currentPath,
          file,
          folder: parentPath || "(root)",
          size: file.size,
          summary,
          lastModified: file.lastModified,
          parentDirHandle: dirHandle,
        });
      }
    }
  }

  return files;
}
