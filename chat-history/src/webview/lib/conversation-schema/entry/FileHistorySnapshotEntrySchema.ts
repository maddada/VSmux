import { z } from "zod";

export const FileBackupEntrySchema = z.object({
  backupFileName: z.string().nullable(),
  version: z.number(),
  backupTime: z.string(),
});

export type FileBackupEntry = z.infer<typeof FileBackupEntrySchema>;

export const FileHistorySnapshotEntrySchema = z.object({
  // discriminator
  type: z.literal("file-history-snapshot"),

  // required
  messageId: z.string(),
  snapshot: z.object({
    messageId: z.string(),
    trackedFileBackups: z.record(z.string(), FileBackupEntrySchema),
    timestamp: z.string(),
  }),
  isSnapshotUpdate: z.boolean(),
});

export type FileHistorySnapshotEntry = z.infer<typeof FileHistorySnapshotEntrySchema>;
