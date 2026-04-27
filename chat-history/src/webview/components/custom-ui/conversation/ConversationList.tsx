import { AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
import { type FC, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Conversation, ErrorJsonl } from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import { conversationToMarkdown } from "@/lib/conversation-to-markdown";
import { ConversationItem } from "./ConversationItem";
import { CopyMessageButton } from "./CopyMessageButton";
import { SaveMessageButton } from "./SaveMessageButton";

const getConversationFilename = (conversation: Conversation): string => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

  switch (conversation.type) {
    case "user":
      return `user-message-${conversation.uuid.slice(0, 8)}-${timestamp}.md`;
    case "assistant":
      return `assistant-message-${conversation.uuid.slice(0, 8)}-${timestamp}.md`;
    case "system":
      return `system-message-${conversation.uuid.slice(0, 8)}-${timestamp}.md`;
    case "summary":
      return `summary-${conversation.leafUuid.slice(0, 8)}-${timestamp}.md`;
    case "file-history-snapshot":
      return `file-snapshot-${conversation.messageId.slice(0, 8)}-${timestamp}.md`;
    case "queue-operation":
      return `queue-op-${conversation.operation}-${timestamp}.md`;
    default:
      return `message-${timestamp}.md`;
  }
};

const getConversationKey = (conversation: Conversation) => {
  if (conversation.type === "user") {
    return `user_${conversation.uuid}`;
  }

  if (conversation.type === "assistant") {
    return `assistant_${conversation.uuid}`;
  }

  if (conversation.type === "system") {
    return `system_${conversation.uuid}`;
  }

  if (conversation.type === "summary") {
    return `summary_${conversation.leafUuid}`;
  }

  if (conversation.type === "file-history-snapshot") {
    return `file-history-snapshot_${conversation.messageId}`;
  }

  if (conversation.type === "queue-operation") {
    return `queue-operation_${conversation.operation}_${conversation.sessionId}_${conversation.timestamp}`;
  }

  return `unknown_${Math.random()}`;
};

const SchemaErrorDisplay: FC<{ errorLine: string }> = ({ errorLine }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li className="w-full flex justify-start">
      <div className="w-full max-w-3xl lg:max-w-4xl sm:w-[90%] md:w-[85%] px-2">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger
            className="w-full flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded p-2 -mx-2 border-l-2 border-red-400"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-xs font-medium text-red-600">Schema Error</span>
            </div>
            <ChevronDown
              className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-background rounded border border-red-200 dark:border-red-800 p-3 mt-2">
              <div className="space-y-3">
                <Alert
                  variant="destructive"
                  className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-red-800 dark:text-red-300">
                    Schema Validation Error
                  </AlertTitle>
                  <AlertDescription className="text-red-700 dark:text-red-400">
                    This entry could not be parsed. Report Issue
                    <ExternalLink className="h-3 w-3" />
                  </AlertDescription>
                </Alert>
                <div className="bg-muted border rounded px-3 py-2">
                  <h5 className="text-xs font-medium text-muted-foreground mb-2">Raw Content</h5>
                  <pre className="text-xs overflow-x-auto scroll-mask-x whitespace-pre-wrap break-all font-mono text-foreground">
                    {errorLine}
                  </pre>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </li>
  );
};

type ConversationListProps = {
  conversations: (Conversation | ErrorJsonl)[];
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
};

// Check if a user message contains actual user text (not just tool results)
const isUserTextMessage = (conversation: Conversation): boolean => {
  if (conversation.type !== "user") return false;
  const content = conversation.message.content;
  if (typeof content === "string") return content.trim().length > 0;
  if (Array.isArray(content)) {
    return content.some((item) => {
      if (typeof item === "string") return item.trim().length > 0;
      if (item.type === "text") return item.text.trim().length > 0;
      return false;
    });
  }
  return false;
};

export const ConversationList: FC<ConversationListProps> = ({ conversations, getToolResult }) => {
  // Detect if this is an "agent file" where all messages are sidechain
  // In that case, we should show all messages instead of filtering them out
  const isAgentFile = useMemo(() => {
    const nonSpecialConvos = conversations.filter(
      (c) =>
        c.type !== "x-error" &&
        c.type !== "summary" &&
        c.type !== "file-history-snapshot" &&
        c.type !== "queue-operation",
    );
    if (nonSpecialConvos.length === 0) return false;
    return nonSpecialConvos.every((c) => c.isSidechain === true);
  }, [conversations]);

  // Build a set of assistant message indices that are "final responses"
  // (i.e., the last assistant message before a user text message)
  const finalResponseIndices = useMemo(() => {
    const indices = new Set<number>();
    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      if (conv.type !== "user" || !isUserTextMessage(conv)) continue;

      // Look backwards to find the last assistant message
      for (let j = i - 1; j >= 0; j--) {
        const prev = conversations[j];
        if (prev.type === "assistant") {
          indices.add(j);
          break;
        }
        // Skip over non-message types
        if (
          prev.type === "x-error" ||
          prev.type === "summary" ||
          prev.type === "file-history-snapshot" ||
          prev.type === "queue-operation"
        ) {
          continue;
        }
        // If we hit another user message, stop looking
        if (prev.type === "user") break;
      }
    }
    // Also mark the very last assistant message as final
    for (let i = conversations.length - 1; i >= 0; i--) {
      if (conversations[i].type === "assistant") {
        indices.add(i);
        break;
      }
    }
    return indices;
  }, [conversations]);

  return (
    <ul className="space-y-2">
      {conversations.flatMap((conversation, index) => {
        if (conversation.type === "x-error") {
          return (
            <SchemaErrorDisplay key={`error_${conversation.line}`} errorLine={conversation.line} />
          );
        }

        const elm = (
          <ConversationItem
            key={getConversationKey(conversation)}
            conversation={conversation}
            getToolResult={getToolResult}
          />
        );

        const isSidechain =
          conversation.type !== "summary" &&
          conversation.type !== "file-history-snapshot" &&
          conversation.type !== "queue-operation" &&
          conversation.isSidechain;

        // Only filter out sidechain messages if this is NOT an agent file
        if (isSidechain && !isAgentFile) {
          return [];
        }

        const isLeftAligned =
          isSidechain ||
          conversation.type === "assistant" ||
          conversation.type === "system" ||
          conversation.type === "summary";

        // Determine navigation data attributes
        const isRealUserMessage = isUserTextMessage(conversation);
        const isFinalResponse = finalResponseIndices.has(index);

        return [
          <li
            className={`w-full flex ${
              isLeftAligned ? "justify-start" : "justify-end"
            } animate-in fade-in slide-in-from-bottom-2 duration-300`}
            key={getConversationKey(conversation)}
            data-message-type={conversation.type}
            data-user-text-message={isRealUserMessage ? "true" : undefined}
            data-final-response={isFinalResponse ? "true" : undefined}
          >
            <div className="w-full max-w-3xl lg:max-w-4xl sm:w-[90%] md:w-[85%] group/message relative">
              <div
                className={`absolute top-0 ${isLeftAligned ? "-right-8" : "-left-8"} z-10 flex flex-col gap-1`}
              >
                <CopyMessageButton getMarkdown={() => conversationToMarkdown(conversation)} />
                <SaveMessageButton
                  getMarkdown={() => conversationToMarkdown(conversation)}
                  getFilename={() => getConversationFilename(conversation)}
                />
              </div>
              {elm}
            </div>
          </li>,
        ];
      })}
    </ul>
  );
};
