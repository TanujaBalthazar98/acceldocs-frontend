import { useState } from "react";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useDriveRecovery } from "@/hooks/useDriveRecovery";
import { invokeFunction } from "@/lib/api/functions";
import { list } from "@/lib/api/queries";
import { buildDriveFolderTree } from "@/lib/driveFolderTree";
import type { Project, ProjectVersion, Topic, Document } from "@/types/dashboard";

interface UseDriveSyncOptions {
  rootFolderId: string | null;
  organizationId: string | null;
  organizationName: string;
  appRole: string | null;
  projects: Project[];
  projectVersions: ProjectVersion[];
  topics: Topic[];
  toast: (opts: any) => void;
  setNeedsDriveAccess: (v: boolean) => void;
  fetchData: () => Promise<void>;
  resolveDefaultVersion: (projectId: string) => ProjectVersion | null;
  ensureDefaultVersionForProject: (projectId: string, isPublished: boolean) => Promise<string | null>;
}

export const useDriveSync = ({
  rootFolderId,
  organizationId,
  organizationName,
  appRole,
  projects,
  toast,
  setNeedsDriveAccess,
  fetchData,
  resolveDefaultVersion,
  ensureDefaultVersionForProject,
}: UseDriveSyncOptions) => {
  const { listFolder, trashFile, getGoogleToken, uploadFile } = useGoogleDrive();
  const { attemptRecovery } = useDriveRecovery();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const envRootFolderId =
    (import.meta.env.VITE_GOOGLE_DRIVE_ROOT_FOLDER_ID as string | undefined)?.trim() || null;

  const resolveRootFolderId = async (): Promise<string | null> => {
    if (rootFolderId) return rootFolderId;
    if (envRootFolderId) return envRootFolderId;

    const topLevelParentIds = projects
      .filter((project) => !project.parent_id && !!project.drive_parent_id)
      .map((project) => project.drive_parent_id as string);
    if (topLevelParentIds.length > 0) {
      const uniqueParentIds = Array.from(new Set(topLevelParentIds));
      if (uniqueParentIds.length === 1) {
        return uniqueParentIds[0];
      }
    }

    try {
      const { data } = await invokeFunction<{
        ok?: boolean;
        drive_folder_id?: string | null;
        organization?: { drive_folder_id?: string | null };
      }>("get-organization", { body: {} });

      const resolved = data?.drive_folder_id || data?.organization?.drive_folder_id || null;
      return resolved ? String(resolved) : null;
    } catch {
      return null;
    }
  };

  const handleUploadFile = async (parentTopic: Topic) => {
    if (!parentTopic.drive_folder_id) {
      toast({
        title: "Error",
        description: "Topic does not have a Drive folder ID.",
        variant: "destructive",
      });
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "*/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsUploading(true);
      toast({
        title: "Uploading...",
        description: `Uploading ${file.name} to ${parentTopic.name}...`,
      });

      try {
        let targetMimeType: string | undefined = undefined;
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
          targetMimeType = "application/vnd.google-apps.document";
        } else if (fileName.endsWith(".md") || fileName.endsWith(".markdown")) {
          targetMimeType = "application/vnd.google-apps.document";
        } else if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
          targetMimeType = "application/vnd.google-apps.document";
        }

        const result = await uploadFile(file, parentTopic.drive_folder_id, parentTopic.project_id, targetMimeType);

        if (result) {
          toast({
            title: "Success",
            description: "File uploaded successfully. Refreshing...",
          });
          await fetchData();
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Error",
          description: "An unexpected error occurred during upload.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    };
    input.click();
  };

  const handleNormalizeStructure = async (projectId: string) => {
    setIsNormalizing(true);
    try {
      const { data, error } = await invokeFunction("normalize-structure", {
        body: { projectId },
      });
      if (error) throw error;
      toast({
        title: "Structure Normalized",
        description: `Merged ${data?.mergedCount || 0} topics into parent-child hierarchy.`,
      });
      await fetchData();
    } catch (error: any) {
      console.error("Normalize error:", error);
      toast({
        title: "Normalization Failed",
        description: error.message || "Could not normalize topic structure.",
        variant: "destructive",
      });
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleRepairHierarchy = async (projectId: string) => {
    setIsRepairing(true);
    try {
      const { data: dryRunData, error: dryRunError } = await invokeFunction("repair-hierarchy", {
        body: { projectId, dryRun: true },
      });
      if (dryRunError) throw dryRunError;

      if (dryRunData?.duplicatesFound === 0) {
        toast({
          title: "No duplicates found",
          description: "Your project hierarchy looks good!",
        });
        setIsRepairing(false);
        return;
      }

      const { data, error } = await invokeFunction("repair-hierarchy", {
        body: { projectId, dryRun: false },
      });
      if (error) throw error;

      toast({
        title: "Hierarchy Repaired",
        description: `Found ${data?.duplicatesFound || 0} duplicates, applied ${data?.repairsApplied || 0} repairs.`,
      });
      await fetchData();
    } catch (error: any) {
      console.error("Repair error:", error);
      toast({
        title: "Repair Failed",
        description: error.message || "Could not repair hierarchy.",
        variant: "destructive",
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleSyncFromDrive = async () => {
    const effectiveRootFolderId = await resolveRootFolderId();
    if (!effectiveRootFolderId || !organizationId) {
      toast({
        title: "Cannot sync",
        description: "Please configure your root folder in Settings first.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);

    try {
      const folderTree = await buildDriveFolderTree(listFolder, {
        rootFolderId: effectiveRootFolderId,
        rootName: organizationName || "Root",
      });

      const folderNodes = folderTree.folders
        .filter((node) => node.id !== effectiveRootFolderId)
        .sort((a, b) => a.depth - b.depth);
      const nodeById = new Map(folderNodes.map((node) => [node.id, node]));
      const topLevelFolders = folderNodes.filter(
        (node) => node.parentId === effectiveRootFolderId && node.depth === 1
      );

      if (topLevelFolders.length === 0) {
        toast({
          title: "No folders found",
          description: "Your root folder doesn't contain any subfolders yet.",
        });
        return;
      }

      setNeedsDriveAccess(false);

      const docMimeType = "application/vnd.google-apps.document";
      const projectIdByFolderId = new Map<string, string>();
      const versionIdByProjectId = new Map<string, string | null>();
      const topicIdByFolderId = new Map<string, string>();
      const normalizeProjectName = (value: string) => value.trim().toLowerCase();
      const projectsByDriveId = new Map<string, Project>();
      const projectsByNameParent = new Map<string, Project[]>();
      for (const project of projects) {
        if (project.drive_folder_id) {
          projectsByDriveId.set(project.drive_folder_id, project);
        }
        const nameKey = `${project.parent_id || "root"}::${normalizeProjectName(project.name)}`;
        const arr = projectsByNameParent.get(nameKey) ?? [];
        arr.push(project);
        projectsByNameParent.set(nameKey, arr);
      }
      let syncedProjects = 0;
      let syncedTopics = 0;
      let syncedDocs = 0;

      const getTopFolderId = (nodeId: string): string | null => {
        let current = nodeById.get(nodeId);
        while (current) {
          if (current.parentId === effectiveRootFolderId) return current.id;
          current = current.parentId ? nodeById.get(current.parentId) : undefined;
        }
        return null;
      };

      const getParentIdFromRow = (row: any): string | null => {
        const attrs = row?.attributes || row || {};
        const parentRaw =
          attrs.parent?.data?.id ?? attrs.parent?.id ?? attrs.parent_id ?? attrs.parent ?? null;
        return parentRaw && parentRaw !== "null" && parentRaw !== "undefined" ? String(parentRaw) : null;
      };

      const getDriveParentIdFromRow = (row: any): string | null => {
        const attrs = row?.attributes || row || {};
        const raw = attrs.drive_parent_id ?? attrs.driveParentId ?? attrs.drive_parent ?? null;
        return raw && raw !== "null" && raw !== "undefined" ? String(raw) : null;
      };

      const pickExistingProject = (name: string, parentId: string | null, folderId: string) => {
        const byDrive = projectsByDriveId.get(folderId);
        if (byDrive) return byDrive;
        const nameKey = `${parentId || "root"}::${normalizeProjectName(name)}`;
        const candidates = projectsByNameParent.get(nameKey) ?? [];
        const withoutDrive = candidates.find((p) => !p.drive_folder_id);
        return withoutDrive || candidates[0] || null;
      };

      // Sync top-level folders as projects
      for (const node of topLevelFolders) {
        let projectId: string | null = null;
        let projectIsPublished = false;
        let existingParentId: string | null = null;
        let existingDriveParentId: string | null = null;

        const existingFromState = pickExistingProject(node.name, null, node.id);
        if (existingFromState) {
          projectId = existingFromState.id;
          projectIsPublished = existingFromState.is_published ?? false;
          existingParentId = existingFromState.parent_id ?? null;
          existingDriveParentId = existingFromState.drive_parent_id ?? null;
        } else {
          const { data: projectRows } = await list("projects", {
            filters: { drive_folder_id: node.id },
            limit: 1,
          });
          const existingProject = Array.isArray(projectRows) ? projectRows[0] : null;
          projectId = existingProject?.id ?? null;
          projectIsPublished = existingProject?.is_published ?? false;
          existingParentId = existingProject ? getParentIdFromRow(existingProject) : null;
          existingDriveParentId = existingProject ? getDriveParentIdFromRow(existingProject) : null;
        }

        if (!projectId) {
          const { data: created, error: projectError } = await invokeFunction<{
            ok?: boolean;
            projectId?: string;
            versionId?: string;
            error?: string;
          }>("create-project", {
            body: {
              name: node.name,
              organizationId,
              parentId: null,
              driveFolderId: node.id,
              driveParentId: effectiveRootFolderId,
              isPublished: false,
            },
          });

          if (projectError || !created?.ok || !created?.projectId) {
            console.error("Error creating project:", projectError || created?.error);
            continue;
          }

          projectId = created.projectId;
          projectIsPublished = false;
          syncedProjects++;
          if (created.versionId) {
            versionIdByProjectId.set(projectId, created.versionId);
          }
        } else {
          const updateData: Record<string, unknown> = {};
          if (existingParentId) updateData.parent = null;
          if (!projectsByDriveId.has(node.id)) updateData.drive_folder_id = node.id;
          if (existingDriveParentId !== effectiveRootFolderId) updateData.drive_parent_id = effectiveRootFolderId;
          if (Object.keys(updateData).length > 0) {
            await invokeFunction("update-project-settings", {
              body: { projectId, data: updateData },
            });
          }
        }

        projectIdByFolderId.set(node.id, projectId);
        if (!versionIdByProjectId.has(projectId)) {
          const defaultVersionId = await ensureDefaultVersionForProject(projectId, projectIsPublished);
          versionIdByProjectId.set(projectId, defaultVersionId ?? null);
        }
      }

      // Sync depth-2 folders as sub-projects
      const subProjectFolders = folderNodes.filter(
        (node) => node.depth === 2 && node.parentId && projectIdByFolderId.has(node.parentId)
      );

      for (const node of subProjectFolders) {
        if (projectIdByFolderId.has(node.id)) continue;
        const parentProjectId = node.parentId ? projectIdByFolderId.get(node.parentId) : null;
        if (!parentProjectId) continue;

        let projectId: string | null = null;
        let projectIsPublished = false;
        let existingParentId: string | null = null;
        let existingDriveParentId: string | null = null;

        const existingFromState = pickExistingProject(node.name, parentProjectId, node.id);
        if (existingFromState) {
          projectId = existingFromState.id;
          projectIsPublished = existingFromState.is_published ?? false;
          existingParentId = existingFromState.parent_id ?? null;
          existingDriveParentId = existingFromState.drive_parent_id ?? null;
        } else {
          const { data: projectRows } = await list("projects", {
            filters: { drive_folder_id: node.id },
            limit: 1,
          });
          const existingProject = Array.isArray(projectRows) ? projectRows[0] : null;
          projectId = existingProject?.id ?? null;
          projectIsPublished = existingProject?.is_published ?? false;
          existingParentId = existingProject ? getParentIdFromRow(existingProject) : null;
          existingDriveParentId = existingProject ? getDriveParentIdFromRow(existingProject) : null;
        }

        if (!projectId) {
          const { data: created, error: projectError } = await invokeFunction<{
            ok?: boolean;
            projectId?: string;
            versionId?: string;
            error?: string;
          }>("create-project", {
            body: {
              name: node.name,
              organizationId,
              parentId: parentProjectId,
              driveFolderId: node.id,
              driveParentId: node.parentId,
              isPublished: false,
            },
          });

          if (projectError || !created?.ok || !created?.projectId) {
            console.error("Error creating sub-project:", projectError || created?.error);
            continue;
          }

          projectId = created.projectId;
          projectIsPublished = false;
          syncedProjects++;
          if (created.versionId) {
            versionIdByProjectId.set(projectId, created.versionId);
          }
        } else {
          const updateData: Record<string, unknown> = {};
          if (existingParentId !== parentProjectId) updateData.parent = parentProjectId;
          if (!projectsByDriveId.has(node.id)) updateData.drive_folder_id = node.id;
          if (existingDriveParentId !== (node.parentId || null)) updateData.drive_parent_id = node.parentId || null;
          if (Object.keys(updateData).length > 0) {
            await invokeFunction("update-project-settings", {
              body: { projectId, data: updateData },
            });
          }
        }

        projectIdByFolderId.set(node.id, projectId);
        if (!versionIdByProjectId.has(projectId)) {
          const defaultVersionId = await ensureDefaultVersionForProject(projectId, projectIsPublished);
          versionIdByProjectId.set(projectId, defaultVersionId ?? null);
        }
      }

      const getProjectForNode = (nodeId: string): string | null => {
        let current = nodeById.get(nodeId);
        while (current) {
          const projectId = projectIdByFolderId.get(current.id);
          if (projectId) return projectId;
          current = current.parentId ? nodeById.get(current.parentId) : undefined;
        }
        return null;
      };

      // Sync deeper folders as topics
      const topicNodes = folderNodes
        .filter((node) => node.depth >= 3)
        .sort((a, b) => a.depth - b.depth);

      for (const node of topicNodes) {
        const projectId = getProjectForNode(node.id);
        if (!projectId) continue;

        const defaultVersionId = versionIdByProjectId.get(projectId) ?? null;
        const parentTopicId =
          node.parentId && topicIdByFolderId.has(node.parentId)
            ? topicIdByFolderId.get(node.parentId) ?? null
            : null;

        const { data: topicRows } = await list("topics", {
          filters: { drive_folder_id: node.id },
          limit: 1,
        });
        const existingTopic = Array.isArray(topicRows) ? topicRows[0] : null;

        if (existingTopic?.id) {
          topicIdByFolderId.set(node.id, existingTopic.id);
          continue;
        }

        const { data: created, error: topicError } = await invokeFunction<{
          ok?: boolean;
          topicId?: string;
          error?: string;
        }>("create-topic", {
          body: {
            name: node.name,
            projectId,
            projectVersionId: defaultVersionId,
            parentId: parentTopicId,
            driveFolderId: node.id,
          },
        });

        if (topicError || !created?.ok || !created?.topicId) {
          console.error("Error creating topic:", topicError || created?.error);
          continue;
        }

        topicIdByFolderId.set(node.id, created.topicId);
        syncedTopics++;
      }

      // Sync documents from all folders
      for (const node of folderNodes) {
        const projectId = getProjectForNode(node.id);
        if (!projectId) continue;

        const defaultVersionId = versionIdByProjectId.get(projectId) ?? null;
        const topicId = node.depth >= 3 ? topicIdByFolderId.get(node.id) ?? null : null;
        const projectResult = await listFolder(node.id);

        if (projectResult.needsDriveAccess) {
          toast({
            title: "Drive access required",
            description:
              appRole === "owner"
                ? "Please reconnect Google Drive to sync your folders."
                : "The workspace owner needs to reconnect Google Drive.",
          });
          const recovery = await attemptRecovery("Drive access required");
          setNeedsDriveAccess(recovery.isOwner);
          return;
        }

        if (!projectResult.files) continue;

        const docs = projectResult.files.filter((item) => item.mimeType === docMimeType);

        for (const doc of docs) {
          const { data: docRows } = await list("documents", {
            filters: { google_doc_id: doc.id },
            limit: 50,
          });
          let existingDocs: any[] = Array.isArray(docRows) ? docRows : [];
          let existingDoc: any = existingDocs[0] || null;

          if (existingDocs.length > 1) {
            existingDoc =
              existingDocs.find((row) => row?.attributes?.is_published) ||
              existingDocs.sort((a, b) => {
                const aUpdated = Date.parse(a?.attributes?.updatedAt || a?.updatedAt || "") || 0;
                const bUpdated = Date.parse(b?.attributes?.updatedAt || b?.updatedAt || "") || 0;
                return bUpdated - aUpdated;
              })[0];

            for (const dup of existingDocs) {
              if (!existingDoc || dup?.id === existingDoc?.id) continue;
              await invokeFunction("delete-document", { body: { documentId: dup.id } });
            }
          }

          let docRecordId: string | null = null;

          if (existingDoc) {
            docRecordId = String((existingDoc as any).id);
            const payload = {
              title: doc.name,
              google_modified_at: doc.modifiedTime,
              ...((defaultVersionId && !(existingDoc as any)?.attributes?.project_version?.data?.id)
                ? { project_version: defaultVersionId }
                : {}),
              ...((topicId && !(existingDoc as any)?.attributes?.topic?.data?.id)
                ? { topic: topicId }
                : {}),
            };
            await invokeFunction("update-document", {
              body: { documentId: docRecordId, data: payload as any },
            });
          } else {
            const { data: created, error: docError } = await invokeFunction<{
              ok?: boolean;
              documentId?: string;
              error?: string;
            }>("create-document", {
              body: {
                title: doc.name,
                googleDocId: doc.id,
                projectId,
                projectVersionId: defaultVersionId,
                topicId,
                isPublished: false,
                visibility: "internal",
              },
            });

            if (!docError && created?.ok) {
              docRecordId = created.documentId ?? null;
              syncedDocs++;
            } else if (docError || created?.error) {
              console.error("Error creating document:", docError || created?.error);
            }
          }

          // Sync document content from Google Drive
          if (docRecordId && doc.id) {
            const token = getGoogleToken();
            await invokeFunction("google-drive", {
              body: {
                action: "sync_doc_content",
                documentId: docRecordId,
                googleDocId: doc.id,
              },
              ...(token ? { headers: { "x-google-token": token } } : {}),
            });
          }
        }
      }

      // Sync docs sitting directly at the root Drive folder (not inside any subfolder)
      const rootResult = await listFolder(effectiveRootFolderId);
      if (rootResult.files) {
        const rootDocs = rootResult.files.filter((item) => item.mimeType === docMimeType);
        if (rootDocs.length > 0) {
          // Find or create a "General" project for root-level docs
          let generalProjectId: string | null = null;
          let generalVersionId: string | null = null;

          const existingGeneral = projects.find(
            (p) => p.name.toLowerCase() === "general" && !p.parent_id
          );
          if (existingGeneral) {
            generalProjectId = existingGeneral.id;
            generalVersionId = versionIdByProjectId.get(existingGeneral.id) ?? null;
            if (!generalVersionId) {
              generalVersionId = await ensureDefaultVersionForProject(generalProjectId, false);
              versionIdByProjectId.set(generalProjectId, generalVersionId ?? null);
            }
          } else {
            const { data: projRes } = await invokeFunction<{
              ok?: boolean;
              project?: { id?: string | number };
              projectId?: string;
              versionId?: string;
            }>("create-project", {
              body: { name: "General", organizationId, driveFolderId: null },
            });
            const newId = String(projRes?.project?.id || projRes?.projectId || "");
            if (newId) {
              generalProjectId = newId;
              generalVersionId = projRes?.versionId || null;
              syncedProjects++;
            }
          }

          if (generalProjectId) {
            for (const doc of rootDocs) {
              const { data: docRows } = await list("documents", {
                filters: { google_doc_id: doc.id },
                limit: 1,
              });
              const existing = Array.isArray(docRows) ? docRows[0] : null;
              if (existing) continue; // already imported

              const { data: created, error: docError } = await invokeFunction<{
                ok?: boolean;
                documentId?: string;
                error?: string;
              }>("create-document", {
                body: {
                  title: doc.name,
                  googleDocId: doc.id,
                  projectId: generalProjectId,
                  projectVersionId: generalVersionId,
                  topicId: null,
                  isPublished: false,
                  visibility: "internal",
                },
              });
              if (!docError && created?.ok) {
                syncedDocs++;
                if (created.documentId && doc.id) {
                  const token = getGoogleToken();
                  await invokeFunction("google-drive", {
                    body: { action: "sync_doc_content", documentId: created.documentId, googleDocId: doc.id },
                    ...(token ? { headers: { "x-google-token": token } } : {}),
                  });
                }
              }
            }
          }
        }
      }

      toast({
        title: "Sync complete",
        description: `Synced ${syncedProjects} new projects, ${syncedTopics} topics, and ${syncedDocs} documents.`,
      });

      fetchData();
    } catch (error: any) {
      console.error("Sync error:", error);

      const errorMessage = error.message || "";
      if (
        errorMessage.includes("Drive access required") ||
        errorMessage.includes("insufficient") ||
        errorMessage.includes("scope") ||
        errorMessage.includes("re-authenticate")
      ) {
        const recovery = await attemptRecovery(errorMessage);
        setNeedsDriveAccess(recovery.isOwner);
        toast({
          title: "Drive access required",
          description: recovery.isOwner
            ? "Please reconnect Google Drive to continue syncing."
            : "The workspace owner needs to reconnect Google Drive.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync from Google Drive.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    listFolder,
    trashFile,
    getGoogleToken,
    uploadFile,
    attemptRecovery,
    isSyncing,
    isUploading,
    isNormalizing,
    isRepairing,
    handleUploadFile,
    handleNormalizeStructure,
    handleRepairHierarchy,
    handleSyncFromDrive,
  };
};
