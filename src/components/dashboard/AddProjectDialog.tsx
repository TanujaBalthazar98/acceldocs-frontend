import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, IS_SUPABASE_CONFIGURED } from "@/integrations/supabase/client";
import { DriveFolderPickerDialog } from "./DriveFolderPickerDialog";
import { DiscoveryResult } from "./DriveDiscoveryDialog";
import { Folder, X } from "lucide-react";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootFolderId: string | null;
  driveParentFolderId?: string | null;
  organizationId?: string;
  parentProjectId?: string | null;
  parentProjectName?: string;
  onCreated?: (result: { 
    id: string; 
    name: string; 
    versionId?: string;
    discoveryResult?: DiscoveryResult 
  }) => void;
}

export const AddProjectDialog = ({
  open,
  onOpenChange,
  organizationId,
  parentProjectId,
  parentProjectName,
  rootFolderId,
  onCreated,
}: AddProjectDialogProps) => {
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDriveFolder, setSelectedDriveFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const { toast } = useToast();
  const { user, googleAccessToken } = useAuth();

  const ensureDefaultVersion = async (projectId: string, isPublished: boolean) => {
    const { data: existing } = await supabase
      .from("project_versions")
      .select("id")
      .eq("project_id", projectId)
      .eq("is_default", true)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created, error: createError } = await supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        name: "v1.0",
        slug: "v1.0",
        is_default: true,
        is_published: isPublished,
        semver_major: 1,
        semver_minor: 0,
        semver_patch: 0,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (createError) {
      console.error("Error creating default version:", createError);
      return null;
    }

    return (created as any)?.id ?? null;
  };

  const resetAndClose = () => {
    setProjectName("");
    setSelectedDriveFolder(null);
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!projectName.trim() || !organizationId || !user) return;

    if (!IS_SUPABASE_CONFIGURED) {
      toast({
        title: "Supabase not configured",
        description: "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create project
      const { data: project, error: createProjectError } = await supabase
        .from("projects")
        .insert({
          name: projectName.trim(),
          organization_id: organizationId,
          created_by: user.id,
          parent_id: parentProjectId || null,
          drive_folder_id: selectedDriveFolder?.id || null, // Link to selected folder
        } as any)
        .select("id, name, is_published")
        .single();

      if (createProjectError || !project) {
        console.error("Create project error:", createProjectError);
        toast({
          title: "Project not created",
          description: "Failed to create the project. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const versionId = await ensureDefaultVersion((project as any).id, (project as any).is_published ?? false);

      // Perform Auto-Discovery if a folder was linked
      let discoveryResult: DiscoveryResult | undefined;
      
      if (selectedDriveFolder && googleAccessToken) {
        try {
          toast({
            title: "Scanning Drive folder...",
            description: "Checking for existing documentation content.",
          });
          
          const { data, error } = await supabase.functions.invoke("discover-drive-structure", {
            body: {
              folderId: selectedDriveFolder.id,
              accessToken: googleAccessToken,
            },
          });

          if (!error && data) {
            // Check if anything found
            const hasItems = data.subprojects.length > 0 || data.documents.length > 0 || data.topics.length > 0;
            if (hasItems) {
              discoveryResult = data;
              console.log("Discovery found items:", data);
            }
          }
        } catch (err) {
          console.error("Discovery error:", err);
          // Don't block creation, just warn
          toast({
             title: "Discovery failed",
             description: "Created project but could not scan Drive folder.",
             variant: "destructive"
          });
        }
      }

      toast({
        title: "Project created",
        description: `"${(project as any).name}" created successfully.`,
      });
      
      onCreated?.({ 
        id: (project as any).id, 
        name: (project as any).name, 
        versionId: versionId || undefined,
        discoveryResult 
      });
      
      resetAndClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={resetAndClose}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              {parentProjectId ? "Create Sub-Project" : "Create Project"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {parentProjectId
                ? `Create a sub-project under "${parentProjectName}".`
                : "Create a project in Docspeare."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Project Name</label>
              <input
                type="text"
                placeholder="e.g., API Documentation"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            
            {!parentProjectId && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Link Drive Folder (Optional)</label>
                <div className="flex items-center gap-2">
                   {selectedDriveFolder ? (
                     <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 overflow-hidden">
                           <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
                           <span className="text-sm font-medium truncate">{selectedDriveFolder.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={() => setSelectedDriveFolder(null)}>
                           <X className="w-3.5 h-3.5" />
                        </Button>
                     </div>
                   ) : (
                     <Button 
                       variant="outline" 
                       className="w-full justify-start text-muted-foreground bg-secondary/50 border-dashed"
                       onClick={() => setFolderPickerOpen(true)}
                     >
                        <Folder className="w-4 h-4 mr-2" />
                        Select existing folder...
                     </Button>
                   )}
                </div>
                <p className="text-xs text-muted-foreground">
                   If selected, we'll scan this folder for sub-projects and documents to import.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!projectName.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <DriveFolderPickerDialog 
         open={folderPickerOpen}
         onOpenChange={setFolderPickerOpen}
         rootFolderId={rootFolderId || ""}
         onSelect={setSelectedDriveFolder}
      />
    </>
  );
};
