import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Folder, Loader2, AlertCircle, FolderTree } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ImportProgressIndicator } from "./ImportProgressIndicator";
import { Progress } from "@/components/ui/progress";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "topic" | "page";
  projectId: string | null;
  projectName: string | null;
  projectFolderId: string | null;
  /** For page imports, this is the topic to import into. */
  topicId?: string | null;
  topicName?: string | null;
  topicFolderId?: string | null;
  /** For topic imports, this is the parent topic to create subtopics under. */
  parentTopicId?: string | null;
  parentTopicName?: string | null;
  organizationId?: string | null;
  onImported?: () => void;
}

interface FileWithContent {
  path: string;
  content: string;
}

export const ImportDialog = ({
  open,
  onOpenChange,
  type,
  projectId,
  projectName,
  projectFolderId,
  topicId,
  topicName,
  topicFolderId,
  parentTopicId,
  parentTopicName,
  organizationId,
  onImported,
}: ImportDialogProps) => {
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileWithContent[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, googleAccessToken } = useAuth();

  const parentFolderId = type === "page" ? (topicFolderId || projectFolderId) : projectFolderId;
  const importParentTopicId = type === "page" ? (topicId || null) : (parentTopicId || null);

  const locationText = type === "page" 
    ? (topicName ? `${projectName} / ${topicName}` : projectName || "current project")
    : (parentTopicName ? `${projectName} / ${parentTopicName}` : projectName || "current project");

  const resetState = () => {
    setSelectedFiles([]);
    setIsImporting(false);
    setImportJobId(null);
  };

  // Get folder structure preview for display
  const getFolderStructure = () => {
    const folders = new Map<string, number>();
    
    for (const file of selectedFiles) {
      const parts = file.path.split('/');
      if (parts.length > 1) {
        // Build all folder paths
        for (let i = 1; i < parts.length; i++) {
          const folderPath = parts.slice(0, i).join('/');
          folders.set(folderPath, (folders.get(folderPath) || 0) + (i === parts.length - 1 ? 1 : 0));
        }
      }
    }
    
    // Count files per deepest folder
    const folderCounts = new Map<string, number>();
    for (const file of selectedFiles) {
      const parts = file.path.split('/');
      if (parts.length > 1) {
        const folderPath = parts.slice(0, -1).join('/');
        folderCounts.set(folderPath, (folderCounts.get(folderPath) || 0) + 1);
      }
    }
    
    return folderCounts;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList: FileWithContent[] = [];
    
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        const content = await file.text();
        // Use webkitRelativePath for folder uploads, otherwise just filename
        const path = (file as any).webkitRelativePath || file.name;
        fileList.push({ path, content });
      }
    }

    if (fileList.length === 0) {
      toast({
        title: "No markdown files found",
        description: "Please select .md or .markdown files.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(fileList);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const items = e.dataTransfer.items;
    const fileList: FileWithContent[] = [];

    const readFile = async (file: File, path: string) => {
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        const content = await file.text();
        fileList.push({ path, content });
      }
    };

    const readDirectory = async (entry: FileSystemDirectoryEntry, path: string): Promise<void> => {
      const reader = entry.createReader();
      
      return new Promise((resolve) => {
        const readEntries = () => {
          reader.readEntries(async (entries) => {
            if (entries.length === 0) {
              resolve();
              return;
            }

            for (const e of entries) {
              if (e.isFile) {
                const file = await new Promise<File>((res) => 
                  (e as FileSystemFileEntry).file(res)
                );
                await readFile(file, `${path}/${file.name}`);
              } else if (e.isDirectory) {
                await readDirectory(e as FileSystemDirectoryEntry, `${path}/${e.name}`);
              }
            }
            
            readEntries();
          });
        };
        readEntries();
      });
    };

    for (const item of Array.from(items)) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        if (entry.isFile) {
          const file = item.getAsFile();
          if (file) {
            await readFile(file, file.name);
          }
        } else if (entry.isDirectory) {
          await readDirectory(entry as FileSystemDirectoryEntry, entry.name);
        }
      }
    }

    if (fileList.length === 0) {
      toast({
        title: "No markdown files found",
        description: "Please drop .md or .markdown files.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(fileList);
  };

  const handleImport = async () => {
    if (!parentFolderId || !projectId || selectedFiles.length === 0 || !googleAccessToken) {
      if (!googleAccessToken) {
        toast({
          title: "Google connection required",
          description: "Please reconnect your Google account.",
          variant: "destructive",
        });
      }
      return;
    }

    setIsImporting(true);

    try {
      // Use the edge function for both topic and page imports to properly handle nested structures
      const filesToImport = selectedFiles.map(f => ({
        path: f.path,
        content: f.content,
      }));

      // For page imports, we need to prepend the target topic folder to maintain structure
      const filesWithContext = type === "page" && topicId
        ? filesToImport.map(f => ({
            ...f,
            // Wrap files in a context so they go to the right topic
            targetTopicId: topicId,
          }))
        : filesToImport;

      // Call the edge function to start background import
      const { data, error } = await supabase.functions.invoke('import-markdown', {
        body: {
          files: filesWithContext,
          projectId,
          organizationId,
          parentTopicId: importParentTopicId,
        },
        headers: {
          'x-google-token': googleAccessToken,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to start import');
      }

      if (data?.needsReauth) {
        toast({
          title: "Google reconnection required",
          description: "Please reconnect your Google account to continue.",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      if (data?.jobId) {
        // Show progress indicator
        setImportJobId(data.jobId);
        
        toast({
          title: "Import started",
          description: `Importing ${selectedFiles.length} files. Progress shown below.`,
        });
      } else {
        // No job ID means immediate completion or error
        toast({
          title: "Import complete",
          description: `Imported ${selectedFiles.length} files.`,
        });
        onImported?.();
        resetState();
        onOpenChange(false);
      }

    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "An error occurred during import.",
        variant: "destructive",
      });
      setIsImporting(false);
    }
  };

  const handleImportComplete = () => {
    onImported?.();
    resetState();
    onOpenChange(false);
  };

  const handleImportDismiss = () => {
    resetState();
    onOpenChange(false);
  };

  const folderStructure = getFolderStructure();
  const hasSubfolders = folderStructure.size > 0 && 
    Array.from(folderStructure.keys()).some(path => path.includes('/'));

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open && !isImporting) resetState();
      if (!isImporting) onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Import {type === "topic" ? "Topics" : "Pages"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {type === "topic" 
              ? `Import markdown files as topics in "${projectName}". Folder structure will be preserved.`
              : `Import markdown files as pages in ${locationText}.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Import progress indicator */}
          {importJobId && (
            <ImportProgressIndicator
              jobId={importJobId}
              onComplete={handleImportComplete}
              onDismiss={handleImportDismiss}
            />
          )}

          {!importJobId && !parentFolderId && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {type === "topic" 
                  ? "No project selected. Please select a project first."
                  : "No location selected. Please select a topic or project first."
                }
              </p>
            </div>
          )}

          {!importJobId && !isImporting && (
            <>
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-colors
                  ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}
                  ${!parentFolderId ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}
                `}
                onClick={() => type === "topic" ? folderInputRef.current?.click() : fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-1">
                  {type === "topic" ? "Drop folders or click to select" : "Drop files or click to select"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports .md and .markdown files
                </p>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <input
                ref={folderInputRef}
                type="file"
                accept=".md,.markdown"
                multiple
                // @ts-ignore - webkitdirectory is a valid attribute
                webkitdirectory=""
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Selected files preview */}
              {selectedFiles.length > 0 && (
                <div className="border border-border rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground">
                      {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                    </p>
                    {hasSubfolders && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        <FolderTree className="w-3 h-3" />
                        Nested folders detected
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {selectedFiles.slice(0, 10).map((file, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{file.path}</span>
                      </div>
                    ))}
                    {selectedFiles.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ... and {selectedFiles.length - 10} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Importing state (before job ID is received) */}
          {isImporting && !importJobId && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Starting import...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Preparing {selectedFiles.length} files
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!importJobId && (
            <div className="flex justify-between items-center gap-2 pt-2 border-t border-border">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!parentFolderId || isImporting}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Files
                </Button>
                {type === "topic" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={!parentFolderId || isImporting}
                  >
                    <Folder className="w-4 h-4 mr-1" />
                    Folder
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedFiles.length === 0 || isImporting || !parentFolderId}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
