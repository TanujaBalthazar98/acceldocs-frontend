import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, Upload, Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AddTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string | null;
  projectId: string | null;
  projectVersionId?: string | null;
  projectFolderId: string | null;
  parentTopic?: { id: string; name: string; drive_folder_id: string } | null;
  organizationId?: string | null;
  onCreated?: (topic: { id: string; name: string; drive_folder_id?: string | null }) => void;
}

interface ImportItem {
  type: "folder" | "file";
  name: string;
  path: string;
  content?: string;
  children?: ImportItem[];
}

export const AddTopicDialog = ({
  open,
  onOpenChange,
  projectName,
  projectId,
  projectVersionId,
  projectFolderId,
  parentTopic,
  onCreated,
}: AddTopicDialogProps) => {
  const [topicName, setTopicName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "import">("create");
  const { toast } = useToast();
  const { user, googleAccessToken } = useAuth();

  // Import state
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const locationText = parentTopic ? `"${parentTopic.name}"` : `"${projectName}"`;

  const resetState = () => {
    setTopicName("");
    setImportItems([]);
    setIsLoadingFiles(false);
    setIsImporting(false);
    setImportProgress(0);
    setActiveTab("create");
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!topicName.trim() || !projectId || !projectVersionId) return;

    setIsCreating(true);
    try {
      const { data: topic, error } = await supabase
        .from("topics")
        .insert({
          name: topicName.trim(),
          project_id: projectId,
          project_version_id: projectVersionId,
          parent_id: parentTopic?.id || null,
        } as any)
        .select("id, name")
        .single();

      if (error || !topic) {
        console.error("Error saving topic:", error);
        toast({
          title: "Error",
          description: "Failed to create the topic.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: parentTopic ? "Subtopic created" : "Topic created",
        description: `"${topicName}" created in ${locationText}.`,
      });
      onCreated?.({ id: (topic as any).id, name: (topic as any).name, drive_folder_id: null });
      handleClose();
    } finally {
      setIsCreating(false);
    }
  };

  const buildFolderStructure = async (files: File[]): Promise<ImportItem[]> => {
    const root: Map<string, ImportItem> = new Map();
    const fileReadPromises: Promise<void>[] = [];

    files.forEach((file) => {
      if (!file.name.endsWith(".md")) return;

      const pathParts = file.webkitRelativePath.split("/");
      pathParts.shift(); // Remove root folder name

      let currentLevel = root;
      let currentPath = "";

      pathParts.forEach((part, index) => {
        currentPath += (currentPath ? "/" : "") + part;
        const isFile = index === pathParts.length - 1;

        if (!currentLevel.has(part)) {
          const item: ImportItem = {
            type: isFile ? "file" : "folder",
            name: part.replace(/\.md$/, ""),
            path: currentPath,
            children: isFile ? undefined : [],
          };

          if (isFile) {
            const readPromise = new Promise<void>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                item.content = e.target?.result as string;
                resolve();
              };
              reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
              reader.readAsText(file);
            });
            fileReadPromises.push(readPromise);
          }

          currentLevel.set(part, item);
        }

        if (!isFile) {
          const folder = currentLevel.get(part)!;
          currentLevel = new Map(folder.children?.map((c) => [c.name, c]) || []);
        }
      });
    });

    await Promise.all(fileReadPromises);
    return Array.from(root.values());
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setIsLoadingFiles(true);
      const structure = await buildFolderStructure(files);
      setImportItems(structure);
    } catch (error) {
      console.error("Error reading files:", error);
      toast({
        title: "Error reading files",
        description: error instanceof Error ? error.message : "Failed to read one or more files",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const countFiles = (items: ImportItem[]): number => {
    return items.reduce((count, item) => {
      if (item.type === "file") return count + 1;
      return count + (item.children ? countFiles(item.children) : 0);
    }, 0);
  };

  const handleImport = async () => {
    if (!projectId || !projectVersionId || !projectFolderId || !googleAccessToken || !user) {
      toast({
        title: "Missing requirements",
        description: "Project, Drive folder, and authentication are required.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      let processedFiles = 0;
      const totalFiles = countFiles(importItems);
      const errors: Array<{ type: string; name: string; error: string }> = [];

      const parentFolderId = parentTopic?.drive_folder_id || projectFolderId;

      await processItems(importItems, parentTopic?.id || null, parentFolderId);

      async function processItems(
        items: ImportItem[],
        parentTopicId: string | null,
        currentDriveFolderId: string
      ) {
        for (const item of items) {
          if (item.type === "folder") {
            // Create Drive folder
            const folderResponse = await supabase.functions.invoke("google-drive", {
              body: {
                action: "createFolder",
                accessToken: googleAccessToken,
                folderName: item.name,
                parentFolderId: currentDriveFolderId,
              },
            });

            const targetFolderId = folderResponse.data?.id || currentDriveFolderId;

            // Create topic in database
            const { data: topic, error: topicError } = await supabase
              .from("topics")
              .insert({
                project_id: projectId,
                project_version_id: projectVersionId,
                name: item.name,
                slug: item.name.toLowerCase().replace(/\s+/g, "-"),
                parent_id: parentTopicId,
                drive_folder_id: targetFolderId,
              } as any)
              .select()
              .single();

            if (topicError) {
              console.error("Error creating topic:", topicError);
              errors.push({ type: "topic", name: item.name, error: topicError.message });
              continue;
            }
            if (!topic) {
              errors.push({ type: "topic", name: item.name, error: "Failed to create topic record" });
              continue;
            }

            // Process children
            if (item.children) {
              await processItems(item.children, (topic as any).id, targetFolderId);
            }
          } else if (item.type === "file") {
            if (!item.content) {
              errors.push({ type: "document", name: item.name, error: "File content is empty or failed to read" });
              continue;
            }

            try {
              const response = await supabase.functions.invoke("convert-markdown-to-gdoc", {
                body: {
                  markdownContent: item.content,
                  title: item.name,
                  folderId: currentDriveFolderId,
                  accessToken: googleAccessToken,
                },
              });

              if (response.error) {
                errors.push({ type: "document", name: item.name, error: response.error.message || "Failed to convert markdown" });
                continue;
              }

              const { documentId } = response.data;

              const { error: docError } = await supabase.from("documents").insert({
                project_id: projectId,
                project_version_id: projectVersionId,
                topic_id: parentTopicId,
                title: item.name,
                slug: item.name.toLowerCase().replace(/\s+/g, "-"),
                google_doc_id: documentId,
                is_published: false,
                visibility: "internal",
                owner_id: user?.id,
              } as any);

              if (docError) {
                errors.push({ type: "document", name: item.name, error: docError.message });
                continue;
              }

              processedFiles++;
              setImportProgress((processedFiles / totalFiles) * 100);
            } catch (error) {
              errors.push({ type: "document", name: item.name, error: error instanceof Error ? error.message : "Unknown error" });
            }
          }
        }
      }

      if (errors.length === 0) {
        toast({
          title: "Import successful!",
          description: `Imported ${processedFiles} file(s) into topic.`,
        });
      } else if (processedFiles > 0) {
        toast({
          title: "Import partially complete",
          description: `Imported ${processedFiles} of ${totalFiles} file(s). ${errors.length} item(s) failed.`,
        });
        console.error("Import errors:", errors);
      } else {
        toast({
          title: "Import failed",
          description: "All items failed to import. Check console for details.",
          variant: "destructive",
        });
        console.error("Import errors:", errors);
      }

      onCreated?.({ id: "", name: "Imported Content", drive_folder_id: parentFolderId });
      handleClose();
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const renderPreview = (items: ImportItem[], level = 0) => {
    return items.map((item, index) => (
      <div key={index} style={{ marginLeft: `${level * 20}px` }} className="py-1">
        <div className="flex items-center gap-2 text-sm">
          {item.type === "folder" ? (
            <Folder className="w-4 h-4 text-blue-500" />
          ) : (
            <FileText className="w-4 h-4 text-gray-500" />
          )}
          <span>{item.name}</span>
          <span className="text-xs text-muted-foreground">
            → {item.type === "folder" ? "Topic" : "Document"}
          </span>
        </div>
        {item.children && renderPreview(item.children, level + 1)}
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {parentTopic ? "Add Subtopic" : "Add Topic"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {parentTopic
              ? `Create a subtopic within "${parentTopic.name}".`
              : `Create a topic within "${projectName}".`}
          </DialogDescription>
        </DialogHeader>

        {(!projectId || !projectVersionId) && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">Select a project and version first.</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "import")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {parentTopic ? "Subtopic Name" : "Topic Name"}
              </label>
              <div className="relative">
                <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="e.g., Getting Started"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  disabled={!projectId || !projectVersionId}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!topicName.trim() || isCreating || !projectId || !projectVersionId}
              >
                {isCreating ? "Creating..." : parentTopic ? "Create Subtopic" : "Create Topic"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            {!importItems.length ? (
              <div>
                <input
                  type="file"
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderSelect}
                  className="hidden"
                  id="topic-folder-input"
                  accept=".md"
                  disabled={isLoadingFiles}
                />
                <label htmlFor="topic-folder-input">
                  <Button
                    variant="outline"
                    className="w-full h-32 flex flex-col gap-4 border-dashed"
                    asChild
                    disabled={isLoadingFiles}
                  >
                    <span className="flex flex-col items-center gap-2 cursor-pointer">
                      {isLoadingFiles ? (
                        <>
                          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                          <span className="text-muted-foreground">Reading files...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground" />
                          <span className="text-muted-foreground">Choose folder with .md files</span>
                          <span className="text-xs text-muted-foreground">
                            Subfolders become topics, markdown files become documents
                          </span>
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
            ) : (
              <>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                  <h3 className="font-medium mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Content Preview ({countFiles(importItems)} files)
                  </h3>
                  {renderPreview(importItems)}
                </div>

                {isImporting && (
                  <div className="space-y-2">
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Importing... {Math.round(importProgress)}%
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button variant="outline" onClick={() => setImportItems([])} disabled={isImporting}>
                    Back
                  </Button>
                  <Button onClick={handleImport} disabled={isImporting}>
                    {isImporting ? "Importing..." : `Import ${countFiles(importItems)} file(s)`}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
