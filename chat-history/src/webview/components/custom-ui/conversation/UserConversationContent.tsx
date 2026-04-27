import { AlertCircle, ChevronDown, FileText, Image as ImageIcon } from "lucide-react";
import { type FC, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { UserMessageContent } from "@/lib/conversation-schema/message/UserMessageSchema";
import { UserTextContent } from "./UserTextContent";

export const UserConversationContent: FC<{
  content: UserMessageContent;
  id?: string;
}> = ({ content, id }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (typeof content === "string") {
    return <UserTextContent text={content} id={id} />;
  }

  if (content.type === "text") {
    return <UserTextContent text={content.text} id={id} />;
  }

  if (content.type === "image") {
    if (content.source.type === "base64") {
      return (
        <Card
          className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20 mb-2 p-0 overflow-hidden"
          id={id}
        >
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger
              className="w-full cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-colors px-3 py-1.5"
              onClick={() => setIsOpen(!isOpen)}
            >
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium">Image</span>
                <Badge
                  variant="outline"
                  className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300"
                >
                  {content.source.media_type}
                </Badge>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ml-auto ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="py-3 px-4 border-t border-purple-200 dark:border-purple-800">
                <div className="rounded-lg border overflow-hidden bg-background">
                  <img
                    src={`data:${content.source.media_type};base64,${content.source.data}`}
                    alt="User uploaded content"
                    className="max-w-full h-auto max-h-96 object-contain"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      );
    }

    return (
      <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20" id={id}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <CardTitle className="text-sm font-medium">Unsupported Media</CardTitle>
            <Badge variant="destructive">Error</Badge>
          </div>
          <CardDescription className="text-xs">
            This media type is not supported for display.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (content.type === "document") {
    if (content.source.type === "base64") {
      if (content.source.media_type === "application/pdf") {
        return (
          <Card
            className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 mb-2 p-0 overflow-hidden"
            id={id}
          >
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger
                className="w-full cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors px-3 py-1.5"
                onClick={() => setIsOpen(!isOpen)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium">PDF Document</span>
                  <Badge
                    variant="outline"
                    className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
                  >
                    {content.source.media_type}
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ml-auto ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="py-3 px-4 border-t border-blue-200 dark:border-blue-800">
                  <div className="rounded-lg border overflow-hidden bg-background">
                    <embed
                      src={`data:${content.source.media_type};base64,${content.source.data}`}
                      type="application/pdf"
                      className="w-full h-[600px]"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      }
    }

    if (content.source.type === "text") {
      return (
        <Card
          className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 mb-2 p-0 overflow-hidden"
          id={id}
        >
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger
              className="w-full cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-900/20 transition-colors px-3 py-1.5"
              onClick={() => setIsOpen(!isOpen)}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium">Text Document</span>
                <Badge
                  variant="outline"
                  className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-300"
                >
                  {content.source.media_type}
                </Badge>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ml-auto ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="py-3 px-4 border-t border-green-200 dark:border-green-800">
                <div className="rounded-lg border overflow-hidden bg-background">
                  <pre className="p-4 text-sm overflow-auto scroll-mask max-h-96">
                    {content.source.data}
                  </pre>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      );
    }

    return (
      <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20" id={id}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <CardTitle className="text-sm font-medium">Unsupported Document</CardTitle>
            <Badge variant="destructive">Error</Badge>
          </div>
          <CardDescription className="text-xs">
            This document type is not supported for display.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (content.type === "tool_result") {
    return null;
  }

  return null;
};
