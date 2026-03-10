import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invokeFunction } from "@/lib/api/functions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ProjectSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName?: string | null;
  onUpdate?: () => void;
}

type VisibilityLevel = "internal" | "external" | "public";

export const ProjectSettingsPanel = ({
  open,
  onOpenChange,
  projectId,
  onUpdate,
}: ProjectSettingsPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [visibility, setVisibility] = useState<VisibilityLevel>("internal");
  const [isPublished, setIsPublished] = useState(false);
  const [showVersionSwitcher, setShowVersionSwitcher] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [driveFolderId, setDriveFolderId] = useState("");
  const [showDriveId, setShowDriveId] = useState(false);
  const [activeTab, setActiveTab] = useState<"basics" | "publishing" | "drive">("basics");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !projectId) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await invokeFunction<{
          ok?: boolean;
          project?: any;
          error?: string;
        }>("get-project-settings", {
          body: { projectId },
        });
        if (error || !data?.ok || !data?.project) throw error || new Error(data?.error || "Project not found");
        const attrs = data.project.attributes || data.project || {};
        setName(attrs.name || "");
        setSlug(attrs.slug || "");
        setVisibility(attrs.visibility || "internal");
        setIsPublished(!!attrs.is_published);
        setShowVersionSwitcher(attrs.show_version_switcher ?? true);
        setRequireApproval(attrs.require_approval ?? true);
        setDriveFolderId(attrs.drive_folder_id || "");
      } catch (err: any) {
        toast({
          title: "Failed to load project",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, projectId, toast]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    const trimmedName = name.trim();
    const trimmedSlug =
      slug.trim() ||
      trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data, error } = await invokeFunction<{
      ok?: boolean;
      project?: any;
      error?: string;
    }>("update-project-settings", {
      body: {
        projectId,
        data: {
          name: trimmedName,
          slug: trimmedSlug || null,
          visibility,
          is_published: isPublished,
          show_version_switcher: showVersionSwitcher,
          require_approval: requireApproval,
          drive_folder_id: driveFolderId.trim() || null,
        },
      },
    });
    setSaving(false);
    if (error || !data?.ok) {
      toast({
        title: "Save failed",
        description: error?.message || data?.error || "Could not update project.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Saved", description: "Project settings updated." });
    onUpdate?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex-1 flex flex-col bg-background">
        <header className="h-16 border-b border-border flex items-center justify-between px-6">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">Project Settings</h1>
            <p className="text-xs text-muted-foreground">Configure visibility, publishing, and Drive sync.</p>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </header>
        <div className="flex-1 p-6 bg-gradient-to-b from-background via-background to-muted/20">
          <div className="max-w-4xl space-y-6">
            <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Project</span>
                  <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">
                    {visibility === "public" ? "Public" : visibility === "external" ? "External" : "Internal"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-foreground truncate">{name || "Untitled Project"}</h2>
                    <p className="text-xs text-muted-foreground truncate">
                      Slug: <span className="text-foreground/80">{slug || "—"}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xs", isPublished ? "text-emerald-600" : "text-amber-600")}>
                      {isPublished ? "Published" : "Draft"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Version switcher {showVersionSwitcher ? "enabled" : "disabled"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basics">Basics</TabsTrigger>
                <TabsTrigger value="publishing">Publishing</TabsTrigger>
                <TabsTrigger value="drive">Drive</TabsTrigger>
              </TabsList>

              {loading ? (
                <div className="py-10 text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <TabsContent value="basics" className="space-y-5 mt-5">
                    <div className="rounded-xl border border-border bg-card/70 p-5 space-y-4 shadow-sm">
                      <div className="grid gap-2">
                        <Label htmlFor="project-name">Project Name</Label>
                        <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="project-slug">Slug</Label>
                        <Input id="project-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Visibility</Label>
                        <Select value={visibility} onValueChange={(v) => setVisibility(v as VisibilityLevel)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="internal">Internal</SelectItem>
                            <SelectItem value="external">External</SelectItem>
                            <SelectItem value="public">Public</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Internal projects are visible to org members only. Public projects show in docs.
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="publishing" className="space-y-5 mt-5">
                    <div className="rounded-xl border border-border bg-card/70 p-5 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Published</Label>
                          <div className="text-xs text-muted-foreground">Show in public docs</div>
                        </div>
                        <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Show Version Switcher</Label>
                          <div className="text-xs text-muted-foreground">Enable version selector in docs</div>
                        </div>
                        <Switch checked={showVersionSwitcher} onCheckedChange={setShowVersionSwitcher} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Require Approval</Label>
                          <div className="text-xs text-muted-foreground">
                            When off, documents can be published directly without a review step.
                            Ideal for solo users or teams that don't need a review workflow.
                          </div>
                        </div>
                        <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="drive" className="space-y-5 mt-5">
                    <div className="rounded-xl border border-border bg-card/70 p-5 space-y-4 shadow-sm">
                      <div className="grid gap-2">
                        <Label htmlFor="project-drive">Drive Folder ID</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="project-drive"
                            type={showDriveId ? "text" : "password"}
                            value={driveFolderId}
                            onChange={(e) => setDriveFolderId(e.target.value)}
                          />
                          <Button variant="outline" size="sm" onClick={() => setShowDriveId((v) => !v)}>
                            {showDriveId ? "Hide" : "Show"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Link this project to a Drive folder for automatic syncing.
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </>
              )}
            </Tabs>

            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deleting a project removes it from Docspeare. Drive files are not deleted unless Drive is connected.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Delete Project
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the project, topics, and pages from Docspeare. Drive files will remain.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          if (!projectId) return;
                          setDeleting(true);
                          const { data, error } = await invokeFunction<{
                            ok?: boolean;
                            error?: string;
                          }>("delete-project", {
                            body: { projectId },
                          });
                          setDeleting(false);
                          if (error || !data?.ok) {
                            toast({
                              title: "Delete failed",
                              description: error?.message || data?.error || "Could not delete project.",
                              variant: "destructive",
                            });
                            return;
                          }
                          toast({ title: "Project deleted", description: "Project removed from Docspeare." });
                          onUpdate?.();
                          onOpenChange(false);
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
