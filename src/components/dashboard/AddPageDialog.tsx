import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
  projectId,
  projectName,
  projectVersionId,
  topicId,
  topicName,
  parentFolderId,
  onCreated,
}: AddPageDialogProps) => {
  const { toast } = useToast();
  const { createDoc } = useGoogleDrive();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const locationText = topicName
    ? `${projectName} / ${topicName}`
    : projectName || "current project";

  const handleCreate = async () => {
    if (!title.trim() || !projectId || !parentFolderId) {
      return;
    }

    setIsCreating(true);
    try {
      const doc = await createDoc(title.trim(), parentFolderId);
      if (!doc) {
        return;
      }

      const { data: inserted, error } = await supabase
        .from("documents")
        .insert({
          google_doc_id: doc.id,
          project_id: projectId,
          project_version_id: projectVersionId || undefined,
          topic_id: topicId || null,
          title: doc.name,
          owner_id: user?.id || null,
          last_synced_at: new Date().toISOString(),
          google_modified_at: new Date().toISOString(),
        })
        .select("id, title, google_doc_id")
        .single();

      if (error || !inserted) {
        console.error("Error saving document:", error);
        toast({
          title: "Save failed",
          description: "We created the Google Doc but could not save it in Docspeare.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Page created",
        description: `Created "${inserted.title}" in ${locationText}.`,
      });
      setTitle("");
      onOpenChange(false);
      onCreated?.({
        id: inserted.id,
        name: inserted.title,
        google_doc_id: inserted.google_doc_id,
      });
    } finally {
      setIsCreating(false);
    }
  };

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

        {!parentFolderId && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            Connect Drive and select a project folder before creating pages.
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Page title</label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g., Getting Started"
            disabled={!projectId || !parentFolderId}
          />
          <p className="text-xs text-muted-foreground">
            A new Google Doc will be created in the Drive folder for {locationText}.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || !projectId || !parentFolderId || isCreating}
          >
            {isCreating ? "Creating..." : "Create Page"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
