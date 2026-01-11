import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FilePlus, Upload } from "lucide-react";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportDialog } from "./ImportDialog";

interface AddPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string | null;
  projectName?: string | null;
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
  topicId,
  topicName, 
  parentFolderId,
  organizationId,
  onCreated 
}: AddPageDialogProps) => {
  const [pageTitle, setPageTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const { createDoc } = useGoogleDrive();
  const { toast } = useToast();
  const { user } = useAuth();

  const locationText = topicName 
    ? `${projectName} / ${topicName}` 
    : projectName || "current project";

  // Determine if we have a valid parent folder - could be project folder (for project-level pages) or topic folder
  const hasValidFolder = !!parentFolderId;

  const handleCreate = async () => {
    if (!pageTitle.trim() || !hasValidFolder || !projectId) return;
    
    setIsCreating(true);
    
    // Create doc in Google Drive
    const doc = await createDoc(pageTitle.trim(), parentFolderId);
    
    if (doc) {
      // Save document to database with owner_id
      const { data: savedDoc, error } = await supabase
        .from("documents")
        .insert({
          title: doc.name,
          google_doc_id: doc.id,
          project_id: projectId,
          topic_id: topicId || null,
          owner_id: user?.id || null,
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Add Page
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create or import pages in {locationText}.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create New</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-4 pt-2">
              {!hasValidFolder && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    No project or topic selected. Please select a project first to add a page.
                  </p>
                </div>
              )}

              {/* Show info when creating at project level (no topic) */}
              {hasValidFolder && !topicId && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    This page will be created directly under <span className="font-medium text-foreground">{projectName}</span> without a topic.
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
                    disabled={!hasValidFolder}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  A new Google Doc with this title will be created{topicId ? " in this topic" : " directly under the project"}.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={!pageTitle.trim() || isCreating || !hasValidFolder || !projectId}
                >
                  {isCreating ? "Creating..." : "Create Page"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="import" className="space-y-4 pt-2">
              <div className="text-center py-6">
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Import markdown files as pages into this location.
                </p>
                <Button 
                  onClick={() => {
                    onOpenChange(false);
                    setShowImport(true);
                  }}
                  disabled={!hasValidFolder}
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
        type="page"
        projectId={projectId || null}
        projectName={projectName || null}
        projectFolderId={parentFolderId}
        topicId={topicId}
        topicName={topicName}
        topicFolderId={parentFolderId}
        organizationId={organizationId}
        onImported={() => {
          onCreated?.({ id: '', name: '', google_doc_id: '' });
        }}
      />
    </>
  );
};
