import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/api/functions";
import { FileText, Folder, Upload, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuthNew";
import { useDriveAuth } from "@/hooks/useDriveAuth";

interface ImportItem {
  type: "folder" | "file";
  name: string;
  path: string;
  content?: string;
  children?: ImportItem[];
}

interface ImportMarkdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string; // The current project context (if any)
  projectVersionId: string;
  driveFolderId: string; // The current drive folder (if any)
  organizationId: string; // Required for creating new projects
  rootFolderId: string; // Required for creating new root projects
  onImportComplete?: () => void;
}

type ImportType = 'project' | 'subproject' | 'topic';
type Step = 'select' | 'configure' | 'importing';

export const ImportMarkdownDialog = ({
  open,
  onOpenChange,
  projectId,
  projectVersionId,
  driveFolderId,
  organizationId,
  rootFolderId,
  onImportComplete,
}: ImportMarkdownDialogProps) => {
  const { toast } = useToast();
  const { createFolder } = useGoogleDrive();
  const { user: authUser } = useAuth();
  const { googleAccessToken } = useDriveAuth();
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  
  // New State for Interactive Flow
  const [step, setStep] = useState<Step>('select');
  const [importType, setImportType] = useState<ImportType>('project');
  const [targetName, setTargetName] = useState("");
  const [rootFolderName, setRootFolderName] = useState(""); // Name of the uploaded folder
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep('select');
      setImportItems([]);
      setTargetName("");
      setRootFolderName("");
      setImportType('project');
      setIsLoadingFiles(false);
    }
    onOpenChange(newOpen);
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setIsLoadingFiles(true);

      // Get the root folder name from the first file path
      const firstFilePath = files[0].webkitRelativePath;
      const rootName = firstFilePath.split('/')[0];
      setRootFolderName(rootName);
      setTargetName(rootName);

      // Build folder structure and wait for all files to be read
      const structure = await buildFolderStructure(files);
      setImportItems(structure);
      setTotalFiles(countFiles(structure));

      // Automatically move to configuration step
      setStep('configure');

      // Default import type logic
      if (!projectId) {
          setImportType('project');
      } else {
          setImportType('subproject');
      }
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
            // Read file content asynchronously and wait for it
            const readPromise = new Promise<void>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                item.content = e.target?.result as string;
                resolve();
              };
              reader.onerror = () => {
                reject(new Error(`Failed to read file: ${file.name}`));
              };
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

    // Wait for all file reads to complete before returning
    await Promise.all(fileReadPromises);

    return Array.from(root.values());
  };

  const countFiles = (items: ImportItem[]): number => {
    return items.reduce((count, item) => {
      if (item.type === "file") return count + 1;
      return count + (item.children ? countFiles(item.children) : 0);
    }, 0);
  };

  const handleImport = async () => {
    setStep('importing');
    setIsImporting(true);
    setProgress(0);

    try {
      // Get access token from AuthContext (synchronized with localStorage)
      if (!googleAccessToken || !authUser) {
        throw new Error("No Google access token or user available");
      }

      const accessToken = googleAccessToken;
      const user = authUser;

      let targetProjectId = projectId;
      let targetVersionId = projectVersionId;
      let targetParentTopicId: string | null = null;
      let initialDriveFolderId = driveFolderId;

      // 1. Setup the Root Entity based on Import Type
      if (importType === 'project') {
          // Create New Project
          // First create folder in Root Drive
          const projectFolder = await createFolder(targetName, rootFolderId);
          if (!projectFolder) throw new Error("Failed to create project folder in Drive");
          
          initialDriveFolderId = projectFolder.id;

          const { data: projectRes, error: projError } = await invokeFunction<{
            ok?: boolean;
            projectId?: string;
            versionId?: string;
            error?: string;
          }>("create-project", {
            body: {
              name: targetName,
              organizationId,
              parentId: null,
              driveFolderId: initialDriveFolderId,
              isPublished: false,
            },
          });

          if (projError || !projectRes?.ok || !projectRes?.projectId) {
            throw projError || new Error(projectRes?.error || "Failed to create project");
          }

          targetProjectId = projectRes.projectId;
          targetVersionId = projectRes.versionId || targetVersionId;

      } else if (importType === 'subproject') {
          // Create Sub-project under current project
          const subProjectFolder = await createFolder(targetName, driveFolderId);
          if (!subProjectFolder) throw new Error("Failed to create sub-project folder in Drive");
          
          initialDriveFolderId = subProjectFolder.id;

          const { data: subProjectRes, error: subProjError } = await invokeFunction<{
            ok?: boolean;
            projectId?: string;
            versionId?: string;
            error?: string;
          }>("create-project", {
            body: {
              name: targetName,
              organizationId,
              parentId: projectId,
              driveFolderId: initialDriveFolderId,
              isPublished: false,
            },
          });

          if (subProjError || !subProjectRes?.ok || !subProjectRes?.projectId) {
            throw subProjError || new Error(subProjectRes?.error || "Failed to create sub-project");
          }

          targetProjectId = subProjectRes.projectId;
          targetVersionId = subProjectRes.versionId || targetVersionId;

      } else if (importType === 'topic') {
          // Create Topic under current project
           const topicFolder = await createFolder(targetName, driveFolderId);
           if (!topicFolder) throw new Error("Failed to create topic folder in Drive");
           
           initialDriveFolderId = topicFolder.id;

           const { data: topicRes, error: topicError } = await invokeFunction<{
             ok?: boolean;
             topicId?: string;
             error?: string;
           }>("create-topic", {
             body: {
               projectId: projectId,
               projectVersionId: projectVersionId,
               name: targetName,
               parentId: null,
               driveFolderId: initialDriveFolderId,
             },
           });

           if (topicError || !topicRes?.ok || !topicRes?.topicId) {
             throw topicError || new Error(topicRes?.error || "Failed to create topic");
           }
           targetParentTopicId = topicRes.topicId;
      }

      let processedFiles = 0;
      const errors: Array<{ type: string; name: string; error: string }> = [];

      // Process items recursively
      await processItems(importItems, targetParentTopicId, accessToken, initialDriveFolderId, targetProjectId, targetVersionId);

      async function processItems(
        items: ImportItem[],
        parentTopicId: string | null,
        token: string,
        currentDriveFolderId: string,
        currentProjectId: string,
        currentProjectVersionId: string
      ) {
        for (const item of items) {
          if (item.type === "folder") {
            // 1. Create corresponding folder in Drive
            const newDriveFolder = await createFolder(item.name, currentDriveFolderId);
            const targetFolderId = newDriveFolder?.id || currentDriveFolderId;

            // 2. Create Topic in Supabase
            const { data: topic, error: topicError } = await invokeFunction<{
              ok?: boolean;
              topicId?: string;
              error?: string;
            }>("create-topic", {
              body: {
                projectId: currentProjectId,
                projectVersionId: currentProjectVersionId,
                name: item.name,
                parentId: parentTopicId,
                driveFolderId: targetFolderId,
              },
            });

            if (topicError || !topic?.ok || !topic?.topicId) {
              console.error("Error creating topic:", topicError || topic?.error);
              errors.push({ type: 'topic', name: item.name, error: topicError?.message || topic?.error || "Failed to create topic record" });
              continue;
            }

            // Process children
            if (item.children) {
              await processItems(item.children, topic.topicId, token, targetFolderId, currentProjectId, currentProjectVersionId);
            }
          } else if (item.type === "file") {
            if (!item.content) {
              errors.push({ type: 'document', name: item.name, error: 'File content is empty or failed to read' });
              continue;
            }

            // Convert Markdown to Google Doc
            try {
              const response = await invokeFunction("convert-markdown-to-gdoc", {
                body: {
                  markdownContent: item.content,
                  title: item.name,
                  folderId: currentDriveFolderId,
                  accessToken: token,
                },
                headers: { "x-google-token": token },
              });

              if (response.error || !response.data?.ok) {
                const errMsg = response.error?.message || response.data?.error || 'Failed to convert markdown';
                console.error("Error converting markdown:", errMsg);
                errors.push({ type: 'document', name: item.name, error: errMsg });
                continue;
              }

              const { documentId } = response.data;

              // Create document record
              const { data: docRes, error: docError } = await invokeFunction<{
                ok?: boolean;
                documentId?: string;
                error?: string;
              }>("create-document", {
                body: {
                  projectId: currentProjectId,
                  projectVersionId: currentProjectVersionId,
                  topicId: parentTopicId,
                  title: item.name,
                  googleDocId: documentId,
                  isPublished: false,
                  visibility: "internal",
                },
              });

              if (docError || !docRes?.ok) {
                console.error("Error creating document record:", docError || docRes?.error);
                errors.push({ type: 'document', name: item.name, error: docError?.message || docRes?.error || "Failed to create document record" });
                continue;
              }

              processedFiles++;
              setProgress((processedFiles / totalFiles) * 100);
            } catch (error) {
              console.error("Error processing file:", error);
              errors.push({ type: 'document', name: item.name, error: error instanceof Error ? error.message : 'Unknown error' });
            }
          }
        }
      }

      if (errors.length === 0) {
        toast({
          title: "Import successful!",
          description: `Imported ${targetName} with ${processedFiles} file(s).`,
        });
      } else if (processedFiles > 0) {
        toast({
          title: "Import partially complete",
          description: `Imported ${processedFiles} of ${totalFiles} file(s). ${errors.length} item(s) failed. Check console for details.`,
          variant: "default",
        });
        console.error("Import errors:", errors);
      } else {
        toast({
          title: "Import failed",
          description: `All items failed to import. Check console for details.`,
          variant: "destructive",
        });
        console.error("Import errors:", errors);
      }

      onImportComplete?.();
      handleOpenChange(false);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Content ({step === 'select' ? "Select Folder" : step === 'configure' ? "Configure Import" : "Importing"})</DialogTitle>
          <DialogDescription>
            {step === 'select' 
                ? "Select a local folder containing Markdown files to start." 
                : "Choose how you want to import this folder."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'select' && (
             <div>
                <input
                  type="file"
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderSelect}
                  className="hidden"
                  id="folder-input"
                  accept=".md"
                  disabled={isLoadingFiles}
                />
                <label htmlFor="folder-input">
                  <Button
                    variant="outline"
                    className="w-full h-32 flex flex-col gap-4 border-dashed"
                    asChild
                    disabled={isLoadingFiles}
                  >
                    <span className="flex items-center gap-2 cursor-pointer">
                      {isLoadingFiles ? (
                        <>
                          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                          <span className="text-muted-foreground">Reading files...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground" />
                          <span className="text-muted-foreground">Click to Choose Folder</span>
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
          )}

          {step === 'configure' && (
              <div className="space-y-6">
                 <div className="space-y-4 border p-4 rounded-md">
                     <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Folder className="w-4 h-4 text-blue-500"/> 
                        Importing: {rootFolderName}
                     </h3>
                     
                     <div className="space-y-2">
                         <Label>Import As</Label>
                         <RadioGroup value={importType} onValueChange={(v) => setImportType(v as ImportType)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div>
                                <RadioGroupItem value="project" id="type-project" className="peer sr-only" />
                                <Label
                                  htmlFor="type-project"
                                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                >
                                  <Folder className="mb-3 h-6 w-6" />
                                  New Project
                                </Label>
                             </div>
                             
                             <div className={!projectId ? "opacity-50 pointer-events-none" : ""}>
                                <RadioGroupItem value="subproject" id="type-subproject" className="peer sr-only" />
                                <Label
                                  htmlFor="type-subproject"
                                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                >
                                  <Folder className="mb-3 h-6 w-6 text-indigo-500" />
                                  Sub-project
                                </Label>
                             </div>

                             <div className={!projectId ? "opacity-50 pointer-events-none" : ""}>
                                <RadioGroupItem value="topic" id="type-topic" className="peer sr-only" />
                                <Label
                                  htmlFor="type-topic"
                                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                >
                                  <FileText className="mb-3 h-6 w-6 text-green-500" />
                                  Topic
                                </Label>
                             </div>
                         </RadioGroup>
                         {!projectId && <p className="text-xs text-muted-foreground mt-2">Select a project first to enable Sub-project or Topic import.</p>}
                     </div>

                     <div className="space-y-2">
                         <Label htmlFor="target-name">Name</Label>
                         <Input 
                            id="target-name" 
                            value={targetName} 
                            onChange={(e) => setTargetName(e.target.value)} 
                            placeholder="Name of the Project/Topic"
                         />
                     </div>
                 </div>
                 
                 <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                    <h3 className="font-medium mb-2 text-xs uppercase tracking-wider text-muted-foreground">Content Preview</h3>
                    {renderPreview(importItems)}
                 </div>
              </div>
          )}

          {step === 'importing' && (
            <div className="space-y-4 py-8">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center animate-pulse">
                Importing... {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          {step === 'configure' && (
             <Button variant="outline" onClick={() => setStep('select')} className="gap-2">
               <ArrowLeft className="w-4 h-4" />
               Back
             </Button>
          )}
          
          {step !== 'importing' && (
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
          )}

          {step === 'configure' && (
            <Button
                onClick={handleImport}
                disabled={isImporting || !targetName}
                className="gap-2"
            >
                Import
                <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
