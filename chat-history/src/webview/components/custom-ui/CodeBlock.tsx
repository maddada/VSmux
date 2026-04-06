import { useState, type FC, type ReactNode } from "react";
import { WrapText, AlignLeft, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CodeBlockProps = {
  children: ReactNode;
  language?: string;
  className?: string;
};

export const CodeBlock: FC<CodeBlockProps> = ({ children, language, className }) => {
  const [wordWrap, setWordWrap] = useState(true);
  const [copied, setCopied] = useState(false);

  const codeContent =
    typeof children === "string" ? children : (children?.toString().replace(/\n$/, "") ?? "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className={cn("relative my-4 rounded-lg border border-border overflow-hidden", className)}>
      <div className="flex items-center justify-between bg-muted/30 px-3 py-1.5 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setWordWrap(!wordWrap)}
            title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
          >
            {wordWrap ? <AlignLeft className="h-4 w-4" /> : <WrapText className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            title="Copy code"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "bg-muted/20 p-4 text-sm font-mono",
          wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto",
        )}
      >
        <code className="text-foreground">{children}</code>
      </div>
    </div>
  );
};
