import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { parseZipFile, parseFolderFiles, ParsedImport } from "@/lib/zipImporter";
import { 
  Upload, 
  FolderArchive, 
  FolderOpen, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  FileJson,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ZipImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectFolderId: string;
  organizationId: string;
  onImported: () => void;
}

const BATCH_SIZE = 25; // Process files in batches of 25

export function ZipImportDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectFolderId,
  organizationId,
  onImported,
}: ZipImportDialogProps) {
  const [parsedImport, setParsedImport] = useState<ParsedImport | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentFile: "" });
  const [results, setResults] = useState<{ topics: number; pages: number; errors: string[] } | null>(null);
  
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const { user, googleAccessToken } = useAuth();
  const { createFolder } = useGoogleDrive();

  const resetState = useCallback(() => {
    setParsedImport(null);
    setImporting(false);
    setProgress({ current: 0, total: 0, currentFile: "" });
    setResults(null);
    if (zipInputRef.current) zipInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, []);

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast({ title: "Invalid file", description: "Please select a ZIP file", variant: "destructive" });
      return;
    }
    
    const parsed = await parseZipFile(file);
    setParsedImport(parsed);
    
    if (parsed.errors.length > 0) {
      toast({ 
        title: "Some files couldn't be read", 
        description: `${parsed.errors.length} error(s) occurred`,
        variant: "destructive"
      });
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const parsed = await parseFolderFiles(files);
    setParsedImport(parsed);
    
    if (parsed.errors.length > 0) {
      toast({ 
        title: "Some files couldn't be read", 
        description: `${parsed.errors.length} error(s) occurred`,
        variant: "destructive"
      });
    }
  };

  const handleImport = async () => {
    if (!parsedImport || parsedImport.files.length === 0 || !user || !googleAccessToken) return;
    
    setImporting(true);
    setProgress({ current: 0, total: parsedImport.files.length, currentFile: "Starting import..." });
    
    const results = { topics: 0, pages: 0, errors: [] as string[] };
    const createdFolders = new Map<string, string>(); // path -> Google Drive folder ID
    const createdTopics = new Map<string, string>(); // path -> topic ID
    
    try {
      // Group files by folder
      const filesByFolder = new Map<string, typeof parsedImport.files>();
      for (const file of parsedImport.files) {
        const folderPath = file.path.split('/').slice(0, -1).join('/');
        if (!filesByFolder.has(folderPath)) {
          filesByFolder.set(folderPath, []);
        }
        filesByFolder.get(folderPath)!.push(file);
      }
      
      // Sort folders by depth (create parents first)
      const sortedFolders = Array.from(filesByFolder.keys()).sort((a, b) => 
        a.split('/').length - b.split('/').length
      );
      
      let processedCount = 0;
      
      // Create folders/topics and process files
      for (const folderPath of sortedFolders) {
        const files = filesByFolder.get(folderPath)!;
        let parentFolderId = projectFolderId;
        let parentTopicId: string | null = null;
        
        // Create nested folders if needed
        if (folderPath) {
          const pathParts = folderPath.split('/');
          let currentPath = '';
          
          for (const part of pathParts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            if (!createdFolders.has(currentPath)) {
              setProgress({ 
                current: processedCount, 
                total: parsedImport.files.length, 
                currentFile: `Creating folder: ${part}` 
              });
              
              // Create Google Drive folder
              const folder = await createFolder(part, parentFolderId);
              if (!folder) {
                results.errors.push(`Failed to create folder: ${part}`);
                break;
              }
              createdFolders.set(currentPath, folder.id);
              
              // Create topic in database
              const { data: topic, error: topicError } = await supabase
                .from('topics')
                .insert({
                  name: part,
                  project_id: projectId,
                  drive_folder_id: folder.id,
                  parent_id: parentTopicId,
                  display_order: results.topics,
                })
                .select('id')
                .single();
              
              if (topicError) {
                results.errors.push(`Failed to create topic: ${part}`);
              } else {
                createdTopics.set(currentPath, topic.id);
                results.topics++;
              }
            }
            
            parentFolderId = createdFolders.get(currentPath) || parentFolderId;
            parentTopicId = createdTopics.get(currentPath) || null;
          }
        }
        
        // Process files in this folder in batches
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE);
          
          // Process batch in parallel
          await Promise.all(batch.map(async (file) => {
            const fileName = file.path.split('/').pop() || 'Untitled';
            const title = file.title || extractTitle(file.content, fileName);
            
            setProgress({ 
              current: processedCount, 
              total: parsedImport.files.length, 
              currentFile: `Creating: ${title}` 
            });
            
            try {
              // Convert markdown to HTML
              const htmlContent = markdownToHtml(file.content);
              
              // Create Google Doc
              const docId = await createGoogleDoc(googleAccessToken, title, htmlContent, parentFolderId);
              
              if (!docId) {
                results.errors.push(`Failed to create: ${title}`);
                processedCount++;
                return;
              }
              
              // Save to database
              const { error: docError } = await supabase
                .from('documents')
                .upsert({
                  title,
                  google_doc_id: docId,
                  project_id: projectId,
                  topic_id: parentTopicId,
                  content_html: htmlContent,
                  owner_id: user.id,
                  visibility: 'internal',
                  is_published: false,
                }, {
                  onConflict: 'project_id,google_doc_id',
                  ignoreDuplicates: true
                });
              
              if (docError) {
                results.errors.push(`Failed to save: ${title}`);
              } else {
                results.pages++;
              }
            } catch (e) {
              results.errors.push(`Error: ${fileName}`);
            }
            
            processedCount++;
          }));
          
          // Small delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < files.length) {
            await new Promise(r => setTimeout(r, 200));
          }
        }
      }
      
      setResults(results);
      setProgress({ current: parsedImport.files.length, total: parsedImport.files.length, currentFile: "Complete!" });
      
      if (results.pages > 0) {
        toast({
          title: "Import complete!",
          description: `Created ${results.topics} topics and ${results.pages} pages`,
        });
        onImported();
      }
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      resetState();
      onOpenChange(false);
    }
  };

  const progressPercent = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderArchive className="h-5 w-5" />
            Import from ZIP or Folder
          </DialogTitle>
          <DialogDescription>
            Import markdown files with preserved folder structure. 
            Supports _meta.json and toc.yml for ordering.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!parsedImport && !importing && !results && (
            <>
              {/* Upload options */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => zipInputRef.current?.click()}
                >
                  <FolderArchive className="h-8 w-8 text-muted-foreground" />
                  <span>Upload ZIP</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  <span>Select Folder</span>
                </Button>
              </div>
              
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleZipSelect}
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore - webkitdirectory is non-standard but widely supported
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={handleFolderSelect}
              />

              {/* Config file info */}
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">Supported config files:</p>
                <div className="flex items-center gap-2">
                  <FileJson className="h-3.5 w-3.5" />
                  <code className="bg-background px-1 rounded">_meta.json</code>
                  <span>- Per-folder ordering & titles</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileJson className="h-3.5 w-3.5" />
                  <code className="bg-background px-1 rounded">toc.yml</code>
                  <span>- GitBook/Mintlify style TOC</span>
                </div>
              </div>
            </>
          )}

          {/* Parsed preview */}
          {parsedImport && !importing && !results && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {parsedImport.files.length} files ready to import
                </div>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {parsedImport.rootConfig && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                  <FileJson className="h-3.5 w-3.5" />
                  <span>Config file detected - using custom ordering</span>
                </div>
              )}
              
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {parsedImport.files.slice(0, 20).map((file, i) => (
                  <div key={i} className="px-3 py-2 text-sm flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{file.path}</span>
                    {file.order !== undefined && (
                      <span className="text-xs text-muted-foreground ml-auto">#{file.order + 1}</span>
                    )}
                  </div>
                ))}
                {parsedImport.files.length > 20 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    ... and {parsedImport.files.length - 20} more files
                  </div>
                )}
              </div>
              
              {parsedImport.errors.length > 0 && (
                <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-2">
                  <p className="font-medium">{parsedImport.errors.length} file(s) couldn't be read</p>
                </div>
              )}
            </div>
          )}

          {/* Import progress */}
          {importing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Importing files...</span>
                <span className="ml-auto text-sm font-bold">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground truncate">{progress.currentFile}</p>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {results.errors.length === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
                <span className="font-medium">Import complete</span>
              </div>
              
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">{results.topics}</p>
                  <p className="text-xs text-muted-foreground">Topics</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">{results.pages}</p>
                  <p className="text-xs text-muted-foreground">Pages</p>
                </div>
                <div className={cn(
                  "rounded-lg p-3",
                  results.errors.length > 0 ? "bg-destructive/10" : "bg-muted/50"
                )}>
                  <p className={cn(
                    "text-2xl font-bold",
                    results.errors.length > 0 && "text-destructive"
                  )}>{results.errors.length}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
              
              {results.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View errors
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                    {results.errors.map((err, i) => (
                      <li key={i} className="text-destructive">• {err}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!results ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={importing}>
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!parsedImport || parsedImport.files.length === 0 || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {parsedImport?.files.length || 0} files
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper functions
function extractTitle(content: string, filename: string): string {
  // Try to get title from frontmatter
  const frontmatterMatch = content.match(/^---[\s\S]*?title:\s*["']?([^"'\n]+)["']?[\s\S]*?---/m);
  if (frontmatterMatch) return frontmatterMatch[1].trim();
  
  // Try first H1
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  
  // Fall back to filename
  return filename.replace(/\.(md|mdx|markdown)$/i, '').replace(/[-_]/g, ' ');
}

function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Remove frontmatter
  html = html.replace(/^---[\s\S]*?---\n*/m, '');
  
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre style="background-color:#f4f4f4;padding:12px;border-radius:4px;overflow-x:auto;font-family:monospace;"><code>${escapeHtml(code.trim())}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background-color:#f0f0f0;padding:2px 6px;border-radius:3px;font-family:monospace;">$1</code>');
  
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
  
  // Links and images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:4px solid #ddd;padding-left:16px;margin:16px 0;color:#666;">$1</blockquote>');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />');
  
  // Paragraphs
  const lines = html.split('\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return line;
    return `<p>${line}</p>`;
  }).join('\n');
  
  // Clean up
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  return html.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function createGoogleDoc(
  token: string,
  title: string,
  htmlContent: string,
  parentFolderId: string
): Promise<string | null> {
  const fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head>
<body>${htmlContent}</body>
</html>`;

  const metadata = {
    name: title,
    mimeType: 'application/vnd.google-apps.document',
    parents: [parentFolderId],
  };

  const boundary = '-------314159265358979323846';
  const multipartBody = 
    `\r\n--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: text/html; charset=UTF-8\r\n\r\n' +
    fullHtml +
    `\r\n--${boundary}--`;

  try {
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&convert=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!response.ok) {
      console.error('Failed to create doc:', await response.text());
      return null;
    }

    const doc = await response.json();
    return doc.id;
  } catch (error) {
    console.error('Error creating doc:', error);
    return null;
  }
}
