import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Folder, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "topic" | "page";
  projectId: string | null;
  projectName: string | null;
  projectFolderId: string | null;
  topicId?: string | null;
  topicName?: string | null;
  topicFolderId?: string | null;
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
  onImported,
}: ImportDialogProps) => {
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileWithContent[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { createFolder, createDoc } = useGoogleDrive();

  const parentFolderId = type === "page" ? (topicFolderId || projectFolderId) : projectFolderId;
  const locationText = type === "page" 
    ? (topicName ? `${projectName} / ${topicName}` : projectName || "current project")
    : projectName || "current project";

  const resetState = () => {
    setSelectedFiles([]);
    setIsImporting(false);
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

  const extractTitle = (content: string, filename: string): string => {
    // Try to find first H1
    const h1Match = content.match(/^# (.+)$/m);
    if (h1Match) return h1Match[1].trim();
    
    // Try frontmatter title
    const frontmatterMatch = content.match(/^---[\s\S]*?title:\s*['"]?([^'"\n]+)['"]?[\s\S]*?---/);
    if (frontmatterMatch) return frontmatterMatch[1].trim();
    
    // Use filename without extension
    return filename.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
  };

  const markdownToHtml = (markdown: string): string => {
    let html = markdown;
    
    // Remove frontmatter
    html = html.replace(/^---[\s\S]*?---\n*/m, '');
    
    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
      return `<pre><code>${code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    });
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Headers
    html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    // Paragraphs
    const lines = html.split('\n');
    html = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return line;
      return `<p>${line}</p>`;
    }).join('\n');
    
    return html.trim();
  };

  const handleImport = async () => {
    if (!parentFolderId || !projectId || selectedFiles.length === 0) return;

    setIsImporting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) {
        toast({
          title: "Google connection required",
          description: "Please reconnect your Google account.",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      if (type === "page") {
        // Import as pages directly
        let successCount = 0;
        for (const file of selectedFiles) {
          const filename = file.path.split('/').pop() || file.path;
          const title = extractTitle(file.content, filename);
          
          // Create doc in Google Drive
          const doc = await createDoc(title, parentFolderId);
          
          if (doc) {
            // Save document to database
            const { error } = await supabase
              .from("documents")
              .insert({
                title: title,
                google_doc_id: doc.id,
                project_id: projectId,
                topic_id: topicId || null,
                owner_id: user?.id || null,
                content_html: markdownToHtml(file.content),
              });

            if (!error) {
              successCount++;
            }
          }
        }

        toast({
          title: "Import complete",
          description: `Successfully imported ${successCount} of ${selectedFiles.length} pages.`,
        });
      } else {
        // Import as topics with nested structure
        const folderStructure = new Map<string, FileWithContent[]>();
        
        for (const file of selectedFiles) {
          const parts = file.path.split('/');
          // Get the first folder as topic name
          if (parts.length > 1) {
            const topicFolder = parts[0];
            if (!folderStructure.has(topicFolder)) {
              folderStructure.set(topicFolder, []);
            }
            folderStructure.get(topicFolder)!.push(file);
          } else {
            // Files without folder go to a default topic
            const defaultTopic = "Imported";
            if (!folderStructure.has(defaultTopic)) {
              folderStructure.set(defaultTopic, []);
            }
            folderStructure.get(defaultTopic)!.push(file);
          }
        }

        let topicsCreated = 0;
        let pagesCreated = 0;

        for (const [topicName, files] of folderStructure) {
          // Create topic folder in Google Drive
          const folder = await createFolder(topicName, parentFolderId);
          
          if (folder) {
            // Save topic to database
            const { data: topic, error: topicError } = await supabase
              .from("topics")
              .insert({
                name: topicName,
                drive_folder_id: folder.id,
                project_id: projectId,
              })
              .select("id")
              .single();

            if (!topicError && topic) {
              topicsCreated++;

              // Create pages within topic
              for (const file of files) {
                const filename = file.path.split('/').pop() || file.path;
                const title = extractTitle(file.content, filename);
                
                const doc = await createDoc(title, folder.id);
                
                if (doc) {
                  const { error } = await supabase
                    .from("documents")
                    .insert({
                      title: title,
                      google_doc_id: doc.id,
                      project_id: projectId,
                      topic_id: topic.id,
                      owner_id: user?.id || null,
                      content_html: markdownToHtml(file.content),
                    });

                  if (!error) {
                    pagesCreated++;
                  }
                }
              }
            }
          }
        }

        toast({
          title: "Import complete",
          description: `Created ${topicsCreated} topics with ${pagesCreated} pages.`,
        });
      }

      onImported?.();
      resetState();
      onOpenChange(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "An error occurred during import.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetState();
      onOpenChange(open);
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
          {!parentFolderId && (
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
              <p className="text-sm font-medium text-foreground mb-2">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </p>
              <div className="space-y-1">
                {selectedFiles.slice(0, 10).map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="w-3 h-3" />
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

          {/* Action buttons */}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
