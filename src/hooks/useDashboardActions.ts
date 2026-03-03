import { useState } from "react";
import { invokeFunction } from "@/lib/api/functions";
import { mapDocumentFromStrapi } from "@/lib/dataMappers";
import { strapiFetch } from "@/lib/api/client";
import type { Project, Document } from "@/types/dashboard";

interface UseDashboardActionsOptions {
  user: any;
  googleAccessToken: string | null | undefined;
  toast: (opts: any) => void;
  projects: Project[];
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  selectedProject: Project | null;
  setSelectedProject: React.Dispatch<React.SetStateAction<Project | null>>;
  selectedTopic: any;
  setSelectedTopic: React.Dispatch<React.SetStateAction<any>>;
  selectedDocument: Document | null;
  setSelectedDocument: React.Dispatch<React.SetStateAction<Document | null>>;
  selectedPage: string | null;
  setSelectedPage: React.Dispatch<React.SetStateAction<string | null>>;
  permissions: any;
  logAction: (action: string, type: string, id: string, projectId: string, meta?: any) => Promise<void>;
  logUnauthorizedAttempt: (action: string, type: string, id: string, projectId: string, permission: string) => Promise<void>;
  canPublishForProject: (projectId: string) => Promise<boolean>;
  fetchData: () => Promise<void>;
  trashFile: (fileId: string) => Promise<any>;
  resolveDefaultVersion: (projectId: string) => any;
  getAssignableTopics: (projectId: string | null, versionId: string | null) => any[];
  ensureDefaultVersionForProject: (projectId: string, isPublished: boolean) => Promise<string | null>;
  navigate: (path: string) => void;
  signOut: () => Promise<void>;
}

export const useDashboardActions = ({
  user,
  googleAccessToken,
  toast,
  projects,
  documents,
  setDocuments,
  selectedProject,
  setSelectedProject,
  selectedTopic,
  setSelectedTopic,
  selectedDocument,
  setSelectedDocument,
  selectedPage,
  setSelectedPage,
  permissions,
  logAction,
  logUnauthorizedAttempt,
  canPublishForProject,
  fetchData,
  trashFile,
  resolveDefaultVersion,
  getAssignableTopics,
  ensureDefaultVersionForProject,
  navigate,
  signOut,
}: UseDashboardActionsOptions) => {
  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    type: "project" | "topic" | "document";
    id: string;
    name: string;
    forceDelete?: boolean;
  } | null>(null);
  const [forceDeleteAvailable, setForceDeleteAvailable] = useState(false);

  // Assign state
  const [assignProjectOpen, setAssignProjectOpen] = useState(false);
  const [assignTargetDoc, setAssignTargetDoc] = useState<Document | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<string>("");
  const [assignTopicId, setAssignTopicId] = useState<string>("");
  const [isAssigningProject, setIsAssigningProject] = useState(false);

  // Bulk action state
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [isBulkUnpublishing, setIsBulkUnpublishing] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    total: number;
    processed: number;
    failed: number;
    mode: "publish" | "unpublish" | "delete";
  } | null>(null);
  const [lastBulkFailures, setLastBulkFailures] = useState<{
    mode: "publish" | "unpublish" | "delete";
    docIds: string[];
  } | null>(null);

  // Delete handlers
  const handleDeleteProject = async (projectId: string, forceDelete = false): Promise<boolean> => {
    if (!permissions.canDeleteProject) {
      toast({ title: "Permission Denied", description: "You don't have permission to delete projects.", variant: "destructive" });
      await logUnauthorizedAttempt("delete_project", "project", projectId, projectId, "canDeleteProject");
      return false;
    }

    const project = projects.find((p) => p.id === projectId);
    let data: { ok?: boolean; error?: string } | null | undefined;
    let error: any = null;
    try {
      const resp = await invokeFunction<{ ok?: boolean; error?: string }>("delete-project", {
        body: { projectId },
      });
      data = resp?.data;
      error = resp?.error;
    } catch (err) {
      console.error("Delete project error:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete project.",
        variant: "destructive",
        duration: 8000,
      });
      return false;
    }

    if (error || !data?.ok) {
      toast({ title: "Error", description: "Failed to delete project.", variant: "destructive" });
      return false;
    }

    const canUseDrive = !!googleAccessToken;
    if (project?.drive_folder_id && canUseDrive && !forceDelete) {
      const trashResult = await trashFile(project.drive_folder_id);
      if (!trashResult.success) {
        toast({
          title: "Drive not updated",
          description: trashResult.error || "Project removed from app, but Drive folder was not deleted.",
          variant: "destructive",
        });
      }
    }

    await logAction("delete_project", "project", projectId, projectId, { forceDelete });
    toast({
      title: "Deleted",
      description: project?.drive_folder_id ? "Project deleted from app and Drive." : "Project deleted from app.",
    });
    if (selectedProject?.id === projectId) {
      setSelectedProject(null);
    }
    fetchData();
    return true;
  };

  const handleDeleteTopic = async (topicId: string, forceDelete = false): Promise<boolean> => {
    if (!permissions.canDeleteTopic) {
      toast({ title: "Permission Denied", description: "You don't have permission to delete topics.", variant: "destructive" });
      await logUnauthorizedAttempt("delete_topic", "topic", topicId, selectedProject?.id || "", "canDeleteTopic");
      return false;
    }

    const topic = (selectedTopic?.id === topicId) ? selectedTopic : null;
    const canUseDrive = !!googleAccessToken;

    if (topic?.drive_folder_id && !forceDelete && canUseDrive) {
      const trashResult = await trashFile(topic.drive_folder_id);
      if (!trashResult.success) {
        if (trashResult.errorCode === "NOT_AUTHORIZED" || trashResult.errorCode === "NEEDS_REAUTH") {
          setForceDeleteAvailable(true);
          toast({
            title: "Cannot Delete from Drive",
            description: "Drive access is unavailable. Deleting from app only.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Cannot Delete Topic",
            description: trashResult.error || "Failed to trash the Drive folder.",
            variant: "destructive",
          });
          return false;
        }
      }
      if (trashResult.alreadyDeleted) {
        toast({
          title: "Drive Folder Missing",
          description: "Drive folder was already removed. Cleaning up the topic in Docspeare.",
        });
      }
    } else if (topic?.drive_folder_id && !forceDelete && !canUseDrive) {
      toast({
        title: "Drive not connected",
        description: "Deleting topic from app only (Drive folder will remain).",
      });
    }

    const { data, error } = await invokeFunction<{ ok?: boolean; error?: string }>("delete-topic", {
      body: { topicId },
    });

    if (error || !data?.ok) {
      toast({ title: "Error", description: "Failed to delete topic.", variant: "destructive" });
      return false;
    }

    await logAction("delete_topic", "topic", topicId, selectedProject?.id || "", {
      topicName: topic?.name,
      forceDelete,
    });
    toast({
      title: "Deleted",
      description: forceDelete
        ? "Topic deleted from app (Drive files remain)."
        : "Topic moved to Drive trash and deleted from app.",
    });
    if (selectedTopic?.id === topicId) {
      setSelectedTopic(null);
    }
    fetchData();
    return true;
  };

  const handleDeleteDocument = async (docId: string, forceDelete = false): Promise<boolean> => {
    if (!permissions.canDeleteDocument) {
      toast({ title: "Permission Denied", description: "You don't have permission to delete pages.", variant: "destructive" });
      await logUnauthorizedAttempt("delete_document", "document", docId, selectedProject?.id || "", "canDeleteDocument");
      return false;
    }

    const doc = documents.find((d) => d.id === docId);
    const canUseDrive = !!googleAccessToken;

    if (doc?.google_doc_id && !forceDelete && canUseDrive) {
      const trashResult = await trashFile(doc.google_doc_id);
      if (!trashResult.success) {
        if (trashResult.errorCode === "NOT_AUTHORIZED" || trashResult.errorCode === "NEEDS_REAUTH") {
          setForceDeleteAvailable(true);
          toast({
            title: "Cannot Delete from Drive",
            description: "Drive access is unavailable. Deleting from app only.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Cannot Delete Page",
            description: trashResult.error || "Failed to trash the Drive file.",
            variant: "destructive",
          });
          return false;
        }
      }
      if (trashResult.alreadyDeleted) {
        toast({
          title: "Drive File Missing",
          description: "Drive file was already removed. Cleaning up the page in Docspeare.",
        });
      }
    } else if (doc?.google_doc_id && !forceDelete && !canUseDrive) {
      toast({
        title: "Drive not connected",
        description: "Deleting page from app only (Drive file will remain).",
      });
    }

    const { data, error } = await invokeFunction<{ ok?: boolean; error?: string }>("delete-document", {
      body: { documentId: docId },
    });

    if (error || !data?.ok) {
      toast({ title: "Error", description: "Failed to delete page.", variant: "destructive" });
      return false;
    }

    if (selectedDocument?.id === docId) setSelectedDocument(null);
    if (selectedPage === docId) setSelectedPage(null);

    await logAction("delete_document", "document", docId, selectedProject?.id || "", {
      documentTitle: doc?.title,
      forceDelete,
    });
    toast({
      title: "Deleted",
      description: forceDelete
        ? "Page deleted from app (Drive file remains)."
        : "Page moved to Drive trash and deleted from app.",
    });
    fetchData();
    return true;
  };

  const confirmDelete = async (forceDelete = false) => {
    if (!itemToDelete) return;

    if (itemToDelete.type === "document" && selectedPage === itemToDelete.id) setSelectedPage(null);
    if (itemToDelete.type === "document" && selectedDocument?.id === itemToDelete.id) setSelectedDocument(null);

    let success = true;
    switch (itemToDelete.type) {
      case "project":
        success = await handleDeleteProject(itemToDelete.id, forceDelete);
        break;
      case "topic":
        success = await handleDeleteTopic(itemToDelete.id, forceDelete);
        break;
      case "document":
        success = await handleDeleteDocument(itemToDelete.id, forceDelete);
        break;
    }

    if (success || forceDelete) {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setForceDeleteAvailable(false);
    }
  };

  // Publish handlers
  const handleTogglePublishPage = async (e: React.MouseEvent, docId: string, currentState: boolean) => {
    e.stopPropagation();
    const newState = !currentState;
    const doc = documents.find((d) => d.id === docId);
    const docProjectId = doc?.project_id ?? selectedProject?.id ?? "";

    const hasPermission =
      selectedProject?.id === docProjectId
        ? newState
          ? permissions.canPublish
          : permissions.canUnpublish
        : await canPublishForProject(docProjectId);

    if (newState && !hasPermission) {
      toast({ title: "Permission Denied", description: "You don't have permission to publish pages.", variant: "destructive" });
      await logUnauthorizedAttempt("publish", "document", docId, docProjectId, "canPublish");
      return;
    }
    if (!newState && !hasPermission) {
      toast({ title: "Permission Denied", description: "You don't have permission to unpublish pages.", variant: "destructive" });
      await logUnauthorizedAttempt("unpublish", "document", docId, docProjectId, "canUnpublish");
      return;
    }

    const updateData: Record<string, any> = { is_published: newState };
    if (newState) {
      // Publishing: snapshot current draft content as published content
      if (doc?.content_id) updateData.published_content_id = doc.content_id;
      if (doc?.content_html) updateData.published_content_html = doc.content_html;
    } else {
      // Unpublishing: clear published content fields
      updateData.published_content_id = null;
      updateData.published_content_html = null;
    }

    try {
      const { data, error } = await invokeFunction<{ ok?: boolean; document?: any; error?: string }>("update-document", {
        body: { documentId: docId, data: updateData },
      });

      if (error || !data?.ok) {
        const errorMessage = error?.message || data?.error || "Failed to update publish state.";
        toast({ 
          title: "Error", 
          description: errorMessage,
          variant: "destructive",
          duration: 8000,
        });
        console.error("Publish error:", error || data?.error);
        return;
      }
      await logAction(newState ? "publish" : "unpublish", "document", docId, docProjectId, {
        documentTitle: doc?.title,
        previousState: currentState ? "published" : "draft",
        newState: newState ? "published" : "draft",
      });
      toast({
        title: newState ? "Published" : "Unpublished",
        description: newState ? "Page is now live." : "Page is no longer published.",
      });
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                is_published: newState,
                published_content_id: newState ? d.content_id : null,
                published_content_html: newState ? d.content_html : null,
              }
            : d
        )
      );
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast({ 
        title: "Error", 
        description: `Failed to ${newState ? "publish" : "unpublish"} page: ${errorMessage}`,
        variant: "destructive",
        duration: 8000,
      });
      console.error("Publish error:", err);
    }
  };

  const handleRepublishPage = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    const doc = documents.find((d) => d.id === docId);
    if (!doc?.content_html) {
      toast({ title: "Error", description: "No content to publish.", variant: "destructive" });
      return;
    }

    const docProjectId = doc.project_id;
    const hasPermission =
      selectedProject?.id === docProjectId ? permissions.canPublish : await canPublishForProject(docProjectId);

    if (!hasPermission) {
      toast({ title: "Permission Denied", description: "You don't have permission to publish pages.", variant: "destructive" });
      await logUnauthorizedAttempt("republish", "document", docId, docProjectId, "canPublish");
      return;
    }

    const { data, error } = await invokeFunction<{ ok?: boolean; document?: any; error?: string }>("update-document", {
      body: {
        documentId: docId,
        data: {
          is_published: true,
          published_content_id: doc.content_id,
          published_content_html: doc.content_html,
        },
      },
    });

    if (error || !data?.ok) {
      toast({ title: "Error", description: "Failed to republish.", variant: "destructive" });
    } else {
      await logAction("republish", "document", docId, docProjectId, { documentTitle: doc?.title });
      toast({ title: "Republished", description: "Changes are now live." });
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, is_published: true, published_content_id: d.content_id, published_content_html: d.content_html }
            : d
        )
      );
    }
  };

  // Bulk actions
  const handleSelectDoc = (docId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const handleSelectAll = (visibleDocuments: Document[]) => {
    if (selectedDocIds.size === visibleDocuments.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(visibleDocuments.map((d) => d.id)));
    }
  };

  const runBulkPublish = async (docIds: string[]) => {
    if (!permissions.canPublish) {
      toast({ title: "Permission Denied", description: "You don't have permission to publish pages.", variant: "destructive" });
      return;
    }

    setIsBulkPublishing(true);
    const docsToPublish = documents.filter((d) => docIds.includes(d.id) && !d.is_published);

    if (docsToPublish.length === 0) {
      toast({ title: "No pages to publish", description: "Selected pages are already published.", variant: "destructive" });
      setIsBulkPublishing(false);
      return;
    }

    setBulkProgress({ total: docsToPublish.length, processed: 0, failed: 0, mode: "publish" });
    let successCount = 0;
    let failureCount = 0;
    const failedDocIds: string[] = [];
    const errors: string[] = [];

    try {
      for (const doc of docsToPublish) {
        let itemFailed = false;
        try {
          const { data, error } = await invokeFunction<{ ok?: boolean; document?: any; error?: string }>("update-document", {
            body: {
              documentId: doc.id,
              data: {
                is_published: true,
                ...(doc.content_html ? { published_content_html: doc.content_html } : {}),
                ...(doc.content_id ? { published_content_id: doc.content_id } : {}),
              },
            },
          });

          if (!error && data?.ok) {
            successCount++;
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === doc.id
                  ? {
                      ...d,
                      is_published: true,
                      published_content_html: d.content_html || d.published_content_html,
                      published_content_id: d.content_id || d.published_content_id,
                    }
                  : d
              )
            );
            await logAction("publish", "document", doc.id, doc.project_id, { documentTitle: doc.title, bulk: true });
          } else {
            failureCount++;
            const errorMsg = error?.message || data?.error || "Unknown error";
            errors.push(`${doc.title}: ${errorMsg}`);
            console.error(`Failed to publish ${doc.title}:`, error || data?.error);
            itemFailed = true;
          }
        } catch (err) {
          failureCount++;
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`${doc.title}: ${errorMsg}`);
          console.error(`Error publishing ${doc.title}:`, err);
          itemFailed = true;
        } finally {
          if (itemFailed) failedDocIds.push(doc.id);
          setBulkProgress((prev) =>
            prev
              ? {
                  ...prev,
                  processed: prev.processed + 1,
                  failed: prev.failed + (itemFailed ? 1 : 0),
                }
              : prev
          );
        }
      }

      if (successCount > 0) {
        const message = failureCount > 0
          ? `Published ${successCount} page${successCount > 1 ? "s" : ""} successfully. ${failureCount} failed.`
          : `Published ${successCount} page${successCount > 1 ? "s" : ""} successfully.`;
        toast({ 
          title: "Bulk Publish Complete", 
          description: message,
          ...(failureCount > 0 ? { variant: "destructive" as const, duration: 10000 } : {}),
        });
        if (failureCount > 0 && errors.length > 0) {
          console.error("Bulk publish errors:", errors);
          setLastBulkFailures({ mode: "publish", docIds: failedDocIds });
        } else {
          setLastBulkFailures(null);
        }
        setSelectedDocIds(new Set());
        fetchData();
      } else {
        toast({ 
          title: "Bulk Publish Failed", 
          description: `Failed to publish ${failureCount} page${failureCount > 1 ? "s" : ""}. ${errors.slice(0, 3).join("; ")}`,
          variant: "destructive",
          duration: 10000,
        });
        setLastBulkFailures({ mode: "publish", docIds: failedDocIds });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast({ 
        title: "Bulk Publish Error", 
        description: errorMessage,
        variant: "destructive",
        duration: 8000,
      });
      console.error("Bulk publish error:", err);
    } finally {
      setIsBulkPublishing(false);
      setBulkProgress(null);
    }
  };

  const handleBulkPublish = async () => {
    await runBulkPublish(Array.from(selectedDocIds));
  };

  const runBulkUnpublish = async (docIds: string[]) => {
    if (!permissions.canPublish) {
      toast({ title: "Permission Denied", description: "You don't have permission to unpublish pages.", variant: "destructive" });
      return;
    }

    setIsBulkUnpublishing(true);
    const docsToUnpublish = documents.filter((d) => docIds.includes(d.id) && d.is_published);

    if (docsToUnpublish.length === 0) {
      toast({ title: "No pages to unpublish", description: "No published pages were selected.", variant: "destructive" });
      setIsBulkUnpublishing(false);
      return;
    }

    setBulkProgress({ total: docsToUnpublish.length, processed: 0, failed: 0, mode: "unpublish" });
    let successCount = 0;
    let failureCount = 0;
    const failedDocIds: string[] = [];
    const errors: string[] = [];

    try {
      for (const doc of docsToUnpublish) {
        let itemFailed = false;
        try {
          const { data, error } = await invokeFunction<{ ok?: boolean; document?: any; error?: string }>("update-document", {
            body: { documentId: doc.id, data: { is_published: false, published_content_id: null, published_content_html: null } },
          });

          if (!error && data?.ok) {
            successCount++;
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === doc.id
                  ? { ...d, is_published: false, published_content_html: null, published_content_id: null }
                  : d
              )
            );
            await logAction("unpublish", "document", doc.id, doc.project_id, { documentTitle: doc.title, bulk: true });
          } else {
            failureCount++;
            const errorMsg = error?.message || data?.error || "Unknown error";
            errors.push(`${doc.title}: ${errorMsg}`);
            console.error(`Failed to unpublish ${doc.title}:`, error || data?.error);
            itemFailed = true;
          }
        } catch (err) {
          failureCount++;
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`${doc.title}: ${errorMsg}`);
          console.error(`Error unpublishing ${doc.title}:`, err);
          itemFailed = true;
        } finally {
          if (itemFailed) failedDocIds.push(doc.id);
          setBulkProgress((prev) =>
            prev
              ? {
                  ...prev,
                  processed: prev.processed + 1,
                  failed: prev.failed + (itemFailed ? 1 : 0),
                }
              : prev
          );
        }
      }

      if (successCount > 0) {
        const message = failureCount > 0
          ? `Unpublished ${successCount} page${successCount > 1 ? "s" : ""} successfully. ${failureCount} failed.`
          : `Unpublished ${successCount} page${successCount > 1 ? "s" : ""} successfully.`;
        toast({ 
          title: "Bulk Unpublish Complete", 
          description: message,
          ...(failureCount > 0 ? { variant: "destructive" as const, duration: 10000 } : {}),
        });
        if (failureCount > 0 && errors.length > 0) {
          console.error("Bulk unpublish errors:", errors);
          setLastBulkFailures({ mode: "unpublish", docIds: failedDocIds });
        } else {
          setLastBulkFailures(null);
        }
        setSelectedDocIds(new Set());
        fetchData();
      } else {
        toast({ 
          title: "Bulk Unpublish Failed", 
          description: `Failed to unpublish ${failureCount} page${failureCount > 1 ? "s" : ""}. ${errors.slice(0, 3).join("; ")}`,
          variant: "destructive",
          duration: 10000,
        });
        setLastBulkFailures({ mode: "unpublish", docIds: failedDocIds });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast({ 
        title: "Bulk Unpublish Error", 
        description: errorMessage,
        variant: "destructive",
        duration: 8000,
      });
      console.error("Bulk unpublish error:", err);
    } finally {
      setIsBulkUnpublishing(false);
      setBulkProgress(null);
    }
  };

  const handleBulkUnpublish = async () => {
    await runBulkUnpublish(Array.from(selectedDocIds));
  };

  const runBulkDelete = async (docIds: string[]) => {
    if (!permissions.canDeleteDocument) {
      toast({ title: "Permission Denied", description: "You don't have permission to delete pages.", variant: "destructive" });
      return;
    }

    setIsBulkDeleting(true);
    setBulkProgress({ total: docIds.length, processed: 0, failed: 0, mode: "delete" });
    let successCount = 0;
    let failureCount = 0;
    const failedDocIds: string[] = [];
    const errors: string[] = [];

    try {
      for (const docId of docIds) {
        let itemFailed = false;
        try {
          const doc = documents.find((d) => d.id === docId);
          const { data, error } = await invokeFunction<{ ok?: boolean; error?: string }>("delete-document", {
            body: { documentId: docId },
          });
          
          if (!error && data?.ok) {
            successCount++;
            if (doc?.google_doc_id && googleAccessToken) {
              // Try to trash Drive file, but don't fail if it doesn't work
              try {
                await trashFile(doc.google_doc_id);
              } catch (trashErr) {
                console.warn(`Failed to trash Drive file for ${doc.title}:`, trashErr);
              }
            }
            setDocuments((prev) => prev.filter((d) => d.id !== docId));
          } else {
            failureCount++;
            const errorMsg = error?.message || data?.error || "Unknown error";
            const docTitle = doc?.title || docId;
            errors.push(`${docTitle}: ${errorMsg}`);
            console.error(`Failed to delete ${docTitle}:`, error || data?.error);
            itemFailed = true;
          }
        } catch (err) {
          failureCount++;
          const doc = documents.find((d) => d.id === docId);
          const docTitle = doc?.title || docId;
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`${docTitle}: ${errorMsg}`);
          console.error(`Error deleting ${docTitle}:`, err);
          itemFailed = true;
        } finally {
          if (itemFailed) failedDocIds.push(docId);
          setBulkProgress((prev) =>
            prev
              ? {
                  ...prev,
                  processed: prev.processed + 1,
                  failed: prev.failed + (itemFailed ? 1 : 0),
                }
              : prev
          );
        }
      }

      if (successCount > 0) {
        const message = failureCount > 0
          ? `Deleted ${successCount} page${successCount > 1 ? "s" : ""} successfully. ${failureCount} failed.`
          : `Deleted ${successCount} page${successCount > 1 ? "s" : ""} successfully.`;
        toast({ 
          title: "Bulk Delete Complete", 
          description: message,
          ...(failureCount > 0 ? { variant: "destructive" as const, duration: 10000 } : {}),
        });
        if (failureCount > 0 && errors.length > 0) {
          console.error("Bulk delete errors:", errors);
          setLastBulkFailures({ mode: "delete", docIds: failedDocIds });
        } else {
          setLastBulkFailures(null);
        }
        setSelectedDocIds(new Set());
        fetchData();
      } else {
        toast({ 
          title: "Bulk Delete Failed", 
          description: `Failed to delete ${failureCount} page${failureCount > 1 ? "s" : ""}. ${errors.slice(0, 3).join("; ")}`,
          variant: "destructive",
          duration: 10000,
        });
        setLastBulkFailures({ mode: "delete", docIds: failedDocIds });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast({ 
        title: "Bulk Delete Error", 
        description: errorMessage,
        variant: "destructive",
        duration: 8000,
      });
      console.error("Bulk delete error:", err);
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteDialogOpen(false);
      setBulkProgress(null);
    }
  };

  const handleBulkDelete = async () => {
    await runBulkDelete(Array.from(selectedDocIds));
  };

  const retryBulkFailures = async () => {
    if (!lastBulkFailures || lastBulkFailures.docIds.length === 0) return;
    setSelectedDocIds(new Set(lastBulkFailures.docIds));
    if (lastBulkFailures.mode === "publish") {
      await runBulkPublish(lastBulkFailures.docIds);
      return;
    }
    if (lastBulkFailures.mode === "unpublish") {
      await runBulkUnpublish(lastBulkFailures.docIds);
      return;
    }
    await runBulkDelete(lastBulkFailures.docIds);
  };

  const clearSelection = () => setSelectedDocIds(new Set());

  // Open in Drive
  const handleOpenInDrive = (googleDocId: string) => {
    window.open(`https://docs.google.com/document/d/${googleDocId}/edit`, "_blank");
  };

  // Share project
  const handleShareProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (!permissions.canManageMembers) {
      toast({ title: "Permission Denied", description: "You don't have permission to share projects.", variant: "destructive" });
      await logUnauthorizedAttempt("share_project", "project", project.id, project.id, "canManageMembers");
      return;
    }
    setSelectedProject(project);
    return true; // signal to caller to open share panel
  };

  // Assign project
  const handleAssignProject = async () => {
    if (!assignTargetDoc || !assignProjectId) return;
    setIsAssigningProject(true);

    try {
      const project = projects.find((p) => p.id === assignProjectId);
      let versionId = resolveDefaultVersion(assignProjectId)?.id ?? null;
      if (!versionId) {
        versionId = await ensureDefaultVersionForProject(assignProjectId, project?.is_published ?? false);
      }

      const assignableTopics = getAssignableTopics(assignProjectId, versionId);
      const finalTopicId =
        assignTopicId && assignableTopics.some((t: any) => t.id === assignTopicId) ? assignTopicId : null;

      const { data: updated, error } = await invokeFunction<{ ok?: boolean; document?: any; error?: string }>(
        "update-document",
        {
          body: {
            documentId: assignTargetDoc.id,
            data: {
              project: assignProjectId,
              project_version: versionId,
              topic: finalTopicId,
            },
          },
        }
      );

      if (error || !updated?.ok) {
        toast({ title: "Couldn't assign project", description: error?.message || "No changes were applied.", variant: "destructive" });
        return;
      }

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === assignTargetDoc.id
            ? { ...doc, project_id: assignProjectId, project_version_id: versionId ?? doc.project_version_id, topic_id: finalTopicId }
            : doc
        )
      );

      setAssignProjectOpen(false);
      setAssignTargetDoc(null);
      setAssignProjectId("");
      setAssignTopicId("");
      toast({ title: "Project assigned", description: "This page now belongs to the selected project." });
    } catch (error: any) {
      toast({ title: "Couldn't assign project", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsAssigningProject(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out", description: "You have been signed out successfully." });
    navigate("/");
  };

  // Document update callback
  const handleDocumentUpdate = async () => {
    if (!selectedDocument) return;
    const { data: freshRes, error } = await strapiFetch<{ data: any }>(
      `/api/documents/${selectedDocument.id}?populate[owner][fields][0]=full_name&populate[owner][fields][1]=email&populate[owner][fields][2]=username&populate[project][fields][0]=id&populate[project_version][fields][0]=id&populate[topic][fields][0]=id`
    );
    if (error || !freshRes?.data) return;
    const updatedDoc = mapDocumentFromStrapi(freshRes.data);
    setSelectedDocument(updatedDoc as Document);
    setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? (updatedDoc as Document) : d)));
  };

  return {
    // Delete
    deleteDialogOpen,
    setDeleteDialogOpen,
    itemToDelete,
    setItemToDelete,
    forceDeleteAvailable,
    setForceDeleteAvailable,
    handleDeleteProject,
    handleDeleteTopic,
    handleDeleteDocument,
    confirmDelete,

    // Publish
    handleTogglePublishPage,
    handleRepublishPage,

    // Bulk actions
    selectedDocIds,
    setSelectedDocIds,
    isBulkPublishing,
    isBulkUnpublishing,
    isBulkDeleting,
    bulkDeleteDialogOpen,
    bulkProgress,
    lastBulkFailures,
    setBulkDeleteDialogOpen,
    handleSelectDoc,
    handleSelectAll,
    handleBulkPublish,
    handleBulkUnpublish,
    handleBulkDelete,
    clearSelection,
    retryBulkFailures,

    // Assign
    assignProjectOpen,
    setAssignProjectOpen,
    assignTargetDoc,
    setAssignTargetDoc,
    assignProjectId,
    setAssignProjectId,
    assignTopicId,
    setAssignTopicId,
    isAssigningProject,
    handleAssignProject,

    // Other
    handleOpenInDrive,
    handleShareProject,
    handleSignOut,
    handleDocumentUpdate,
  };
};
