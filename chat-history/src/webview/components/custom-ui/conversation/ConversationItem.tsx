import type { FC } from "react";
import type { Conversation } from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import { AssistantConversationContent } from "./AssistantConversationContent";
import { FileHistorySnapshotConversationContent } from "./FileHistorySnapshotConversationContent";
import { MetaConversationContent } from "./MetaConversationContent";
import { QueueOperationConversationContent } from "./QueueOperationConversationContent";
import { SummaryConversationContent } from "./SummaryConversationContent";
import { SystemConversationContent } from "./SystemConversationContent";
import { UserConversationContent } from "./UserConversationContent";

export const ConversationItem: FC<{
  conversation: Conversation;
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
}> = ({ conversation, getToolResult }) => {
  if (conversation.type === "summary") {
    return <SummaryConversationContent>{conversation.summary}</SummaryConversationContent>;
  }

  if (conversation.type === "system") {
    return <SystemConversationContent>{conversation.content}</SystemConversationContent>;
  }

  if (conversation.type === "file-history-snapshot") {
    return <FileHistorySnapshotConversationContent conversation={conversation} />;
  }

  if (conversation.type === "queue-operation") {
    return <QueueOperationConversationContent conversation={conversation} />;
  }

  if (conversation.type === "user") {
    const userConversationJsx =
      typeof conversation.message.content === "string" ? (
        <UserConversationContent
          content={conversation.message.content}
          id={`message-${conversation.uuid}`}
        />
      ) : (
        <ul className="w-full" id={`message-${conversation.uuid}`}>
          {conversation.message.content.map((content, index) => (
            <li key={`${conversation.uuid}-${index}`}>
              <UserConversationContent content={content} />
            </li>
          ))}
        </ul>
      );

    return conversation.isMeta === true ? (
      <MetaConversationContent>{userConversationJsx}</MetaConversationContent>
    ) : (
      userConversationJsx
    );
  }

  if (conversation.type === "assistant") {
    return (
      <ul className="w-full">
        {conversation.message.content.map((content, index) => (
          <li key={`${conversation.uuid}-${index}`}>
            <AssistantConversationContent content={content} getToolResult={getToolResult} />
          </li>
        ))}
      </ul>
    );
  }

  return null;
};
