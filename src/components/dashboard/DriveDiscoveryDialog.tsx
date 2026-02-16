import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FolderTree, FileText, Folder, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/api/functions";
import { Progress } from "@/components/ui/progress";

export interface DiscoveryResult {
  subprojects: { id: string; name: string; docCount: number }[];
  documents: { id: string; name: string; folderId: string }[];
  topics: { id: string; name: string; parentId: string | null; docCount: number; driveParentId: string }[];
}

interface DriveDiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectVersionId: string | null;
  discoveryResult: DiscoveryResult;
  onImportComplete: () => void;
  onCancel: () => void;
}

export const DriveDiscoveryDialog = ({
  open,
  onOpenChange,
  projectId,
  projectVersionId,
  discoveryResult,
  onImportComplete,
  onCancel,
}: DriveDiscoveryDialogProps) => {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Selection states
  const [selectedSubprojects, setSelectedSubprojects] = useState<Set<string>>(
    new Set(discoveryResult.subprojects.map((s) => s.id))
  );
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(
    new Set(discoveryResult.documents.map((d) => d.id))
  );

  const totalItemsToImport = selectedSubprojects.size + selectedDocs.size;

  const toggleSubproject = (id: string) => {
    const newSelected = new Set(selectedSubprojects);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSubprojects(newSelected);
  };

  const toggleDoc = (id: string) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDocs(newSelected);
  };

  const handleImport = async () => {
    if (totalItemsToImport === 0) {
      toast({
        title: "Nothing selected",
        description: "Select at least one sub-project or document to import.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      let processed = 0;
      const total = totalItemsToImport;

      // 1) Create selected sub-projects
      for (const sub of discoveryResult.subprojects) {
        if (!selectedSubprojects.has(sub.id)) continue;
        const { data, error } = await invokeFunction<{
          ok?: boolean;
          projectId?: string;
          versionId?: string;
          error?: string;
        }>("create-project", {
          body: {
            name: sub.name,
            parentId: projectId,
            driveFolderId: sub.id,
            isPublished: false,
          },
        });

        if (error || !data?.ok) {
          console.error("Failed to create sub-project:", error || data?.error);
        }

        processed += 1;
        setProgress(Math.round((processed / total) * 100));
      }

      // 2) Create selected documents in the root project
      for (const doc of discoveryResult.documents) {
        if (!selectedDocs.has(doc.id)) continue;
        const { data, error } = await invokeFunction<{
          ok?: boolean;
          documentId?: string;
          error?: string;
        }>("create-document", {
          body: {
            projectId,
            projectVersionId,
            topicId: null,
            title: doc.name,
            googleDocId: doc.id,
            isPublished: false,
            visibility: "internal",
          },
        });

        if (error || !data?.ok) {
          console.error("Failed to create document:", error || data?.error);
        }

        processed += 1;
        setProgress(Math.round((processed / total) * 100));
      }

      toast({
        title: "Import complete",
        description: "Your selected content has been added to the project.",
      });
      onImportComplete();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Drive import failed:", err);
      toast({
        title: "Import failed",
        description: err?.message || "Something went wrong while importing.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Discovered Content in Drive</DialogTitle>
          <DialogDescription>
            We found existing content in your Drive folder. Select what you'd like to import into your new project.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4 border rounded-md bg-slate-50 dark:bg-slate-900">
          <div className="space-y-6">
            {/* Sub-projects Section */}
            {discoveryResult.subprojects.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">
                  <FolderTree className="w-4 h-4" />
                  Sub-projects Found ({discoveryResult.subprojects.length})
                </h4>
                <div className="space-y-2 pl-2">
                  {discoveryResult.subprojects.map((sub) => (
                    <div key={sub.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                      <Checkbox 
                        id={`sub-${sub.id}`} 
                        checked={selectedSubprojects.has(sub.id)}
                        onCheckedChange={() => toggleSubproject(sub.id)}
                      />
                      <label htmlFor={`sub-${sub.id}`} className="grid gap-0.5 cursor-pointer">
                        <span className="font-medium text-sm flex items-center gap-2">
                            <Folder className="w-3.5 h-3.5 text-blue-500" />
                            {sub.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{sub.docCount} potential documents</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents Section */}
            {discoveryResult.documents.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">
                  <FileText className="w-4 h-4" />
                  Documents Found ({discoveryResult.documents.length})
                </h4>
                <div className="space-y-2 pl-2">
                  {discoveryResult.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                      <Checkbox 
                        id={`doc-${doc.id}`} 
                        checked={selectedDocs.has(doc.id)}
                        onCheckedChange={() => toggleDoc(doc.id)}
                      />
                      <label htmlFor={`doc-${doc.id}`} className="font-medium text-sm cursor-pointer flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        {doc.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {discoveryResult.subprojects.length === 0 && discoveryResult.documents.length === 0 && (
               <div className="text-center py-8 text-muted-foreground">
                   No importable content found in this folder.
               </div>
            )}
          </div>
        </ScrollArea>
        
        {isImporting && (
           <div className="space-y-1">
               <Progress value={progress} className="h-2" />
               <p className="text-xs text-center text-muted-foreground">Importing content...</p>
           </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isImporting}>
            Skip Import
          </Button>
          <Button onClick={handleImport} disabled={isImporting || totalItemsToImport === 0}>
            {isImporting ? (
                <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                </>
            ) : (
                <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Import Selected ({totalItemsToImport})
                </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
