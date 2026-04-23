import { Check, Copy } from "lucide-react";
import { type FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type CopyMessageButtonProps = {
  getMarkdown: () => string;
};

export const CopyMessageButton: FC<CopyMessageButtonProps> = ({ getMarkdown }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const markdown = getMarkdown();
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCopy}
            className="copy-cursor opacity-0 group-hover/message:opacity-100 transition-opacity"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        }
      />
      <TooltipContent side="top">{copied ? "Copied!" : "Copy as markdown"}</TooltipContent>
    </Tooltip>
  );
};
