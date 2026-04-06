import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { QueueOperationEntry } from "@/lib/conversation-schema/entry/QueueOperationEntrySchema";

export const QueueOperationConversationContent: FC<{
  conversation: QueueOperationEntry;
}> = ({ conversation }) => {
  const isEnqueue = conversation.operation === "enqueue";

  return (
    <Card
      className={`gap-2 py-3 mb-2 ${
        isEnqueue
          ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20"
          : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/20"
      }`}
    >
      <CardHeader className="py-0 px-4">
        <div className="flex items-center gap-2">
          {isEnqueue ? (
            <ArrowDownToLine className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <ArrowUpFromLine className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          )}
          <CardTitle className="text-sm font-medium">
            Queue {isEnqueue ? "Enqueue" : "Dequeue"}
          </CardTitle>
          <Badge
            variant="outline"
            className={
              isEnqueue
                ? "border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-300"
                : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
            }
          >
            {conversation.sessionId.slice(0, 8)}...
          </Badge>
        </div>
      </CardHeader>
    </Card>
  );
};
