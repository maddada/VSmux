import { type FC } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FileItem } from "./FileItem";
import { cleanFolderName } from "@/lib/format-utils";
import type { JsonlFile } from "@/lib/directory-utils";

interface FolderSectionProps {
  folder: string;
  files: JsonlFile[];
  isExpanded: boolean;
  selectedFile: string | null;
  onToggle: () => void;
  onFileSelect: (file: File, jsonlFile?: JsonlFile) => void;
  onFileDelete: (file: JsonlFile) => void;
}

export const FolderSection: FC<FolderSectionProps> = ({
  folder,
  files,
  isExpanded,
  selectedFile,
  onToggle,
  onFileSelect,
  onFileDelete,
}) => {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-2 py-1.5 hover:bg-sidebar-accent rounded-lg transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span
          className="text-[11px] font-medium text-muted-foreground truncate flex-1 text-left"
          title={folder}
        >
          {cleanFolderName(folder)}
        </span>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">{files.length}</span>
      </button>
      {isExpanded && (
        <div className="ml-3 border-l border-sidebar-border pl-2">
          {files.map((file) => (
            <FileItem
              key={file.path}
              file={file}
              isSelected={selectedFile === file.name}
              onSelect={() => onFileSelect(file.file, file)}
              onDelete={() => onFileDelete(file)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
