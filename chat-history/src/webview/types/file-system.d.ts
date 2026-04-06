interface FileSystemHandle {
  kind: "file" | "directory";
  name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: "file";
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: "directory";
  values(): AsyncIterableIterator<FileSystemHandle>;
  getFileHandle(name: string): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string): Promise<void>;
  queryPermission?(options: {
    mode: "read" | "readwrite";
  }): Promise<"granted" | "denied" | "prompt">;
}

interface DirectoryPickerOptions {
  id?: string;
  startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
  mode?: "read" | "readwrite";
}

interface Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}
