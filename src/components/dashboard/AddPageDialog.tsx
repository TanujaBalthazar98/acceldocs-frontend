import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FilePlus } from "lucide-react";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string | null;
  projectName?: string | null;
  topicId?: string | null;
  topicName?: string | null;
  parentFolderId: string | null;
  onCreated?: (doc: { id: string; name: string; google_doc_id: string }) => void;
}

export const AddPageDialog = ({ 
  open, 
  onOpenChange, 
  projectId,
  projectName, 
  topicId,
  topicName, 
  parentFolderId, 
  onCreated 
}: AddPageDialogProps) => {
  const [pageTitle, setPageTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { createDoc } = useGoogleDrive();
  const { toast } = useToast();

  const locationText = topicName 
    ? `${projectName} / ${topicName}` 
    : projectName || "current project";

  const handleCreate = async () => {
    if (!pageTitle.trim() || !parentFolderId || !projectId) return;
    
    setIsCreating(true);
    
    // Create doc in Google Drive
    const doc = await createDoc(pageTitle.trim(), parentFolderId);
    
    if (doc) {
      // Save document to database
      const { data: savedDoc, error } = await supabase
        .from("documents")
        .insert({
          title: doc.name,
          google_doc_id: doc.id,
          project_id: projectId,
          topic_id: topicId || null,
        })
        .select("id, title, google_doc_id")
        .single();

      if (error) {
        console.error("Error saving document:", error);
        toast({
          title: "Warning",
          description: "Document created in Drive but failed to save to database.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Page created",
          description: `"${pageTitle}" document created.`,
        });
        onCreated?.({ id: savedDoc.id, name: savedDoc.title, google_doc_id: savedDoc.google_doc_id });
      }
      
      setPageTitle("");
      onOpenChange(false);
    }
    
    setIsCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Create Page
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new Google Doc in {locationText}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {!parentFolderId && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                No topic selected. Please select a topic first to add a page.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Page Title
            </label>
            <div className="relative">
              <FilePlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="e.g., Getting Started Guide"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                disabled={!parentFolderId}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A new Google Doc with this title will be created.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!pageTitle.trim() || isCreating || !parentFolderId || !projectId}
            >
              {isCreating ? "Creating..." : "Create Page"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
