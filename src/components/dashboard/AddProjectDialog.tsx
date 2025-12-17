import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderPlus, Upload, FileText, FolderTree, Loader2 } from "lucide-react";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootFolderId: string | null;
  organizationId?: string;
  onCreated?: (folder: { id: string; name: string }) => void;
}

interface FileEntry {
  path: string;
  content: string;
}

export const AddProjectDialog = ({ 
  open, 
  onOpenChange, 
  rootFolderId, 
  organizationId,
  onCreated 
}: AddProjectDialogProps) => {
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("empty");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createFolder } = useGoogleDrive();
  const { toast } = useToast();

  const handleCreateEmpty = async () => {
    if (!projectName.trim() || !rootFolderId) return;
    
    setIsCreating(true);
    
    const folder = await createFolder(projectName.trim(), rootFolderId);
    
    if (folder) {
      toast({
        title: "Project created",
        description: `"${projectName}" folder created in Drive.`,
      });
      onCreated?.({ id: folder.id, name: folder.name });
      resetAndClose();
    }
    
    setIsCreating(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const entries: FileEntry[] = [];
    let folderName = "";

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (!file.name.endsWith('.md')) continue;
      
      try {
        const content = await file.text();
        const path = file.webkitRelativePath || file.name;
        entries.push({ path, content });
        
        // Extract folder name from first file
        if (!folderName && path.includes('/')) {
          folderName = path.split('/')[0];
        }
      } catch (err) {
        console.error(`Error reading file: ${file.name}`, err);
      }
    }

    setFiles(entries);
    if (folderName && !projectName) {
      setProjectName(folderName);
    }
  };

  const handleImportCreate = async () => {
    if (!projectName.trim() || !rootFolderId || files.length === 0) return;
    
    setIsCreating(true);

    try {
      // Step 1: Create the project folder
      const folder = await createFolder(projectName.trim(), rootFolderId);
      if (!folder) {
        toast({
          title: "Failed to create project",
          description: "Could not create the project folder in Drive.",
          variant: "destructive",
        });
        setIsCreating(false);
        return;
      }

      // Step 2: Get the project ID from database
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("drive_folder_id", folder.id)
        .single();

      if (!project) {
        toast({
          title: "Project created",
          description: "Folder created but import requires project sync. Please try importing again.",
        });
        onCreated?.({ id: folder.id, name: folder.name });
        resetAndClose();
        return;
      }

      // Step 3: Import markdown files
      const googleToken = localStorage.getItem("google_access_token");
      if (!googleToken) {
        toast({
          title: "Authentication required",
          description: "Please sign in with Google to import files.",
          variant: "destructive",
        });
        setIsCreating(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("import-markdown", {
        body: {
          files,
          projectId: project.id,
          organizationId,
        },
        headers: {
          "x-google-token": googleToken,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Project created with imported content",
          description: `Created ${data.topicsCreated} topics and ${data.pagesCreated} pages.`,
        });
      } else {
        toast({
          title: "Import completed with some issues",
          description: `Created ${data.topicsCreated || 0} topics and ${data.pagesCreated || 0} pages. ${data.errors?.length || 0} errors.`,
        });
      }

      onCreated?.({ id: folder.id, name: folder.name });
      resetAndClose();
    } catch (err) {
      console.error("Import error:", err);
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "An error occurred during import.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const resetAndClose = () => {
    setProjectName("");
    setFiles([]);
    setActiveTab("empty");
    onOpenChange(false);
  };

  // Group files by topic for preview
  const filesByTopic = files.reduce((acc, file) => {
    const parts = file.path.split('/');
    const rootFolder = parts.length > 1 ? parts[0] : '';
    const pathWithoutRoot = rootFolder ? parts.slice(1) : parts;
    const filename = pathWithoutRoot.pop() || '';
    const topicPath = pathWithoutRoot.length > 0 ? pathWithoutRoot.join(' / ') : '(Project Root)';
    
    if (!acc[topicPath]) acc[topicPath] = [];
    acc[topicPath].push({ ...file, displayName: filename });
    return acc;
  }, {} as Record<string, (FileEntry & { displayName: string })[]>);

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Create Project
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Start with an empty project or import existing Markdown documentation.
          </DialogDescription>
        </DialogHeader>

        {!rootFolderId && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              No root folder configured. Please set your root folder in Settings first.
            </p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="empty" className="gap-2">
              <FolderPlus className="h-4 w-4" />
              Empty Project
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              Import Markdown
            </TabsTrigger>
          </TabsList>

          <TabsContent value="empty" className="space-y-4 mt-4">
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
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateEmpty} 
                disabled={!projectName.trim() || isCreating || !rootFolderId}
              >
                {isCreating ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Project Name
              </label>
              <input
                type="text"
                placeholder="Project name (auto-filled from folder)"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={!rootFolderId}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* File input */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".md"
                multiple
                // @ts-ignore
                webkitdirectory=""
                onChange={handleFileSelect}
                className="hidden"
              />
              <FolderTree className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                Select a folder containing Markdown files
              </p>
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={!rootFolderId}
              >
                <Upload className="h-4 w-4 mr-2" />
                Select Folder
              </Button>
            </div>

            {/* File preview */}
            {files.length > 0 && (
              <div className="border rounded-lg">
                <div className="px-4 py-2 border-b bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Structure Preview</span>
                    <Badge variant="secondary">{files.length} files</Badge>
                  </div>
                </div>
                <ScrollArea className="h-40">
                  <div className="p-3 space-y-3">
                    {Object.entries(filesByTopic).map(([topic, topicFiles]) => (
                      <div key={topic}>
                        <div className="flex items-center gap-2 text-sm font-medium mb-1">
                          <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                          {topic === '(Project Root)' ? 'Project Root' : topic}
                          <Badge variant="outline" className="text-xs">{topicFiles.length}</Badge>
                        </div>
                        <div className="pl-5 space-y-0.5">
                          {topicFiles.slice(0, 3).map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              {file.displayName}
                            </div>
                          ))}
                          {topicFiles.length > 3 && (
                            <div className="text-xs text-muted-foreground pl-5">
                              ...and {topicFiles.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleImportCreate} 
                disabled={!projectName.trim() || isCreating || !rootFolderId || files.length === 0}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Create & Import
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
