import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getById, list, update } from "@/lib/api/queries";
import { useToast } from "@/hooks/use-toast";
import { Link2, FolderPlus } from "lucide-react";
import { ConvertTopicDialog } from "./ConvertTopicDialog";

interface TopicSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string | null;
  topicName: string | null;
  projectId: string | null;
  organizationId?: string | null;
  onUpdate?: () => void;
}

export const TopicSettingsDialog = ({
  open,
  onOpenChange,
  topicId,
  topicName,
  projectId,
  organizationId,
  onUpdate,
}: TopicSettingsDialogProps) => {
  const { toast } = useToast();
  
  const [name, setName] = useState(topicName || "");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  // Fetch topic data when opened
  useEffect(() => {
    if (open && topicId) {
      fetchTopicData();
    }
  }, [open, topicId]);

  const fetchTopicData = async () => {
    if (!topicId) return;

    const { data } = await getById<any>("topics", topicId, { select: "name,slug" });
    if (data) {
      setName((data as any).name || "");
      setSlug((data as any).slug || "");
    }
  };

  // Validate slug format
  const validateSlug = (value: string): boolean => {
    if (!value) return true;
    if (!/^[a-z0-9-]+$/.test(value)) {
      setSlugError("Only lowercase letters, numbers, and hyphens allowed");
      return false;
    }
    if (value.startsWith("-") || value.endsWith("-")) {
      setSlugError("Cannot start or end with a hyphen");
      return false;
    }
    if (value.includes("--")) {
      setSlugError("Cannot have consecutive hyphens");
      return false;
    }
    setSlugError("");
    return true;
  };

  const checkSlugAvailability = async (slugValue: string): Promise<boolean> => {
    if (!slugValue || !projectId) return true;

    const { data } = await list<any>("topics", {
      select: "id",
      filters: {
        project_id: projectId,
        slug: slugValue,
        id: { neq: topicId },
      },
      limit: 1,
    });
    if (data && data.length > 0) {
      setSlugError("This URL slug is already in use");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!topicId) return;
    
    // Validate slug
    if (slug && !validateSlug(slug)) return;
    
    // Check availability
    if (slug && !(await checkSlugAvailability(slug))) return;
    
    setIsSaving(true);

    const updateData: Record<string, any> = {
      name,
    };
    
    // Only update slug if explicitly set
    if (slug) {
      updateData.slug = slug;
    }

    const { error } = await update("topics", topicId, updateData);

    setIsSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Topic settings updated." });
      onUpdate?.();
      onOpenChange(false);
    }
  };

  const handleConvertSuccess = () => {
    setShowConvertDialog(false);
    onUpdate?.();
    onOpenChange(false);
  };

  if (!topicId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Topic Settings
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Configure settings for this topic
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Topic Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-secondary"
              />
            </div>

            {/* URL Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug" className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                URL Slug
              </Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">/.../project/</span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/\s+/g, "-");
                      setSlug(value);
                      validateSlug(value);
                    }}
                    placeholder="auto-generated"
                    className={`bg-secondary ${slugError ? "border-destructive" : ""}`}
                  />
                  <span className="text-sm text-muted-foreground shrink-0">/page</span>
                </div>
                {slugError && (
                  <p className="text-xs text-destructive">{slugError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Customize the URL segment for this topic. Leave empty to auto-generate from name.
                </p>
              </div>
            </div>

            {/* Convert to Project */}
            {organizationId && projectId && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Advanced Actions</Label>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setShowConvertDialog(true)}
                  >
                    <FolderPlus className="w-4 h-4 text-primary" />
                    Convert to Project
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Promote this topic to a standalone project with all its pages and subtopics.
                  </p>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert Topic Dialog */}
      {topicId && projectId && organizationId && (
        <ConvertTopicDialog
          open={showConvertDialog}
          onOpenChange={setShowConvertDialog}
          topicId={topicId}
          topicName={name || topicName || ""}
          projectId={projectId}
          organizationId={organizationId}
          onSuccess={handleConvertSuccess}
        />
      )}
    </>
  );
};
