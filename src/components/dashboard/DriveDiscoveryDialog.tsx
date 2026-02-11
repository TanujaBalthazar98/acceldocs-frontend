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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
    setIsImporting(true);
    setProgress(0);
    let processedCount = 0;
    const importedDocIds = new Set<string>();
    const errors: Array<{ type: string; name: string; error: string }> = [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) throw new Error("No authenticated user");

      // 1. Import Sub-projects
      for (const sub of discoveryResult.subprojects) {
        if (!selectedSubprojects.has(sub.id)) continue;

        // Create sub-project
        const { data: newProject, error: projError } = await supabase
          .from("projects")
          .insert({
            name: sub.name,
            slug: sub.name.toLowerCase().replace(/\s+/g, "-"),
            parent_id: projectId,
            drive_folder_id: sub.id,
            organization_id: ((await supabase.from("projects").select("organization_id").eq("id", projectId).single()) as any).data?.organization_id,
            owner_id: user.id,
          } as any)
          .select()
          .single();

        if (projError) {
          console.error("Error creating sub-project", projError);
          errors.push({ type: 'sub-project', name: sub.name, error: projError.message });
          continue;
        }
        if (!newProject) {
          errors.push({ type: 'sub-project', name: sub.name, error: 'Failed to create project record' });
          continue;
        }

        // Import topics for this sub-project (nested folders)
        // Filter topics where the Drive parent folder ID matches this sub-project's Drive folder ID
        const subProjectTopics = discoveryResult.topics.filter(t => t.driveParentId === sub.id);

        // Helper to import topics AND documents recursively
        const importTopics = async (topics: typeof discoveryResult.topics, parentTopicId: string | null, targetProjectId: string) => {
             for (const topic of topics) {
                 const { data: newTopic, error: topicError } = await supabase
                  .from("topics")
                  .insert({
                      project_id: targetProjectId,
                      project_version_id: projectVersionId,
                      name: topic.name,
                      slug: topic.name.toLowerCase().replace(/\s+/g, "-"),
                      drive_folder_id: topic.id,
                      parent_id: parentTopicId
                  } as any)
                  .select()
                  .single();

                  if (topicError) {
                      console.error("Error creating topic", topicError);
                      continue;
                  }

                  // Find and import documents for this topic
                  const topicDocs = discoveryResult.documents.filter(d => d.folderId === topic.id);
                  for (const doc of topicDocs) {
                      if (!selectedDocs.has(doc.id) || importedDocIds.has(doc.id)) continue;

                      const { error: docError } = await supabase
                        .from("documents")
                        .insert({
                            project_id: targetProjectId,
                            project_version_id: projectVersionId,
                            topic_id: (newTopic as any).id,
                            title: doc.name,
                            slug: doc.name.toLowerCase().replace(/\s+/g, "-"),
                            google_doc_id: doc.id,
                            is_published: false,
                            owner_id: user.id
                        } as any);

                      if (docError) console.error("Error importing doc in topic", docError);
                      else importedDocIds.add(doc.id);

                      processedCount++;
                      setProgress((processedCount / totalItemsToImport) * 100);
                  }

                  // Recurse for child topics
                  const childTopics = discoveryResult.topics.filter(t => t.driveParentId === topic.id);
                  if (childTopics.length > 0) {
                      await importTopics(childTopics, (newTopic as any).id, targetProjectId);
                  }
             }
        };

        // First import all topics and their documents
        await importTopics(subProjectTopics, null, (newProject as any).id);

        // Then import ONLY direct documents of the sub-project (not in any topic)
        // Get all topic IDs under this sub-project to exclude their documents
        const getAllTopicIds = (topics: typeof discoveryResult.topics, rootId: string): Set<string> => {
          const ids = new Set<string>();
          const topicsToProcess = topics.filter(t => t.driveParentId === rootId);

          for (const topic of topicsToProcess) {
            ids.add(topic.id);
            // Recursively add child topic IDs
            const childIds = getAllTopicIds(topics, topic.id);
            childIds.forEach(id => ids.add(id));
          }

          return ids;
        };

        const topicFolderIds = getAllTopicIds(discoveryResult.topics, sub.id);

        // Only import documents whose folderId is the sub-project root (not in any topic)
        const subProjectRootDocs = discoveryResult.documents.filter(d =>
          d.folderId === sub.id && !topicFolderIds.has(d.folderId)
        );

        for (const doc of subProjectRootDocs) {
            if (!selectedDocs.has(doc.id) || importedDocIds.has(doc.id)) continue;

            const { error: docError } = await supabase
                .from("documents")
                .insert({
                    project_id: (newProject as any).id,
                    project_version_id: projectVersionId,
                    title: doc.name,
                    slug: doc.name.toLowerCase().replace(/\s+/g, "-"),
                    google_doc_id: doc.id,
                    is_published: false,
                    owner_id: user.id
                } as any);

            if (docError) console.error("Error importing doc in sub-project root", docError);
            else importedDocIds.add(doc.id);

            processedCount++;
            setProgress((processedCount / totalItemsToImport) * 100);
        }

        processedCount++;
        setProgress((processedCount / totalItemsToImport) * 100);
      }

      // 2. Import Root Documents (Documents that are direct children of the folder)
      // We should ideally sync them. For now, let's create placeholders or trigger a sync?
      // Creating document records manually is faster.
      
      for (const doc of discoveryResult.documents) {
        if (!selectedDocs.has(doc.id) || importedDocIds.has(doc.id)) continue;

        const { error: docError } = await supabase
          .from("documents")
          .insert({
            project_id: projectId,
            project_version_id: projectVersionId,
            title: doc.name,
            slug: doc.name.toLowerCase().replace(/\s+/g, "-"),
            google_doc_id: doc.id,
            is_published: false,
            owner_id: user.id
          } as any);

        if (docError) console.error("Error importing doc", docError);

        processedCount++;
        setProgress((processedCount / totalItemsToImport) * 100);
      }
      
      // Ideally we would also iterate through the created sub-projects and import THEIR documents.
      // But the current discovery result 'documents' list needs to distinguish which folder they belong to.
      // The Edge Function returns 'folderId' for each document.
      // We need to map this.
      
      // This logic is getting complex. For V1, let's just support importing:
      // - Sub-projects (as empty projects linked to folders)
      // - Root documents (as documents in current project)
      // - Topics (as empty topics linked to folders)
      
      // The content sync logic (fetching doc content) usually happens via "Sync" button.
      // So ensuring the records exist with `drive_folder_id` and `google_doc_id` is the key.
      
      const successCount = processedCount - errors.length;

      if (errors.length === 0) {
        toast({
          title: "Import Complete",
          description: `Successfully imported ${successCount} item(s).`,
        });
      } else if (successCount > 0) {
        toast({
          title: "Import Partially Complete",
          description: `Imported ${successCount} item(s). ${errors.length} item(s) failed. Check console for details.`,
          variant: "default",
        });
        console.error("Import errors:", errors);
      } else {
        throw new Error("All imports failed. Check console for details.");
      }

      onImportComplete();
      onOpenChange(false);

    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
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
