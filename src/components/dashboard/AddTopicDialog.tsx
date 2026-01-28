import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string | null;
  projectId: string | null;
  projectVersionId?: string | null;
  projectFolderId: string | null;
  parentTopic?: { id: string; name: string; drive_folder_id: string } | null;
  organizationId?: string | null;
  onCreated?: (topic: { id: string; name: string; drive_folder_id?: string | null }) => void;
}

export const AddTopicDialog = ({
  open,
  onOpenChange,
  projectName,
  projectId,
  projectVersionId,
  parentTopic,
  onCreated,
}: AddTopicDialogProps) => {
  const [topicName, setTopicName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const locationText = parentTopic ? `"${parentTopic.name}"` : `"${projectName}"`;

  const handleCreate = async () => {
    if (!topicName.trim() || !projectId || !projectVersionId) return;

    setIsCreating(true);
    try {
      const { data: topic, error } = await supabase
        .from("topics")
        .insert({
          name: topicName.trim(),
          project_id: projectId,
          project_version_id: projectVersionId,
          parent_id: parentTopic?.id || null,
        })
        .select("id, name")
        .single();

      if (error || !topic) {
        console.error("Error saving topic:", error);
        toast({
          title: "Error",
          description: "Failed to create the topic.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: parentTopic ? "Subtopic created" : "Topic created",
        description: `"${topicName}" created in ${locationText}.`,
      });
      onCreated?.({ id: topic.id, name: topic.name, drive_folder_id: null });
      setTopicName("");
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {parentTopic ? "Add Subtopic" : "Add Topic"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {parentTopic
              ? `Create a subtopic within "${parentTopic.name}".`
              : `Create a topic within "${projectName}".`}
          </DialogDescription>
        </DialogHeader>

        {(!projectId || !projectVersionId) && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              Select a project and version first.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {parentTopic ? "Subtopic Name" : "Topic Name"}
          </label>
          <div className="relative">
            <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="e.g., Getting Started"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              disabled={!projectId || !projectVersionId}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!topicName.trim() || isCreating || !projectId || !projectVersionId}
          >
            {isCreating ? "Creating..." : parentTopic ? "Create Subtopic" : "Create Topic"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
