import { ChevronDown, Info } from "lucide-react";
import { type FC, type PropsWithChildren, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const MetaConversationContent: FC<PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className="w-full flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded p-2 -mx-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Info className="h-3 w-3 text-muted-foreground" />
          <h4 className="text-xs font-medium text-muted-foreground">Meta Information</h4>
        </div>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
};
