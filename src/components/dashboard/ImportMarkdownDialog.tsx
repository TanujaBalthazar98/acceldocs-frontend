import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, FolderTree, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ImportMarkdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  organizationId: string;
  onImportComplete?: () => void;
}

interface FileEntry {
  path: string;
  content: string;
}

interface ImportResult {
  success: boolean;
  topicsCreated?: number;
  pagesCreated?: number;
  errors?: string[];
}

export function ImportMarkdownDialog({
  open,
  onOpenChange,
  projectId,
  organizationId,
  onImportComplete,
}: ImportMarkdownDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const entries: FileEntry[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Only process .md files
      if (!file.name.endsWith('.md')) continue;
      
      try {
        const content = await file.text();
        // Use webkitRelativePath if available (folder upload), otherwise just filename
        const path = file.webkitRelativePath || file.name;
        entries.push({ path, content });
      } catch (err) {
        console.error(`Error reading file: ${file.name}`, err);
      }
    }

    setFiles(entries);
    setResult(null);
  };

  const handleImport = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select markdown files to import.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      // Get Google token from localStorage
      const googleToken = localStorage.getItem("google_access_token");
      if (!googleToken) {
        toast({
          title: "Authentication required",
          description: "Please sign in with Google to import files.",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("import-markdown", {
        body: {
          files,
          projectId,
          organizationId,
        },
        headers: {
          "x-google-token": googleToken,
        },
      });

      if (error) throw error;

      setResult(data);

      if (data.success) {
        toast({
          title: "Import complete",
          description: `Created ${data.topicsCreated} topics and ${data.pagesCreated} pages.`,
        });
        onImportComplete?.();
      } else {
        toast({
          title: "Import failed",
          description: data.error || "An error occurred during import.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Import error:", err);
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "An error occurred during import.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setResult(null);
    onOpenChange(false);
  };

  // Group files by folder for preview
  const filesByFolder = files.reduce((acc, file) => {
    const parts = file.path.split('/');
    const folder = parts.length > 1 ? parts[0] : '(root)';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, FileEntry[]>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Markdown Files
          </DialogTitle>
          <DialogDescription>
            Upload markdown files from your existing documentation. Folders will be converted to topics, and .md files will become pages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File input */}
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              multiple
              // @ts-ignore - webkitdirectory is not in types
              webkitdirectory=""
              onChange={handleFileSelect}
              className="hidden"
            />
            <FolderTree className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Select a folder containing markdown files
            </p>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Select Folder
            </Button>
          </div>

          {/* File preview */}
          {files.length > 0 && (
            <div className="border rounded-lg">
              <div className="px-4 py-3 border-b bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Files to import</span>
                  <Badge variant="secondary">{files.length} files</Badge>
                </div>
              </div>
              <ScrollArea className="h-48">
                <div className="p-4 space-y-4">
                  {Object.entries(filesByFolder).map(([folder, folderFiles]) => (
                    <div key={folder}>
                      <div className="flex items-center gap-2 text-sm font-medium mb-2">
                        <FolderTree className="h-4 w-4 text-muted-foreground" />
                        {folder === '(root)' ? 'Project Level' : folder}
                        <Badge variant="outline" className="text-xs">{folderFiles.length}</Badge>
                      </div>
                      <div className="pl-6 space-y-1">
                        {folderFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            {file.path.split('/').pop()}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`border rounded-lg p-4 ${result.success ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`font-medium ${result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {result.success ? 'Import successful!' : 'Import completed with errors'}
                  </p>
                  {result.topicsCreated !== undefined && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Created {result.topicsCreated} topics and {result.pagesCreated} pages
                    </p>
                  )}
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-red-600 dark:text-red-400">Errors:</p>
                      <ul className="text-sm text-muted-foreground list-disc pl-4 mt-1">
                        {result.errors.slice(0, 5).map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                        {result.errors.length > 5 && (
                          <li>...and {result.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result?.success ? 'Close' : 'Cancel'}
          </Button>
          {!result?.success && (
            <Button onClick={handleImport} disabled={importing || files.length === 0}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {files.length} Files
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
