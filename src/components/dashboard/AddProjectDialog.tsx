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

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Organization root Drive folder id (unused when Drive is disabled) */
  rootFolderId: string | null;
  /** Optional preferred Drive parent folder id (unused when Drive is disabled) */
  driveParentFolderId?: string | null;
  organizationId?: string;
  parentProjectId?: string | null;
  parentProjectName?: string;
  onCreated?: (folder: { id: string; name: string }) => void;
}

export const AddProjectDialog = ({
  open,
  onOpenChange,
  organizationId,
  parentProjectId,
  parentProjectName,
  onCreated,
}: AddProjectDialogProps) => {
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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

    return created?.id ?? null;
  };

  const resetAndClose = () => {
    setProjectName("");
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!projectName.trim() || !organizationId || !user) return;

    if (!IS_SUPABASE_CONFIGURED) {
      toast({
        title: "Supabase not configured",
        description: "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: project, error: createProjectError } = await supabase
        .from("projects")
        .insert({
          name: projectName.trim(),
          organization_id: organizationId,
          created_by: user.id,
          parent_id: parentProjectId || null,
        })
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

      await ensureDefaultVersion(project.id, project.is_published ?? false);

      toast({
        title: "Project created",
        description: `"${project.name}" created successfully.`,
      });
      onCreated?.({ id: project.id, name: project.name });
      resetAndClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {parentProjectId ? "Create Sub-Project" : "Create Project"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {parentProjectId
              ? `Create a sub-project under "${parentProjectName}".`
              : "Create a project in Docspeare. Google Drive setup is not required."}
          </DialogDescription>
        </DialogHeader>

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
  );
};
