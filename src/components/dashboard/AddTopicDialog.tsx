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

interface AddTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string | null;
}

export const AddTopicDialog = ({ open, onOpenChange, projectName }: AddTopicDialogProps) => {
  const [topicName, setTopicName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!topicName.trim()) return;
    
    setIsCreating(true);
    // TODO: Create subfolder within project folder via Google Drive API
    console.log("Creating topic folder:", topicName, "in project:", projectName);
    
    // Reset and close
    setTopicName("");
    setIsCreating(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Create Topic
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a subfolder within "{projectName}" to organize related pages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Topic Name
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="e.g., Getting Started"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!topicName.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create Topic"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
