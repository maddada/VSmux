import { type FC } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { JsonlFile } from "@/lib/directory-utils";

interface DeleteConversationDialogProps {
  file: JsonlFile | null;
  onClose: () => void;
  onConfirm: (file: JsonlFile) => void;
}

export const DeleteConversationDialog: FC<DeleteConversationDialogProps> = ({
  file,
  onClose,
  onConfirm,
}) => {
  return (
    <AlertDialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the conversation file. This action cannot be undone.
            <br />
            <br />
            <span className="font-medium">{file?.summary || file?.name}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => file && onConfirm(file)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
