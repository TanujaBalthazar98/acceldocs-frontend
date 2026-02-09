import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AddPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string | null;
  projectName?: string | null;
  projectVersionId?: string | null;
  topicId?: string | null;
  topicName?: string | null;
  parentFolderId: string | null;
  organizationId?: string | null;
  onCreated?: (doc: { id: string; name: string; google_doc_id: string }) => void;
}

export const AddPageDialog = ({
  open,
  onOpenChange,
  projectName,
  topicName,
}: AddPageDialogProps) => {
  const locationText = topicName
    ? `${projectName} / ${topicName}`
    : projectName || "current project";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Add Page
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Pages live in your connected Google Drive and sync into Docspeare.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            To add a page in <span className="font-medium text-foreground">{locationText}</span>:
          </p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Open the project’s Drive folder (and topic subfolder if applicable).</li>
            <li>Create a new Google Doc there or move an existing one.</li>
            <li>Click “Sync from Drive” in Docspeare to pull the latest changes.</li>
          </ol>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
