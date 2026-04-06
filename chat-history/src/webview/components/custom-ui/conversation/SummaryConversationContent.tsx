import { ChevronDown } from "lucide-react";
import { type FC, type PropsWithChildren, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const SummaryConversationContent: FC<PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className="w-full flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded p-2 -mx-2 mb-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h4 className="text-xs font-medium text-muted-foreground">Summarized</h4>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-background rounded border p-3 mt-2">
          <pre className="text-xs overflow-x-auto">{children}</pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
