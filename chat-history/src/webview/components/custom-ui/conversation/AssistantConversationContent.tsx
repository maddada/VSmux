import { ChevronDown, Lightbulb, Wrench } from "lucide-react";
import { type FC, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import type { AssistantMessageContent } from "@/lib/conversation-schema/message/AssistantMessageSchema";
import { MarkdownContent } from "../MarkdownContent";
import { ToolInputOneLine } from "./ToolInputOneLine";

export const AssistantConversationContent: FC<{
  content: AssistantMessageContent;
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
}> = ({ content, getToolResult }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (content.type === "text") {
    return (
      <div className="w-full mx-1 sm:mx-2 my-4 sm:my-6">
        <MarkdownContent content={content.text} />
      </div>
    );
  }

  if (content.type === "thinking") {
    return (
      <Card className="bg-muted/50 border-dashed gap-2 py-3 mb-2 hover:shadow-sm transition-all duration-200">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger
            className="w-full cursor-pointer hover:bg-muted/80 rounded-t-lg transition-all duration-200 py-0 px-4"
            onClick={() => setIsOpen(!isOpen)}
          >
            <CardHeader className="py-0 px-0">
              <div className="flex items-center gap-2">
                <Lightbulb
                  className={`h-4 w-4 text-muted-foreground ${isOpen ? "text-yellow-600" : ""} transition-colors`}
                />
                <CardTitle
                  className={`text-sm font-medium ${isOpen ? "text-foreground" : ""} transition-colors`}
                >
                  Thinking
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="py-2 px-4">
              <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                {content.thinking}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  if (content.type === "tool_use") {
    const toolResult = getToolResult(content.id);

    return (
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 mb-2 p-0 overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center min-w-0">
            <CollapsibleTrigger
              className="flex-1 min-w-0 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-all duration-200 px-3 py-1.5"
              onClick={() => setIsOpen(!isOpen)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div
                  className={`w-full min-w-0 text-sm font-medium ${isOpen ? "text-foreground" : ""} transition-colors overflow-hidden text-ellipsis whitespace-nowrap text-left`}
                >
                  {content.name}
                  {Object.keys(content.input).length > 0 && (
                    <span className="font-normal">
                      {" "}
                      (
                      <ToolInputOneLine input={content.input} />)
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""} flex-shrink-0`}
                />
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="space-y-3 py-3 px-4 border-t border-blue-200 dark:border-blue-800">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Tool ID</h4>
                <code className="text-xs bg-background/50 px-2 py-1 rounded border border-blue-200 dark:border-blue-800 font-mono">
                  {content.id}
                </code>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Input Parameters</h4>
                <SyntaxHighlighter
                  style={oneDark}
                  language="json"
                  PreTag="div"
                  className="text-xs rounded"
                >
                  {JSON.stringify(content.input, null, 2)}
                </SyntaxHighlighter>
              </div>
              {toolResult && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Result</h4>
                  <div className="bg-background rounded border p-3">
                    {typeof toolResult.content === "string" ? (
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                        {toolResult.content}
                      </pre>
                    ) : (
                      toolResult.content.map((item, index) => {
                        if (item.type === "image") {
                          return (
                            <img
                              key={`${item.source.data.slice(0, 20)}-${index}`}
                              src={`data:${item.source.media_type};base64,${item.source.data}`}
                              alt="Tool Result"
                            />
                          );
                        }
                        if (item.type === "text") {
                          return (
                            <pre
                              key={`${item.text.slice(0, 20)}-${index}`}
                              className="text-xs overflow-x-auto whitespace-pre-wrap break-words"
                            >
                              {item.text}
                            </pre>
                          );
                        }
                        return null;
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  if (content.type === "tool_result") {
    return null;
  }

  return null;
};
