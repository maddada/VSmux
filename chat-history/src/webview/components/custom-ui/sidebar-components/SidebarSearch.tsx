import { type FC } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export const SidebarSearch: FC<SidebarSearchProps> = ({ value, onChange }) => {
  return (
    <div className="px-2 py-2 border-b border-sidebar-border/50">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Filter files..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 pl-8 pr-8 text-xs bg-sidebar-accent/50"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
