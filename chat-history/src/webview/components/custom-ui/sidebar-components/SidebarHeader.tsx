import { type FC } from "react";
import { FolderOpen, RefreshCw, ChevronLeft, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarHeaderProps {
  isScanning: boolean;
  hasDirectory: boolean;
  isDarkMode: boolean;
  onSelectFolder: () => void;
  onRefresh: () => void;
  onToggleDarkMode: () => void;
  onCollapse: () => void;
}

export const SidebarHeader: FC<SidebarHeaderProps> = ({
  isScanning,
  hasDirectory,
  isDarkMode,
  onSelectFolder,
  onRefresh,
  onToggleDarkMode,
  onCollapse,
}) => {
  return (
    <div className="p-3 border-b border-sidebar-border flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={onSelectFolder}
              variant="ghost"
              size="icon-sm"
              disabled={isScanning}
              className="text-muted-foreground hover:text-foreground"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent side="bottom">Select folder</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              disabled={!hasDirectory || isScanning}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn("h-4 w-4", isScanning && "animate-spin")} />
            </Button>
          }
        />
        <TooltipContent side="bottom">Refresh</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleDarkMode}
              className="text-muted-foreground hover:text-foreground"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          }
        />
        <TooltipContent side="bottom">{isDarkMode ? "Light mode" : "Dark mode"}</TooltipContent>
      </Tooltip>
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onCollapse}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
};
