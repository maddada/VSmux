import { Check, Save } from "lucide-react";
import { type FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SaveMessageButtonProps = {
  getMarkdown: () => string;
  getFilename: () => string;
};

export const SaveMessageButton: FC<SaveMessageButtonProps> = ({ getMarkdown, getFilename }) => {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const markdown = getMarkdown();
    const filename = getFilename();

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleSave}
            className="opacity-0 group-hover/message:opacity-100 transition-opacity"
          >
            {saved ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Save className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        }
      />
      <TooltipContent side="top">{saved ? "Saved!" : "Save as markdown"}</TooltipContent>
    </Tooltip>
  );
};
