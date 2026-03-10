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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { invokeFunction } from "@/lib/api/functions";
import { create, list } from "@/lib/api/queries";
import { DriveFolderPickerDialog } from "./DriveFolderPickerDialog";
import { DiscoveryResult } from "./DriveDiscoveryDialog";
import { Folder, X, Upload, Loader2, FileText } from "lucide-react";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootFolderId: string | null;
  driveParentFolderId?: string | null;
  organizationId?: string;
  parentProjectId?: string | null;
  parentProjectName?: string;
  onOpenSettings?: () => void;
  onCreated?: (result: {
    id: string;
    name: string;
    versionId?: string;
    discoveryResult?: DiscoveryResult
  }) => void;
}

interface ImportItem {
  type: "folder" | "file";
  name: string;
  path: string;
  content?: string;
  children?: ImportItem[];
}

export const AddProjectDialog = ({
  open,
  onOpenChange,
  organizationId,
  parentProjectId,
  parentProjectName,
  rootFolderId,
  onOpenSettings,
  onCreated,
}: AddProjectDialogProps) => {
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDriveFolder, setSelectedDriveFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "import">("create");
  const { toast } = useToast();
  const { user, googleAccessToken } = useAuth();

  // Import state
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const ensureDefaultVersion = async () => null;

  const resetAndClose = () => {
    setProjectName("");
    setSelectedDriveFolder(null);
    setImportItems([]);
    setIsLoadingFiles(false);
    setIsImporting(false);
    setImportProgress(0);
    setActiveTab("create");
    onOpenChange(false);
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
    if (!organizationId || !user || !googleAccessToken || !rootFolderId) {
      toast({
        title: "Missing requirements",
        description: "Organization, Drive folder, and authentication are required.",
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

      // Determine parent folder ID
      const parentFolderId = parentProjectId ? selectedDriveFolder?.id || rootFolderId : rootFolderId;

      await processItems(importItems, parentProjectId, parentFolderId);

      async function processItems(
        items: ImportItem[],
        currentParentProjectId: string | null,
        currentDriveFolderId: string
      ) {
        for (const item of items) {
          if (item.type === "folder") {
            // Create Drive folder for the project/sub-project
            const folderResponse = await invokeFunction("google-drive", {
              body: {
                action: "create_folder",
                name: item.name,
                parentFolderId: currentDriveFolderId,
              },
              headers: {
                "x-google-token": googleAccessToken,
              },
            });

            const targetFolderId = folderResponse.data?.folder?.id || currentDriveFolderId;

            // Create project/sub-project in database
            const { data: projectRes, error: projectError } = await invokeFunction<{
              ok?: boolean;
              projectId?: string;
              versionId?: string;
              error?: string;
            }>("create-project", {
              body: {
                name: item.name,
                organizationId,
                parentId: currentParentProjectId || null,
                driveFolderId: targetFolderId,
              },
            });

            if (projectError || !projectRes?.ok || !projectRes?.projectId) {
              console.error("Error creating project:", projectError || projectRes?.error);
              errors.push({ type: "project", name: item.name, error: projectError?.message || projectRes?.error || "Failed to create" });
              continue;
            }

            const versionId = projectRes.versionId || null;
            if (!versionId) {
              errors.push({ type: "version", name: item.name, error: "Failed to create default version" });
              continue;
            }

            // Process children (could be sub-projects, topics, or documents)
            if (item.children && item.children.length > 0) {
              // Determine if children are sub-projects (folders) or topics/documents
              const hasFolders = item.children.some((child) => child.type === "folder");

              if (hasFolders) {
                // Children include sub-projects (and possibly files at this level)
                const childFolders = item.children.filter((child) => child.type === "folder");
                const childFiles = item.children.filter((child) => child.type === "file");
                if (childFolders.length > 0) {
                  await processItems(childFolders, projectRes.projectId, targetFolderId);
                }
                if (childFiles.length > 0) {
                  await processDocuments(childFiles, projectRes.projectId, versionId, null, targetFolderId);
                }
              } else {
                // Children are documents - create them directly under the project
                await processDocuments(item.children, projectRes.projectId, versionId, null, targetFolderId);
              }
            }
          }
        }
      }

      async function processDocuments(
        items: ImportItem[],
        projectId: string,
        versionId: string,
        topicId: string | null,
        folderId: string
      ) {
        for (const item of items) {
          if (item.type === "file") {
            if (!item.content) {
              errors.push({ type: "document", name: item.name, error: "File content is empty or failed to read" });
              continue;
            }

            try {
              const response = await invokeFunction("convert-markdown-to-gdoc", {
                body: {
                  markdownContent: item.content,
                  title: item.name,
                  folderId: folderId,
                  accessToken: googleAccessToken,
                },
              });

              if (response.error) {
                errors.push({ type: "document", name: item.name, error: response.error.message || "Failed to convert markdown" });
                continue;
              }

              const { documentId } = response.data;

              const { data: docRes, error: docError } = await invokeFunction<{
                ok?: boolean;
                documentId?: string;
                error?: string;
              }>("create-document", {
                body: {
                  projectId,
                  projectVersionId: versionId,
                  topicId: topicId,
                  title: item.name,
                  slug: item.name.toLowerCase().replace(/\s+/g, "-"),
                  googleDocId: documentId,
                  isPublished: false,
                  visibility: "internal",
                },
              });

              if (docError || !docRes?.ok) {
                errors.push({ type: "document", name: item.name, error: docError?.message || docRes?.error || "Failed to create document" });
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
          description: `Imported ${processedFiles} file(s) into project structure.`,
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

      onCreated?.({ id: "", name: "Imported Content" });
      resetAndClose();
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
            → {item.type === "folder" ? "Project/Sub-Project" : "Document"}
          </span>
        </div>
        {item.children && renderPreview(item.children, level + 1)}
      </div>
    ));
  };

  const handleCreate = async () => {
    if (!projectName.trim() || !organizationId || !user) return;

    setIsCreating(true);
    try {
      // Create project
      const { data: projectRes, error: createProjectError } = await invokeFunction<{
        ok?: boolean;
        projectId?: string;
        versionId?: string;
        error?: string;
      }>("create-project", {
        body: {
          name: projectName.trim(),
          organizationId,
          parentId: parentProjectId || null,
          driveFolderId: selectedDriveFolder?.id || null,
        },
      });

      if (createProjectError || !projectRes?.ok || !projectRes?.projectId) {
        console.error("Create project error:", createProjectError || projectRes?.error);
        toast({
          title: "Project not created",
          description: "Failed to create the project. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const versionId = projectRes.versionId || null;

      // Perform Auto-Discovery if a folder was linked
      let discoveryResult: DiscoveryResult | undefined;
      
      if (selectedDriveFolder && googleAccessToken) {
        try {
          toast({
            title: "Scanning Drive folder...",
            description: "Checking for existing documentation content.",
          });
          
          const { data, error } = await invokeFunction("discover-drive-structure", {
            body: { folderId: selectedDriveFolder.id },
            headers: { "x-google-token": googleAccessToken },
          });

          if (!error && data) {
            // Check if anything found
            const hasItems = (data.subprojects?.length ?? 0) > 0 || (data.documents?.length ?? 0) > 0;
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
        description: `"${projectName.trim()}" created successfully.`,
      });
      
      onCreated?.({ 
        id: projectRes.projectId, 
        name: projectName.trim(), 
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

          {!organizationId && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">Organization is required.</p>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "import")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create New</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g., API Documentation"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={!organizationId}
                  className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
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

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" onClick={resetAndClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!projectName.trim() || isCreating || !organizationId}
                >
                  {isCreating ? "Creating..." : parentProjectId ? "Create Sub-Project" : "Create Project"}
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
                    id="project-folder-input"
                    accept=".md"
                    disabled={isLoadingFiles}
                  />
                  <label htmlFor="project-folder-input">
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
                              1st level folders → Projects, 2nd level → Sub-projects, 3rd+ → Topics
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

      <DriveFolderPickerDialog
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        rootFolderId={rootFolderId || ""}
        onSelect={setSelectedDriveFolder}
        onOpenSettings={onOpenSettings}
      />
    </>
  );
};
