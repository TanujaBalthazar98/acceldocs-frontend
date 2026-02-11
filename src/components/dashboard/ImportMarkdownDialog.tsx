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
import { supabase } from "@/integrations/supabase/client";
import { FileText, Folder, Upload, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
  projectId: string;
  projectVersionId: string;
  driveFolderId: string;
  onImportComplete?: () => void;
}

export const ImportMarkdownDialog = ({
  open,
  onOpenChange,
  projectId,
  projectVersionId,
  driveFolderId,
  onImportComplete,
}: ImportMarkdownDialogProps) => {
  const { toast } = useToast();
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Build folder structure
    const structure = buildFolderStructure(files);
    setImportItems(structure);
    setTotalFiles(countFiles(structure));
  };

  const buildFolderStructure = (files: File[]): ImportItem[] => {
    const root: Map<string, ImportItem> = new Map();

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
            // Read file content
            const reader = new FileReader();
            reader.onload = (e) => {
              item.content = e.target?.result as string;
            };
            reader.readAsText(file);
          }

          currentLevel.set(part, item);
        }

        if (!isFile) {
          const folder = currentLevel.get(part)!;
          currentLevel = new Map(folder.children?.map((c) => [c.name, c]) || []);
        }
      });
    });

    return Array.from(root.values());
  };

  const countFiles = (items: ImportItem[]): number => {
    return items.reduce((count, item) => {
      if (item.type === "file") return count + 1;
      return count + (item.children ? countFiles(item.children) : 0);
    }, 0);
  };

  const handleImport = async () => {
    setIsImporting(true);
    setProgress(0);

    try {
      // Get access token
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.provider_token;

      if (!accessToken) {
        throw new Error("No Google access token available");
      }

      let processedFiles = 0;

      // Process items recursively
      await processItems(importItems, null, accessToken);

      async function processItems(
        items: ImportItem[],
        parentTopicId: string | null,
        token: string
      ) {
        for (const item of items) {
          if (item.type === "folder") {
            // Create topic
            const { data: topic, error: topicError } = await supabase
              .from("topics")
              .insert({
                project_id: projectId,
                project_version_id: projectVersionId,
                name: item.name,
                slug: item.name.toLowerCase().replace(/\s+/g, "-"),
                parent_id: parentTopicId,
                drive_folder_id: driveFolderId,
              } as any)
              .select()
              .single();

            if (topicError) throw topicError;
            if (!topic) throw new Error("Failed to create topic");

            // Process children
            if (item.children) {
              await processItems(item.children, (topic as any).id, token);
            }
          } else if (item.type === "file" && item.content) {
            // Convert Markdown to Google Doc
            const response = await supabase.functions.invoke("convert-markdown-to-gdoc", {
              body: {
                markdownContent: item.content,
                title: item.name,
                folderId: driveFolderId,
                accessToken: token,
              },
            });

            if (response.error) throw response.error;

            const { documentId } = response.data;

            // Create document record
            const { error: docError } = await supabase.from("documents").insert({
              project_id: projectId,
              project_version_id: projectVersionId,
              topic_id: parentTopicId,
              title: item.name,
              slug: item.name.toLowerCase().replace(/\s+/g, "-"),
              google_doc_id: documentId,
              is_published: false,
              visibility: "internal",
            } as any);

            if (docError) throw docError;

            processedFiles++;
            setProgress((processedFiles / totalFiles) * 100);
          }
        }
      }

      toast({
        title: "Import successful!",
        description: `Imported ${totalFiles} document(s)`,
      });

      onImportComplete?.();
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Markdown Documentation</DialogTitle>
          <DialogDescription>
            Select a folder containing Markdown files. Folder structure will be preserved as topics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            />
            <label htmlFor="folder-input">
              <Button variant="outline" className="w-full" asChild>
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Choose Folder
                </span>
              </Button>
            </label>
          </div>

          {importItems.length > 0 && (
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              <h3 className="font-medium mb-2">Preview ({totalFiles} files)</h3>
              {renderPreview(importItems)}
            </div>
          )}

          {isImporting && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                Importing... {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importItems.length === 0 || isImporting}
            className="gap-2"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>Import {totalFiles} Document{totalFiles !== 1 ? "s" : ""}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
