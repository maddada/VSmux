import type { Conversation } from "./conversation-schema";

type TextContent = { type: "text"; text: string };
type ThinkingContent = { type: "thinking"; thinking: string };
type ToolUseContent = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
type ImageContent = {
  type: "image";
  source: { type: string; media_type: string; data: string };
};
type DocumentContent = {
  type: "document";
  source: { type: string; media_type: string; data: string };
};
type ToolResultContent = {
  type: "tool_result";
  tool_use_id: string;
  content: string | Array<TextContent | ImageContent>;
  is_error?: boolean;
};

type UserMessageContent = string | TextContent | ImageContent | DocumentContent | ToolResultContent;
type AssistantMessageContent = TextContent | ThinkingContent | ToolUseContent | ToolResultContent;

function extractTextFromUserContent(content: UserMessageContent | string): string {
  if (typeof content === "string") {
    return content;
  }

  switch (content.type) {
    case "text":
      return content.text;
    case "image":
      return "[Image]";
    case "document":
      return "[Document]";
    case "tool_result": {
      const resultContent = content.content;
      if (typeof resultContent === "string") {
        return `Tool Result:\n${resultContent}`;
      }
      return `Tool Result:\n${resultContent
        .map((c) => (c.type === "text" ? c.text : "[Image]"))
        .join("\n")}`;
    }
    default:
      return "";
  }
}

function extractTextFromAssistantContent(content: AssistantMessageContent): string {
  switch (content.type) {
    case "text":
      return content.text;
    case "thinking":
      return `<thinking>\n${content.thinking}\n</thinking>`;
    case "tool_use":
      return `**Tool: ${content.name}**\n\`\`\`json\n${JSON.stringify(content.input, null, 2)}\n\`\`\``;
    case "tool_result": {
      const resultContent = content.content;
      if (typeof resultContent === "string") {
        return `Tool Result:\n${resultContent}`;
      }
      return `Tool Result:\n${resultContent
        .map((c) => (c.type === "text" ? c.text : "[Image]"))
        .join("\n")}`;
    }
    default:
      return "";
  }
}

export function conversationToMarkdown(conversation: Conversation): string {
  switch (conversation.type) {
    case "user": {
      const content = conversation.message.content;
      if (typeof content === "string") {
        return `## User\n\n${content}`;
      }
      const parts = content.map((c) => extractTextFromUserContent(c));
      return `## User\n\n${parts.join("\n\n")}`;
    }

    case "assistant": {
      const parts = conversation.message.content.map((c) =>
        extractTextFromAssistantContent(c as AssistantMessageContent),
      );
      return `## Assistant\n\n${parts.join("\n\n")}`;
    }

    case "system":
      return `## System\n\n${conversation.content}`;

    case "summary":
      return `## Summary\n\n${conversation.summary}`;

    case "file-history-snapshot":
      return `## File History Snapshot\n\n\`\`\`json\n${JSON.stringify(conversation.snapshot, null, 2)}\n\`\`\``;

    case "queue-operation":
      return `## Queue Operation: ${conversation.operation}\n\nSession: ${conversation.sessionId}\nTimestamp: ${conversation.timestamp}`;

    default:
      return "";
  }
}
