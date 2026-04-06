import { type FC } from "react";
import { ChevronRight, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CollapsedSidebarProps {
  isDarkMode: boolean;
  onExpand: () => void;
  onToggleDarkMode: () => void;
}

export const CollapsedSidebar: FC<CollapsedSidebarProps> = ({
  isDarkMode,
  onExpand,
  onToggleDarkMode,
}) => {
  return (
    <div className="w-12 h-screen bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3 gap-2 transition-all duration-300 ease-in-out">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onExpand}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent side="right">Expand sidebar</TooltipContent>
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
        <TooltipContent side="right">{isDarkMode ? "Light mode" : "Dark mode"}</TooltipContent>
      </Tooltip>
    </div>
  );
};
