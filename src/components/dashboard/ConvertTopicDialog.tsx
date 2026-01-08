import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, FolderPlus, Copy, Scissors } from "lucide-react";

interface ConvertTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicName: string;
  projectId: string;
  organizationId: string;
  onSuccess?: () => void;
}

export function ConvertTopicDialog({
  open,
  onOpenChange,
  topicId,
  topicName,
  projectId,
  organizationId,
  onSuccess,
}: ConvertTopicDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [mode, setMode] = useState<"move" | "copy">("copy");
  const [projectName, setProjectName] = useState(topicName);
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = async () => {
    if (!user || !projectName.trim()) return;

    setIsConverting(true);

    try {
      // Get topic data with all documents and child topics
      const { data: topic, error: topicError } = await supabase
        .from("topics")
        .select("*")
        .eq("id", topicId)
        .single();

      if (topicError) throw topicError;

      // Get all child topics recursively
      const { data: allTopics } = await supabase
        .from("topics")
        .select("*")
        .eq("project_id", projectId);

      const getDescendantTopics = (parentId: string): any[] => {
        const children = allTopics?.filter(t => t.parent_id === parentId) || [];
        return children.flatMap(child => [child, ...getDescendantTopics(child.id)]);
      };

      const descendantTopics = getDescendantTopics(topicId);
      const allTopicIds = [topicId, ...descendantTopics.map(t => t.id)];

      // Get all documents in these topics
      const { data: documents } = await supabase
        .from("documents")
        .select("*")
        .in("topic_id", allTopicIds);

      // Create new project
      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: projectName.trim(),
          organization_id: organizationId,
          created_by: user.id,
          drive_folder_id: topic.drive_folder_id, // Keep same Drive folder for now
          is_published: false,
          visibility: "internal",
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create topic ID mapping for the new project
      const topicIdMap = new Map<string, string>();

      // Create root topic in new project (the converted topic becomes root-level)
      // First, copy child topics maintaining hierarchy
      for (const childTopic of descendantTopics) {
        const newParentId = childTopic.parent_id === topicId 
          ? null // Direct children become root-level in new project
          : topicIdMap.get(childTopic.parent_id!);

        const { data: newTopic, error: newTopicError } = await supabase
          .from("topics")
          .insert({
            name: childTopic.name,
            slug: childTopic.slug,
            project_id: newProject.id,
            drive_folder_id: childTopic.drive_folder_id,
            parent_id: newParentId,
            display_order: childTopic.display_order,
          })
          .select()
          .single();

        if (newTopicError) {
          console.error("Error creating topic:", newTopicError);
          continue;
        }

        topicIdMap.set(childTopic.id, newTopic.id);
      }

      // Copy documents
      if (documents && documents.length > 0) {
        const docInserts = documents.map(doc => {
          // Documents directly in the converted topic go to root (no topic)
          // Documents in child topics get mapped to new topic IDs
          let newTopicId = null;
          if (doc.topic_id !== topicId) {
            newTopicId = topicIdMap.get(doc.topic_id!) || null;
          }

          return {
            title: doc.title,
            slug: doc.slug,
            google_doc_id: doc.google_doc_id,
            project_id: newProject.id,
            topic_id: newTopicId,
            content: doc.content,
            content_html: doc.content_html,
            published_content_html: mode === "copy" ? null : doc.published_content_html,
            owner_id: doc.owner_id,
            visibility: doc.visibility,
            is_published: false, // New project starts unpublished
          };
        });

        const { error: docsError } = await supabase
          .from("documents")
          .insert(docInserts);

        if (docsError) {
          console.error("Error copying documents:", docsError);
        }
      }

      // If move mode, delete original topic and its contents
      if (mode === "move") {
        // Delete documents first
        await supabase
          .from("documents")
          .delete()
          .in("topic_id", allTopicIds);

        // Delete child topics (in reverse order to handle hierarchy)
        for (const descendant of [...descendantTopics].reverse()) {
          await supabase
            .from("topics")
            .delete()
            .eq("id", descendant.id);
        }

        // Delete the main topic
        await supabase
          .from("topics")
          .delete()
          .eq("id", topicId);
      }

      toast({
        title: "Topic Converted",
        description: `"${topicName}" has been ${mode === "move" ? "moved to" : "copied as"} a new project: "${projectName}"`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Conversion error:", error);
      toast({
        title: "Conversion Failed",
        description: error.message || "Failed to convert topic to project.",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            Convert Topic to Project
          </DialogTitle>
          <DialogDescription>
            Convert "{topicName}" and all its contents into a standalone project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="projectName">New Project Name</Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
              className="bg-secondary"
            />
          </div>

          {/* Mode Selection */}
          <div className="space-y-3">
            <Label>Conversion Mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "move" | "copy")}>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                <RadioGroupItem value="copy" id="copy" className="mt-0.5" />
                <Label htmlFor="copy" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <Copy className="h-4 w-4 text-primary" />
                    Copy (Keep Original)
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a new project with copies of all pages and subtopics. 
                    The original topic remains unchanged.
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                <RadioGroupItem value="move" id="move" className="mt-0.5" />
                <Label htmlFor="move" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <Scissors className="h-4 w-4 text-amber-500" />
                    Move (Delete Original)
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a new project and remove the original topic. 
                    This cannot be undone.
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConverting}>
            Cancel
          </Button>
          <Button 
            onClick={handleConvert} 
            disabled={isConverting || !projectName.trim()}
          >
            {isConverting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <FolderPlus className="h-4 w-4 mr-2" />
                {mode === "move" ? "Move to Project" : "Copy to Project"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}