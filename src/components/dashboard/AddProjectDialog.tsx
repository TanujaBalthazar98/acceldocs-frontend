import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderPlus } from "lucide-react";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useToast } from "@/hooks/use-toast";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootFolderId: string | null;
  onCreated?: (folder: { id: string; name: string }) => void;
}

export const AddProjectDialog = ({ open, onOpenChange, rootFolderId, onCreated }: AddProjectDialogProps) => {
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { createFolder } = useGoogleDrive();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!projectName.trim() || !rootFolderId) return;
    
    setIsCreating(true);
    
    const folder = await createFolder(projectName.trim(), rootFolderId);
    
    if (folder) {
      toast({
        title: "Project created",
        description: `"${projectName}" folder created in Drive.`,
      });
      onCreated?.({ id: folder.id, name: folder.name });
      setProjectName("");
      onOpenChange(false);
    }
    
    setIsCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Create Project
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new subfolder in your root Drive folder. This will become a project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {!rootFolderId && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                No root folder configured. Please set your root folder in Settings first.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Project Name
            </label>
            <div className="relative">
              <FolderPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="e.g., API Documentation"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={!rootFolderId}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A folder with this name will be created in your organization's root Drive folder.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!projectName.trim() || isCreating || !rootFolderId}
            >
              {isCreating ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
