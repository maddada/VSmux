import { ChevronRight, File, History } from "lucide-react";
import { type FC, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { FileHistorySnapshotEntry } from "@/lib/conversation-schema/entry/FileHistorySnapshotEntrySchema";

export const FileHistorySnapshotConversationContent: FC<{
  conversation: FileHistorySnapshotEntry;
}> = ({ conversation }) => {
  const [isOpen, setIsOpen] = useState(false);
  const files = Object.entries(conversation.snapshot.trackedFileBackups);
  const fileCount = files.length;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 gap-0 py-0 mb-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full cursor-pointer">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2">
              <ChevronRight
                className={`h-4 w-4 text-amber-600 dark:text-amber-400 transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
              <History className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm font-medium">File History Snapshot</CardTitle>
              <Badge
                variant="outline"
                className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
              >
                {fileCount} {fileCount === 1 ? "file" : "files"}
              </Badge>
              {conversation.isSnapshotUpdate && (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                >
                  Update
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground font-mono">
                {formatTime(conversation.snapshot.timestamp)}
              </span>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-4">
            <div className="space-y-3">
              {/* Metadata */}
              <div className="text-xs text-muted-foreground space-y-1 border-b border-amber-200 dark:border-amber-800 pb-2">
                <div className="flex gap-4">
                  <span>
                    <span className="font-medium">Message ID:</span>{" "}
                    <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">
                      {conversation.messageId.slice(0, 8)}...
                    </code>
                  </span>
                  <span>
                    <span className="font-medium">Snapshot ID:</span>{" "}
                    <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">
                      {conversation.snapshot.messageId.slice(0, 8)}...
                    </code>
                  </span>
                </div>
                <div>
                  <span className="font-medium">Timestamp:</span>{" "}
                  {formatDateTime(conversation.snapshot.timestamp)}
                </div>
              </div>

              {/* File list */}
              {fileCount > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Tracked Files:
                  </div>
                  <div className="space-y-1">
                    {files.map(([filePath, backup]) => (
                      <div
                        key={filePath}
                        className="flex items-start gap-2 text-xs bg-amber-100/50 dark:bg-amber-900/30 rounded p-2"
                      >
                        <File className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-amber-900 dark:text-amber-100 break-all">
                            {filePath}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-muted-foreground">
                            <span>
                              <span className="font-medium">Version:</span> {backup.version}
                            </span>
                            {backup.backupFileName && (
                              <span>
                                <span className="font-medium">Backup:</span>{" "}
                                <code className="bg-amber-200/50 dark:bg-amber-800/50 px-1 rounded">
                                  {backup.backupFileName}
                                </code>
                              </span>
                            )}
                            <span>
                              <span className="font-medium">Backed up:</span>{" "}
                              {formatDateTime(backup.backupTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  No files tracked in this snapshot
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
