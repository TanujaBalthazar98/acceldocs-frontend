import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, Upload } from "lucide-react";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportDialog } from "./ImportDialog";

interface AddTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string | null;
  projectId: string | null;
  projectFolderId: string | null;
  onCreated?: (topic: { id: string; name: string; drive_folder_id: string }) => void;
}

export const AddTopicDialog = ({ open, onOpenChange, projectName, projectId, projectFolderId, onCreated }: AddTopicDialogProps) => {
  const [topicName, setTopicName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const { createFolder } = useGoogleDrive();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!topicName.trim() || !projectFolderId || !projectId) return;
    
    setIsCreating(true);
    
    // Create folder in Google Drive
    const folder = await createFolder(topicName.trim(), projectFolderId);
    
    if (folder) {
      // Save topic to database
      const { data: topic, error } = await supabase
        .from("topics")
        .insert({
          name: folder.name,
          drive_folder_id: folder.id,
          project_id: projectId,
        })
        .select("id, name, drive_folder_id")
        .single();

      if (error) {
        console.error("Error saving topic:", error);
        toast({
          title: "Error",
          description: "Folder created in Drive but failed to save to database.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Topic created",
          description: `"${topicName}" created in ${projectName}.`,
        });
        onCreated?.(topic);
      }
      
      setTopicName("");
      onOpenChange(false);
    }
    
    setIsCreating(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Add Topic
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create or import topics within "{projectName}".
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create New</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-4 pt-2">
              {!projectFolderId && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    No project selected. Please select a project first.
                  </p>
                </div>
              )}

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
                    disabled={!projectFolderId}
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
                  disabled={!topicName.trim() || isCreating || !projectFolderId || !projectId}
                >
                  {isCreating ? "Creating..." : "Create Topic"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="import" className="space-y-4 pt-2">
              <div className="text-center py-6">
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Import markdown files as topics. Folder structure will be preserved.
                </p>
                <Button 
                  onClick={() => {
                    onOpenChange(false);
                    setShowImport(true);
                  }}
                  disabled={!projectFolderId}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Open Import Dialog
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        type="topic"
        projectId={projectId}
        projectName={projectName}
        projectFolderId={projectFolderId}
        onImported={() => {
          onCreated?.({ id: '', name: '', drive_folder_id: '' });
        }}
      />
    </>
  );
};
