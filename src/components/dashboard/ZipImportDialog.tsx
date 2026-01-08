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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parseZipFile, parseFolderFiles, ParsedImport } from "@/lib/zipImporter";
import { 
  Upload, 
  FolderArchive, 
  FolderOpen, 
  FileText, 
  CheckCircle2, 
  Loader2,
  FileJson,
  X
} from "lucide-react";

interface ZipImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectFolderId: string;
  organizationId: string;
  onImported: () => void;
}

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
  
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const { user, googleAccessToken } = useAuth();

  const resetState = useCallback(() => {
    setParsedImport(null);
    setImporting(false);
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
    
    try {
      // Prepare files for the edge function
      const filesToImport = parsedImport.files.map(f => ({
        path: f.path,
        content: f.content,
      }));
      
      // Call the edge function to start background import
      const { data, error } = await supabase.functions.invoke('import-markdown', {
        body: {
          files: filesToImport,
          projectId,
          organizationId,
        },
        headers: {
          'x-google-token': googleAccessToken,
        },
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to start import');
      }
      
      // Import started successfully - close dialog and let GlobalImportProgress show status
      toast({
        title: "Import started",
        description: `Importing ${parsedImport.files.length} files in the background. Progress will be shown in the corner.`,
      });
      
      // Close the dialog - GlobalImportProgress will track the job
      resetState();
      onOpenChange(false);
      onImported();
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      resetState();
      onOpenChange(false);
    }
  };

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
          {!parsedImport && !importing && (
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
          {parsedImport && !importing && (
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

          {/* Import in progress */}
          {importing && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Starting background import...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You can close this dialog. Progress will appear in the corner.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
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
                Starting...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {parsedImport?.files.length || 0} files
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}