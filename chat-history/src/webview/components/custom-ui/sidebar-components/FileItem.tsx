import { useState, type FC } from "react";
import { Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatFileSize, formatDate } from "@/lib/format-utils";
import type { JsonlFile } from "@/lib/directory-utils";

interface FileItemProps {
  file: JsonlFile;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export const FileItem: FC<FileItemProps> = ({ file, isSelected, onSelect, onDelete }) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={onSelect}
              onContextMenu={handleContextMenu}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors",
                isSelected
                  ? "bg-sidebar-primary/10 text-sidebar-primary"
                  : "text-foreground hover:bg-sidebar-accent",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="flex-1 truncate">
                  {file.summary || file.name.replace(".jsonl", "")}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </span>
            </button>
          }
        />
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-xs mb-1">{file.summary || "No summary"}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{file.name}</p>
          <p className="text-[10px] text-muted-foreground/80 mt-1">
            {formatDate(file.lastModified)}
          </p>
        </TooltipContent>
      </Tooltip>
      {showContextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setShowContextMenu(false)}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowContextMenu(false);
          }}
        >
          <div
            className="absolute z-50 bg-popover border border-border rounded-xl shadow-lg py-1 min-w-40"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onDelete();
                setShowContextMenu(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete conversation
            </button>
          </div>
        </div>
      )}
    </>
  );
};
