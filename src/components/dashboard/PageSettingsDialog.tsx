import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link2, ExternalLink, Trash2, FolderInput } from "lucide-react";

interface Topic {
  id: string;
  name: string;
  parent_id: string | null;
}

interface PageSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  documentTitle: string | null;
  projectId: string | null;
  googleDocId: string | null;
  onUpdate?: () => void;
  onDelete?: (docId: string) => Promise<boolean> | boolean | void;
}

export const PageSettingsDialog = ({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  projectId,
  googleDocId,
  onUpdate,
  onDelete,
}: PageSettingsDialogProps) => {
  const { toast } = useToast();
  
  const [title, setTitle] = useState(documentTitle || "");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentTopicId, setCurrentTopicId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isMoving, setIsMoving] = useState(false);

  // Fetch document data and topics when opened
  useEffect(() => {
    if (open && documentId) {
      fetchDocumentData();
      fetchTopics();
    }
  }, [open, documentId, projectId]);

  const fetchDocumentData = async () => {
    if (!documentId) return;

    const { data } = await supabase
      .from("documents")
      .select("title, slug, is_published, content_html, published_content_html, topic_id")
      .eq("id", documentId)
      .single();

    if (data) {
      setTitle(data.title);
      setSlug(data.slug || "");
      setIsPublished(data.is_published);
      setCurrentTopicId(data.topic_id);
      setSelectedTopicId(data.topic_id);
    }
  };

  const fetchTopics = async () => {
    if (!projectId) return;
    
    const { data } = await supabase
      .from("topics")
      .select("id, name, parent_id")
      .eq("project_id", projectId)
      .order("display_order");
    
    if (data) {
      setTopics(data);
    }
  };

  // Build topic display name with hierarchy
  const getTopicDisplayName = (topic: Topic): string => {
    const parts: string[] = [topic.name];
    let current = topic;
    while (current.parent_id) {
      const parent = topics.find(t => t.id === current.parent_id);
      if (parent) {
        parts.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
    }
    return parts.join(" / ");
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

    // Ensure we have an authenticated session before attempting writes.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast({
        title: "Session expired",
        description: "Please sign in again and retry.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate slug
    if (slug && !validateSlug(slug)) return;
    
    // Check availability
    if (slug && !(await checkSlugAvailability(slug))) return;
    
    setIsSaving(true);

    // First fetch current document state to get content_html
    const { data: currentDoc } = await supabase
      .from("documents")
      .select("content_html, is_published")
      .eq("id", documentId)
      .single();

    const updateData: Record<string, any> = {
      title,
      is_published: isPublished,
    };
    
    // Only update slug if explicitly set
    if (slug) {
      updateData.slug = slug;
    }

    // If publishing (was unpublished, now published), copy content_html to published_content_html
    if (isPublished && currentDoc && !currentDoc.is_published && currentDoc.content_html) {
      updateData.published_content_html = currentDoc.content_html;
    }

    // Handle topic change
    if (selectedTopicId !== currentTopicId) {
      updateData.topic_id = selectedTopicId;
    }

    const { data: updatedRows, error } = await supabase
      .from("documents")
      .update(updateData)
      .eq("id", documentId)
      // IMPORTANT: request returning rows so we can detect RLS "0 rows affected" cases
      .select("id");

    setIsSaving(false);

    if (error || !updatedRows || updatedRows.length === 0) {
      const { data: authData } = await supabase.auth.getUser();
      const signedInAs = authData.user?.email ? `Signed in as ${authData.user.email}. ` : "";

      toast({
        title: "Couldn't save",
        description:
          error?.message ||
          `${signedInAs}No changes were applied. This usually means your current account doesn’t have permission to edit this page in this project.`,
        variant: "destructive",
      });
    } else {
      const movedMessage = selectedTopicId !== currentTopicId ? " Page moved to new topic." : "";
      toast({ title: "Saved", description: `Page settings updated.${movedMessage}` });
      onUpdate?.();
      onOpenChange(false);
    }
  };

  if (!documentId) return null;

  const handleOpenInDrive = () => {
    if (googleDocId) {
      window.open(`https://docs.google.com/document/d/${googleDocId}/edit`, '_blank');
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (documentId && onDelete) {
      const docIdToDelete = documentId;
      // Close the delete confirmation dialog but keep settings dialog open during delete
      setDeleteDialogOpen(false);
      
      // Perform the delete operation first
      const result = await onDelete(docIdToDelete);
      
      // Only close the settings dialog after delete completes
      // Close unless the delete explicitly returned false (failure)
      if (result !== false) {
        onOpenChange(false);
      }
    }
  };

  return (
    <>
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

            {/* Published */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="space-y-0.5">
                <Label htmlFor="published" className="text-sm font-medium">
                  Published
                </Label>
                <p className="text-xs text-muted-foreground">
                  Make this page visible based on project visibility
                </p>
              </div>
              <Switch
                id="published"
                checked={isPublished}
                onCheckedChange={setIsPublished}
              />
            </div>

            {/* Move to Topic */}
            {topics.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FolderInput className="w-4 h-4" />
                  Move to Topic
                </Label>
                <Select
                  value={selectedTopicId || "root"}
                  onValueChange={(value) => setSelectedTopicId(value === "root" ? null : value)}
                >
                  <SelectTrigger className="bg-secondary">
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">
                      <span className="text-muted-foreground">Project Root (no topic)</span>
                    </SelectItem>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {getTopicDisplayName(topic)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTopicId !== currentTopicId && (
                  <p className="text-xs text-primary">
                    Page will be moved when you save changes
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Quick Actions</Label>
              <div className="flex flex-col gap-2">
                {googleDocId && (
                  <Button
                    variant="outline"
                    onClick={handleOpenInDrive}
                    className="justify-start gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Google Docs
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    className="justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Page
                  </Button>
                )}
              </div>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{title}"? This action cannot be undone.
              The Google Doc will not be deleted from your Drive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
