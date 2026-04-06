import { useState, useMemo, type FC } from "react";
import type { UseDirectoryHandleReturn } from "@/hooks/useDirectoryHandle";
import type { JsonlFile } from "@/lib/directory-utils";
import {
  SidebarHeader,
  SidebarSearch,
  FolderSection,
  CollapsedSidebar,
  DeleteConversationDialog,
} from "./sidebar-components";

type SidebarProps = {
  onFileSelect: (file: File, jsonlFile?: JsonlFile) => void;
  selectedFile: string | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  directoryHandle: UseDirectoryHandleReturn;
};

export const Sidebar: FC<SidebarProps> = ({
  onFileSelect,
  selectedFile,
  isDarkMode,
  onToggleDarkMode,
  directoryHandle,
}) => {
  const {
    files,
    folderName,
    isScanning,
    currentDirHandle,
    handleSelectFolder,
    handleRefresh,
    handleDeleteFile,
  } = directoryHandle;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [deleteDialogFile, setDeleteDialogFile] = useState<JsonlFile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const query = searchQuery.toLowerCase().trim();
    return files.filter(
      (file) =>
        file.name.toLowerCase().includes(query) ||
        file.summary.toLowerCase().includes(query) ||
        file.folder.toLowerCase().includes(query),
    );
  }, [files, searchQuery]);

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const filesByFolder = filteredFiles.reduce(
    (acc, file) => {
      if (!acc[file.folder]) {
        acc[file.folder] = [];
      }
      acc[file.folder].push(file);
      return acc;
    },
    {} as Record<string, JsonlFile[]>,
  );

  const handleConfirmDelete = async (file: JsonlFile) => {
    await handleDeleteFile(file);
    setDeleteDialogFile(null);
  };

  if (isCollapsed) {
    return (
      <CollapsedSidebar
        isDarkMode={isDarkMode}
        onExpand={() => setIsCollapsed(false)}
        onToggleDarkMode={onToggleDarkMode}
      />
    );
  }

  const folderEntries = Object.entries(filesByFolder);

  return (
    <>
      <div className="w-72 h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 transition-all duration-300 ease-in-out">
        <SidebarHeader
          isScanning={isScanning}
          hasDirectory={!!currentDirHandle}
          isDarkMode={isDarkMode}
          onSelectFolder={handleSelectFolder}
          onRefresh={handleRefresh}
          onToggleDarkMode={onToggleDarkMode}
          onCollapse={() => setIsCollapsed(true)}
        />

        {folderName && (
          <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-sidebar-border/50">
            {folderName}
          </div>
        )}

        {files.length > 0 && <SidebarSearch value={searchQuery} onChange={setSearchQuery} />}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-2">
            {files.length === 0 && !isScanning && (
              <div className="text-sm text-muted-foreground text-center py-8 px-4">
                Select a folder to find .jsonl files
              </div>
            )}

            {isScanning && (
              <div className="text-sm text-muted-foreground text-center py-8">
                Scanning for .jsonl files...
              </div>
            )}

            {files.length > 0 && filteredFiles.length === 0 && searchQuery && (
              <div className="text-sm text-muted-foreground text-center py-8 px-4">
                No files match "{searchQuery}"
              </div>
            )}

            {folderEntries.map(([folder, folderFiles]) => {
              const isExpanded = searchQuery ? true : expandedFolders.has(folder);
              return (
                <FolderSection
                  key={folder}
                  folder={folder}
                  files={folderFiles}
                  isExpanded={isExpanded}
                  selectedFile={selectedFile}
                  onToggle={() => toggleFolder(folder)}
                  onFileSelect={onFileSelect}
                  onFileDelete={setDeleteDialogFile}
                />
              );
            })}

            {files.length > 0 && (
              <div className="text-xs text-muted-foreground/60 text-center py-2">
                {searchQuery ? (
                  <>
                    {filteredFiles.length} of {files.length} file{files.length !== 1 ? "s" : ""}
                  </>
                ) : (
                  <>
                    {files.length} file{files.length !== 1 ? "s" : ""} in {folderEntries.length}{" "}
                    project{folderEntries.length !== 1 ? "s" : ""}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <DeleteConversationDialog
        file={deleteDialogFile}
        onClose={() => setDeleteDialogFile(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};
