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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link2, Globe, Lock, Eye } from "lucide-react";

type VisibilityLevel = "internal" | "external" | "public";

interface PageSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  documentTitle: string | null;
  projectId: string | null;
  onUpdate?: () => void;
}

const visibilityOptions: { value: VisibilityLevel; label: string; icon: typeof Lock }[] = [
  { value: "internal", label: "Internal", icon: Lock },
  { value: "external", label: "External", icon: Eye },
  { value: "public", label: "Public", icon: Globe },
];

export const PageSettingsDialog = ({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  projectId,
  onUpdate,
}: PageSettingsDialogProps) => {
  const { toast } = useToast();
  
  const [title, setTitle] = useState(documentTitle || "");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  const [visibility, setVisibility] = useState<VisibilityLevel>("internal");
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch document data when opened
  useEffect(() => {
    if (open && documentId) {
      fetchDocumentData();
    }
  }, [open, documentId]);

  const fetchDocumentData = async () => {
    if (!documentId) return;

    const { data } = await supabase
      .from("documents")
      .select("title, slug, visibility, is_published")
      .eq("id", documentId)
      .single();

    if (data) {
      setTitle(data.title);
      setSlug(data.slug || "");
      setVisibility(data.visibility as VisibilityLevel);
      setIsPublished(data.is_published);
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
    
    const { data } = await supabase
      .from("documents")
      .select("id")
      .eq("project_id", projectId)
      .eq("slug", slugValue)
      .neq("id", documentId)
      .maybeSingle();
    
    if (data) {
      setSlugError("This URL slug is already in use");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!documentId) return;
    
    // Validate slug
    if (slug && !validateSlug(slug)) return;
    
    // Check availability
    if (slug && !(await checkSlugAvailability(slug))) return;
    
    setIsSaving(true);

    const updateData: Record<string, any> = {
      title,
      visibility,
      is_published: isPublished,
    };
    
    // Only update slug if explicitly set
    if (slug) {
      updateData.slug = slug;
    }

    const { error } = await supabase
      .from("documents")
      .update(updateData)
      .eq("id", documentId);

    setIsSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Page settings updated." });
      onUpdate?.();
      onOpenChange(false);
    }
  };

  if (!documentId) return null;

  const currentVisibility = visibilityOptions.find(v => v.value === visibility);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Page Settings
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure settings for this page
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Page Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
                <span className="text-sm text-muted-foreground shrink-0">/.../</span>
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
              </div>
              {slugError && (
                <p className="text-xs text-destructive">{slugError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Customize the URL for this page. Leave empty to auto-generate from title.
              </p>
            </div>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as VisibilityLevel)}>
              <SelectTrigger className="bg-secondary">
                <SelectValue>
                  {currentVisibility && (
                    <div className="flex items-center gap-2">
                      <currentVisibility.icon className="w-4 h-4" />
                      <span>{currentVisibility.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {visibilityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="w-4 h-4" />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Published */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="space-y-0.5">
              <Label htmlFor="published" className="text-sm font-medium">
                Published
              </Label>
              <p className="text-xs text-muted-foreground">
                Make this page visible based on visibility settings
              </p>
            </div>
            <Switch
              id="published"
              checked={isPublished}
              onCheckedChange={setIsPublished}
            />
          </div>

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
  );
};
