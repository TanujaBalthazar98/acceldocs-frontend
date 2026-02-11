import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AddPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string | null;
  projectName?: string | null;
  projectVersionId?: string | null;
  topicId?: string | null;
  topicName?: string | null;
  parentFolderId: string | null;
  organizationId?: string | null;
  onCreated?: (doc: { id: string; name: string; google_doc_id: string }) => void;
}

export const AddPageDialog = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectVersionId,
  topicId,
  topicName,
  parentFolderId,
  onCreated,
}: AddPageDialogProps) => {
  const { toast } = useToast();
  const { createDoc, checkFolderAccess } = useGoogleDrive();
  const { user, googleAccessToken } = useAuth();
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "import">("create");

  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const locationText = topicName
    ? `${projectName} / ${topicName}`
    : projectName || "current project";

  const resetState = () => {
    setTitle("");
    setSelectedFile(null);
    setFileContent("");
    setIsLoadingFile(false);
    setIsImporting(false);
    setActiveTab("create");
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".md")) {
      toast({
        title: "Invalid file type",
        description: "Please select a markdown (.md) file.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingFile(true);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.readAsText(file);
      });

      setSelectedFile(file);
      setFileContent(content);
    } catch (error) {
      console.error("Error reading file:", error);
      toast({
        title: "Error reading file",
        description: error instanceof Error ? error.message : "Failed to read the file",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !fileContent || !projectId || !projectVersionId || !parentFolderId || !googleAccessToken || !user) {
      toast({
        title: "Missing requirements",
        description: "Project, Drive folder, file, and authentication are required.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const fileName = selectedFile.name.replace(/\.md$/, "");

      // Convert markdown to Google Doc
      const response = await supabase.functions.invoke("convert-markdown-to-gdoc", {
        body: {
          markdownContent: fileContent,
          title: fileName,
          folderId: parentFolderId,
          accessToken: googleAccessToken,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to convert markdown");
      }

      const { documentId } = response.data;

      // Create database record
      const { data: inserted, error: docError } = await supabase
        .from("documents")
        .insert({
          project_id: projectId,
          project_version_id: projectVersionId,
          topic_id: topicId || null,
          title: fileName,
          slug: fileName.toLowerCase().replace(/\s+/g, "-"),
          google_doc_id: documentId,
          is_published: false,
          visibility: "internal",
          owner_id: user?.id,
        } as any)
        .select("id, title, google_doc_id")
        .single();

      if (docError || !inserted) {
        console.error("Error saving document:", docError);
        toast({
          title: "Save failed",
          description: "We created the Google Doc but could not save it in Docspeare.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Page imported",
        description: `\"${(inserted as any).title}\" imported into ${locationText}.`,
      });

      onCreated?.({
        id: (inserted as any).id,
        name: (inserted as any).title,
        google_doc_id: (inserted as any).google_doc_id,
      });
      handleClose();
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error.message || "Failed to import the file.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !projectId || !parentFolderId) {
      return;
    }

    setIsCreating(true);
    try {
      // Pre-check folder access
      const access = await checkFolderAccess(parentFolderId);
      if (!access.exists) {
        toast({
          title: "Folder access error",
          description: access.error || "Cannot access the project folder in Google Drive. Please reconnect Drive.",
          variant: "destructive",
        });
        return;
      }

      const doc = await createDoc(title.trim(), parentFolderId);
      if (!doc) {
        return;
      }

      const { data: inserted, error } = await supabase
        .from("documents")
        .insert({
          google_doc_id: doc.id,
          project_id: projectId,
          project_version_id: projectVersionId || undefined,
          topic_id: topicId || null,
          title: doc.name,
          owner_id: user?.id || null,
          last_synced_at: new Date().toISOString(),
          google_modified_at: new Date().toISOString(),
        })
        .select("id, title, google_doc_id")
        .single();

      if (error || !inserted) {
        console.error("Error saving document:", error);
        toast({
          title: "Save failed",
          description: "We created the Google Doc but could not save it in Docspeare.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Page created",
        description: `Created "${inserted.title}" in ${locationText}.`,
      });
      setTitle("");
      onOpenChange(false);
      onCreated?.({
        id: inserted.id,
        name: inserted.title,
        google_doc_id: inserted.google_doc_id,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Add Page
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Pages live in your connected Google Drive and sync into Docspeare.
          </DialogDescription>
        </DialogHeader>

        {(!projectId || !parentFolderId) && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">Select a project and topic first.</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "import")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Page title</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g., Getting Started"
                disabled={!projectId || !parentFolderId}
              />
              <p className="text-xs text-muted-foreground">
                A new Google Doc will be created in the Drive folder for {locationText}.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!title.trim() || !projectId || !parentFolderId || isCreating}
              >
                {isCreating ? "Creating..." : "Create Page"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            {!selectedFile ? (
              <div>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="page-file-input"
                  accept=".md"
                  disabled={isLoadingFile}
                />
                <label htmlFor="page-file-input">
                  <Button
                    variant="outline"
                    className="w-full h-32 flex flex-col gap-4 border-dashed"
                    asChild
                    disabled={isLoadingFile}
                  >
                    <span className="flex flex-col items-center gap-2 cursor-pointer">
                      {isLoadingFile ? (
                        <>
                          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                          <span className="text-muted-foreground">Reading file...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground" />
                          <span className="text-muted-foreground">Choose markdown file</span>
                          <span className="text-xs text-muted-foreground">
                            Select a .md file to import as a page
                          </span>
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
            ) : (
              <>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">{selectedFile.name.replace(/\.md$/, "")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Will be converted to Google Doc and saved in {locationText}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button variant="outline" onClick={() => setSelectedFile(null)} disabled={isImporting}>
                    Back
                  </Button>
                  <Button onClick={handleImport} disabled={isImporting}>
                    {isImporting ? "Importing..." : "Import File"}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
