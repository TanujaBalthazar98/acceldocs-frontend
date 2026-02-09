import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Trash2,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  Globe,
  Lock,
  Eye,
  Send,
  CheckCircle,
  Search,
  Plus,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useDriveRecovery } from "@/hooks/useDriveRecovery";
import { useAuth } from "@/contexts/AuthContext";
import { buildDriveFolderTree } from "@/lib/driveFolderTree";
import { formatDistanceToNow } from "date-fns";
import { SEOSettings } from "./SEOSettings";
import { ProjectVersion } from "@/types/dashboard";

type VisibilityLevel = "internal" | "external" | "public";
type ProjectRole = "admin" | "editor" | "reviewer" | "viewer";
type ProjectMemberRole = ProjectRole | "owner";

interface ProjectMember {
  id: string;
  user_id: string;
  role: ProjectMemberRole;
  profile?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface ProjectSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName: string | null;
  onUpdate?: () => void;
}

const visibilityOptions: { value: VisibilityLevel; label: string; description: string; icon: typeof Lock }[] = [
  { value: "internal", label: "Internal", description: "Only organization members", icon: Lock },
  { value: "external", label: "External", description: "Authenticated external users", icon: Eye },
  { value: "public", label: "Public", description: "Anyone on the internet", icon: Globe },
];

const roleOptions: { value: ProjectRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "reviewer", label: "Reviewer" },
  { value: "viewer", label: "Viewer" },
];

export const ProjectSettingsPanel = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  onUpdate,
}: ProjectSettingsProps) => {
  const { toast } = useToast();
  const { listFolder, checkFolderAccess, trashFile, createFolder, moveFile } = useGoogleDrive();
  const { attemptRecovery } = useDriveRecovery();
  const { user, googleAccessToken, requestDriveAccess } = useAuth();
  
  const [name, setName] = useState(projectName || "");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<VisibilityLevel>("internal");
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isSyncingDrivePermissions, setIsSyncingDrivePermissions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [duplicateVersionOpen, setDuplicateVersionOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionSlug, setVersionSlug] = useState("");
  const [isDuplicatingVersion, setIsDuplicatingVersion] = useState(false);
  const [isRepairingDrive, setIsRepairingDrive] = useState(false);
  const [isCheckingOrphans, setIsCheckingOrphans] = useState(false);
  const [orphanedFiles, setOrphanedFiles] = useState<any[]>([]);
  const [isImportingOrphans, setIsImportingOrphans] = useState(false);
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([]);
  const [isPromoting, setIsPromoting] = useState(false);
  
  // Members state
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Sync status
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncedDocsCount, setSyncedDocsCount] = useState(0);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationDomain, setOrganizationDomain] = useState<string | null>(null);
  const [orgDriveFolderId, setOrgDriveFolderId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveFolderStatus, setDriveFolderStatus] = useState<"unknown" | "ok" | "missing" | "needs_access">("unknown");

  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const normalizeDomain = (value: string | null) => value?.trim().toLowerCase() ?? "";
  const getEmailDomain = (value: string) => normalizeEmail(value).split("@")[1] ?? "";
  const isExternalEmail = (value: string) => {
    const orgDomain = normalizeDomain(organizationDomain);
    if (!orgDomain) return false;
    const emailDomain = getEmailDomain(value);
    if (!emailDomain) return false;
    return emailDomain !== orgDomain;
  };

  // Repair hierarchy - detect and fix duplicate topics/sub-projects
  const handleRepairHierarchy = async () => {
    if (!projectId) return;
    setIsRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke('repair-hierarchy', {
        body: { projectId, dryRun: false }
      });
      
      if (error) throw error;
      
      if (data?.duplicatesFound === 0) {
        toast({
          title: "No duplicates found",
          description: "Your project hierarchy looks good!",
        });
      } else {
        toast({
          title: "Hierarchy Repaired",
          description: `Found ${data?.duplicatesFound || 0} duplicates, applied ${data?.repairsApplied || 0} repairs.`,
        });
        onUpdate?.();
      }
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

  // Check for orphaned files in Drive
  const handleCheckOrphanedFiles = async () => {
    if (!projectId || !driveFolderId) return;
    if (!googleAccessToken) {
      await attemptRecovery("Google authentication required");
      return;
    }

    setIsCheckingOrphans(true);
    setOrphanedFiles([]);
    
    try {
      // 1. Get all files from Drive folder (recursive)
      const { folders, files } = await buildDriveFolderTree(listFolder, {
        rootFolderId: driveFolderId,
        rootName: projectName ?? "Project",
        maxDepth: 8,
      });

      // 2. Get all documents from DB for this project
      const { data: dbDocs } = await supabase
        .from("documents")
        .select("google_doc_id")
        .eq("project_id", projectId);

      const dbDocIds = new Set((dbDocs || []).map(d => d.google_doc_id));
      
      // 3. Find files that are in Drive but NOT in DB
      const googleDocMimeTypes = [
        "application/vnd.google-apps.document",
        "application/vnd.google-apps.spreadsheet",
        "application/vnd.google-apps.presentation"
      ];

      const orphans = files.filter(file => 
        googleDocMimeTypes.includes(file.mimeType) && 
        !dbDocIds.has(file.id)
      );

      setOrphanedFiles(orphans);
      
      if (orphans.length === 0) {
        toast({
          title: "All clean!",
          description: "No orphaned files found in the project Drive folder.",
        });
      } else {
        toast({
          title: "Orphaned Files Found",
          description: `Found ${orphans.length} files that are not tracked in Docspeare.`,
        });
      }
    } catch (error: any) {
      console.error("Check orphans error:", error);
      toast({
        title: "Check Failed",
        description: error.message || "Could not check for orphaned files.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingOrphans(false);
    }
  };

  // Import selected orphaned files
  const handleImportOrphans = async () => {
    if (!projectId || orphanedFiles.length === 0) return;
    setIsImportingOrphans(true);

    try {
      // Get default version
      const { data: defaultVersion } = await supabase
        .from("project_versions")
        .select("id")
        .eq("project_id", projectId)
        .eq("is_default", true)
        .maybeSingle();
      
      const versionId = defaultVersion?.id;
      if (!versionId) throw new Error("Could not find default project version for import.");

      // For simplicity, we'll import them into the project root (no topic)
      // and they'll show up as unassigned
      let importedCount = 0;
      for (const file of orphanedFiles) {
        const { error } = await supabase
          .from("documents")
          .insert({
            project_id: projectId,
            project_version_id: versionId,
            google_doc_id: file.id,
            title: file.name,
            last_synced_at: new Date().toISOString(),
          });
        
        if (!error) importedCount++;
      }

      toast({
        title: "Import Complete",
        description: `Successfully imported ${importedCount} out of ${orphanedFiles.length} files.`,
      });
      setOrphanedFiles([]);
      onUpdate?.();
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import Failed",
        description: error.message || "Could not import some files.",
        variant: "destructive",
      });
    } finally {
      setIsImportingOrphans(false);
    }
  };

  // Fetch project data when opened
  useEffect(() => {
    if (open && projectId) {
      fetchProjectData();
      fetchMembers();
      fetchSyncStatus();
      fetchVersions();
    }
  }, [open, projectId]);

  useEffect(() => {
    if (!open || !projectId) return;

    let active = true;

    const checkFolder = async () => {
      if (!driveFolderId) {
        setDriveFolderStatus("unknown");
        return;
      }
      if (!googleAccessToken) {
        setDriveFolderStatus("needs_access");
        return;
      }

      const result = await checkFolderAccess(driveFolderId, projectId);
      if (!active) return;

      if (result.needsDriveAccess) {
        setDriveFolderStatus("needs_access");
        return;
      }
      if (!result.exists && result.errorCode === "FOLDER_NOT_ACCESSIBLE") {
        setDriveFolderStatus("missing");
        return;
      }
      if (result.exists) {
        setDriveFolderStatus("ok");
        return;
      }
      setDriveFolderStatus("unknown");
    };

    checkFolder();

    return () => {
      active = false;
    };
  }, [open, projectId, driveFolderId, googleAccessToken]);

  const fetchProjectData = async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from("projects")
      .select("name, slug, description, visibility, is_published, drive_folder_id, organization_id")
      .eq("id", projectId)
      .single();

    if (data) {
      setName(data.name);
      setSlug(data.slug || "");
      setDescription(data.description || "");
      setVisibility(data.visibility as VisibilityLevel);
      setIsPublished(data.is_published);
      setDriveFolderId(data.drive_folder_id);
      setOrganizationId(data.organization_id);
      if (data.organization_id) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("drive_folder_id, name")
          .eq("id", data.organization_id)
          .maybeSingle();
        if (orgData) {
          setOrgDriveFolderId(orgData.drive_folder_id);
          setOrgName(orgData.name);
        }
      }
    }
  };

  const fetchVersions = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("project_versions")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    
    if (data) {
      setProjectVersions(data as ProjectVersion[]);
    }
  };

  const handlePromoteVersion = async (versionId: string) => {
    if (!projectId) return;
    setIsPromoting(true);
    try {
      const { error } = await supabase.rpc("promote_version_to_default", {
        target_version_id: versionId,
      });

      if (error) throw error;

      toast({
        title: "Version Promoted",
        description: "The selected version is now the default.",
      });
      
      await fetchVersions();
      onUpdate?.();
    } catch (error: any) {
      console.error("Promotion error:", error);
      toast({
        title: "Promotion Failed",
        description: error.message || "Could not promote version.",
        variant: "destructive",
      });
    } finally {
      setIsPromoting(false);
    }
  };

  const createFolderWithRetry = async (folderName: string, parentId: string) => {
    let folder = await createFolder(folderName, parentId);
    if (folder?.id) return folder;
    const recovery = await attemptRecovery("Drive access required");
    if (recovery.recovered && recovery.shouldRetry) {
      folder = await createFolder(folderName, parentId);
    }
    return folder;
  };

  const ensureDriveStructure = async (rootProjectId: string, rootFolderId: string) => {
    const created: { projects: number; topics: number; docs: number } = { projects: 0, topics: 0, docs: 0 };

    const { data: rootProject } = await supabase
      .from("projects")
      .select("id, name, parent_id, drive_folder_id")
      .eq("id", rootProjectId)
      .maybeSingle();

    if (!rootProject) return created;

    const projectOrder: Array<{ id: string; name: string; parent_id: string | null; drive_folder_id: string | null }> = [rootProject];
    let queue = [rootProjectId];

    while (queue.length) {
      const { data: children } = await supabase
        .from("projects")
        .select("id, name, parent_id, drive_folder_id")
        .in("parent_id", queue);

      if (!children || children.length === 0) break;
      projectOrder.push(...children);
      queue = children.map((child) => child.id);
    }

    const projectFolderById = new Map<string, string>();
    projectFolderById.set(rootProjectId, rootFolderId);

    for (const project of projectOrder) {
      if (project.id === rootProjectId) continue;
      const parentFolderId = project.parent_id ? projectFolderById.get(project.parent_id) : rootFolderId;
      if (!parentFolderId) continue;

      if (project.drive_folder_id) {
        projectFolderById.set(project.id, project.drive_folder_id);
        continue;
      }

      const folder = await createFolderWithRetry(project.name || "Sub-project", parentFolderId);
      if (!folder?.id) continue;

      await supabase
        .from("projects")
        .update({ drive_folder_id: folder.id })
        .eq("id", project.id);

      projectFolderById.set(project.id, folder.id);
      created.projects += 1;
    }

    const projectIds = projectOrder.map((project) => project.id);
    const { data: topics } = await supabase
      .from("topics")
      .select("id, name, parent_id, project_id, drive_folder_id")
      .in("project_id", projectIds);

    const topicFolderById = new Map<string, string>();
    for (const topic of topics || []) {
      if (topic.drive_folder_id) {
        topicFolderById.set(topic.id, topic.drive_folder_id);
      }
    }

    let pending = (topics || []).filter((topic) => !topic.drive_folder_id);
    let progress = true;
    while (pending.length > 0 && progress) {
      progress = false;
      const remaining: typeof pending = [];

      for (const topic of pending) {
        const parentFolderId = topic.parent_id
          ? topicFolderById.get(topic.parent_id)
          : projectFolderById.get(topic.project_id);
        if (!parentFolderId) {
          remaining.push(topic);
          continue;
        }

        const folder = await createFolderWithRetry(topic.name, parentFolderId);
        if (!folder?.id) {
          remaining.push(topic);
          continue;
        }

        await supabase
          .from("topics")
          .update({ drive_folder_id: folder.id })
          .eq("id", topic.id);

        topicFolderById.set(topic.id, folder.id);
        created.topics += 1;
        progress = true;
      }

      pending = remaining;
    }

    const { data: docs } = await supabase
      .from("documents")
      .select("id, google_doc_id, topic_id, project_id")
      .in("project_id", projectIds);

    for (const doc of docs || []) {
      const targetFolderId = doc.topic_id
        ? topicFolderById.get(doc.topic_id)
        : projectFolderById.get(doc.project_id);
      if (!doc.google_doc_id || !targetFolderId) continue;

      const moved = await moveFile(doc.google_doc_id, targetFolderId, doc.project_id);
      if (moved?.success && !moved?.alreadyInFolder) {
        created.docs += 1;
      }
    }

    return created;
  };

  const handleRepairDriveStructure = async () => {
    if (!projectId || !driveFolderId) return;
    if (!googleAccessToken) {
      await attemptRecovery("Google authentication required");
      return;
    }

    setIsRepairingDrive(true);
    try {
      let resolvedFolderId = driveFolderId;

      if (driveFolderId === "root") {
        const rootList = await listFolder("root");
        const folders = (rootList.files || []).filter(
          (item) => item.mimeType === "application/vnd.google-apps.folder"
        );
        const matchName = (name || projectName || "").trim().toLowerCase();
        const matching = folders.filter(
          (folder) => folder.name.trim().toLowerCase() === matchName
        );

        if (matching.length === 1) {
          resolvedFolderId = matching[0].id;
          await supabase
            .from("projects")
            .update({ drive_folder_id: resolvedFolderId })
            .eq("id", projectId);
          setDriveFolderId(resolvedFolderId);
          setDriveFolderStatus("ok");
        } else if (matching.length > 1) {
          throw new Error("Multiple matching project folders found in Drive. Rename folders or relink manually.");
        } else {
          throw new Error("Project Drive folder is set to root. Please relink to the correct project folder.");
        }
      }

      const rootAccess = await checkFolderAccess(resolvedFolderId, projectId);
      if (rootAccess.needsDriveAccess) {
        await requestDriveAccess();
        toast({
          title: "Reconnect Google Drive",
          description: "Finish reconnecting and try again.",
        });
        return;
      }

      const created = await ensureDriveStructure(projectId, resolvedFolderId);
      toast({
        title: "Drive structure repaired",
        description: `Created ${created.projects} sub-project folder(s), ${created.topics} topic folder(s), moved ${created.docs} doc(s).`,
      });
      fetchSyncStatus();
      onUpdate?.();
    } catch (error: any) {
      console.error("Repair Drive structure error:", error);
      toast({
        title: "Repair failed",
        description: error?.message || "Unable to rebuild Drive structure.",
        variant: "destructive",
      });
    } finally {
      setIsRepairingDrive(false);
    }
  };

  const handleConnectDriveFolder = async () => {
    if (!projectId || !organizationId) return;
    if (!googleAccessToken) {
      await attemptRecovery("Google authentication required");
      return;
    }

    setIsConnectingDrive(true);
    try {
      const rootAccess = await checkFolderAccess("root");
      if (rootAccess.needsDriveAccess) {
        await requestDriveAccess();
        toast({
          title: "Reconnect Google Drive",
          description: "Finish reconnecting and try again.",
        });
        return;
      }

      let resolvedOrgFolderId = orgDriveFolderId;
      if (!resolvedOrgFolderId) {
        const orgFolder = await createFolderWithRetry(
          orgName || "Docspeare Workspace",
          "root"
        );
        if (!orgFolder?.id) {
          throw new Error("Failed to create workspace Drive folder. Reconnect Google Drive and try again.");
        }
        resolvedOrgFolderId = orgFolder.id;
        setOrgDriveFolderId(orgFolder.id);
        await supabase
          .from("organizations")
          .update({ drive_folder_id: orgFolder.id })
          .eq("id", organizationId);
      }

      const projectFolder = await createFolderWithRetry(
        name || projectName || "Project",
        resolvedOrgFolderId
      );
      if (!projectFolder?.id) {
        throw new Error("Failed to create project Drive folder. Reconnect Google Drive and try again.");
      }

      await supabase
        .from("projects")
        .update({ drive_folder_id: projectFolder.id })
        .eq("id", projectId);

      setDriveFolderId(projectFolder.id);
      setDriveFolderStatus("ok");
      const created = await ensureDriveStructure(projectId, projectFolder.id);
      toast({
        title: "Drive connected",
        description: `Project folder linked to Google Drive. Created ${created.projects} sub-project folder(s), ${created.topics} topic folder(s), moved ${created.docs} doc(s).`,
      });
      fetchSyncStatus();
      onUpdate?.();
    } catch (error: any) {
      console.error("Connect Drive folder error:", error);
      toast({
        title: "Failed to connect Drive",
        description: error?.message || "Could not create the Drive folder.",
        variant: "destructive",
      });
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const fetchMembers = async () => {
    if (!projectId) return;
    setLoadingMembers(true);

    const mapOrgRoleToProjectRole = (role: string | null): ProjectRole | null => {
      switch (role) {
        case "owner":
        case "admin":
          return "admin";
        case "editor":
          return "editor";
        case "viewer":
          return "viewer";
        default:
          return null;
      }
    };

    try {
      // Resolve org id for this project (needed to show org-level admins/editors/viewers)
      let orgId = organizationId;
      if (!orgId) {
        const { data: proj } = await supabase
          .from("projects")
          .select("organization_id")
          .eq("id", projectId)
          .maybeSingle();
        orgId = proj?.organization_id ?? null;
      }

      // 1) Explicit project members
      const { data: membersData, error } = await supabase
        .from("project_members")
        .select("id, user_id, role")
        .eq("project_id", projectId);

      if (error) throw error;

      const merged: Array<{ id: string; user_id: string; role: ProjectMemberRole }> =
        (membersData || []).map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role as ProjectMemberRole,
        }));

      const seen = new Set(merged.map((m) => m.user_id));

      // 2) Org-level roles (auto-inherit across projects)
      if (orgId) {
        const [{ data: orgRoles }, { data: org }] = await Promise.all([
          supabase
            .from("user_roles")
            .select("user_id, role")
            .eq("organization_id", orgId),
          supabase.from("organizations").select("owner_id, domain").eq("id", orgId).maybeSingle(),
        ]);

        // Ensure org owner is listed even if not present in user_roles
        const ownerId = org?.owner_id ?? null;
        setOrganizationDomain(org?.domain ?? null);
        if (ownerId) {
          const ownerIndex = merged.findIndex((entry) => entry.user_id === ownerId);
          if (ownerIndex >= 0) {
            merged[ownerIndex] = { ...merged[ownerIndex], role: "owner" };
          } else if (!seen.has(ownerId)) {
            merged.push({ id: `org:${ownerId}`, user_id: ownerId, role: "owner" });
            seen.add(ownerId);
          }
        }

        for (const r of orgRoles || []) {
          const mapped = mapOrgRoleToProjectRole((r as any).role ?? null);
          if (!mapped) continue;
          if (seen.has((r as any).user_id)) continue;
          merged.push({
            id: `org:${(r as any).user_id}`,
            user_id: (r as any).user_id,
            role: mapped,
          });
          seen.add((r as any).user_id);
        }
      }

      // Fetch profile info for display
      if (merged.length > 0) {
        const userIds = merged.map((m) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", userIds);

        const membersWithProfiles = merged.map((member) => ({
          ...member,
          profile: profiles?.find((p) => p.id === member.user_id) || undefined,
        }));

        setMembers(membersWithProfiles);
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchSyncStatus = async () => {
    if (!projectId) return;

    // Get latest synced document for this project
    const { data, count } = await supabase
      .from("documents")
      .select("last_synced_at", { count: "exact" })
      .eq("project_id", projectId)
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(1);

    if (data && data.length > 0 && data[0].last_synced_at) {
      setLastSyncedAt(data[0].last_synced_at);
    }
    setSyncedDocsCount(count || 0);
  };

  // Validate slug format
  const validateSlug = (value: string): boolean => {
    if (!value) return true; // Empty is okay, will use auto-generated
    if (!/^[a-z0-9-]+$/.test(value)) {
      setSlugError("Only lowercase letters, numbers, and hyphens allowed");
      return false;
    }
    if (value.startsWith("-") || value.endsWith("-")) {
      setSlugError("Cannot start or end with a hyphen");
      return false;
    }
    if (value.includes("--")) {
      setSlugError("Cannot have consecutive hyphens");
      return false;
    }
    setSlugError("");
    return true;
  };

  const checkSlugAvailability = async (slugValue: string): Promise<boolean> => {
    if (!slugValue || !organizationId) return true;
    
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("slug", slugValue)
      .neq("id", projectId)
      .maybeSingle();
    
    if (data) {
      setSlugError("This URL slug is already in use");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!projectId) return;
    
    // Validate slug
    if (slug && !validateSlug(slug)) return;
    
    // Check availability
    if (slug && !(await checkSlugAvailability(slug))) return;
    
    setIsSaving(true);

    const updateData: Record<string, any> = {
      name,
      description: description || null,
      visibility,
    };
    
    // Only update slug if explicitly set (otherwise let trigger handle it)
    if (slug) {
      updateData.slug = slug;
    }

    const { error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", projectId);

    setIsSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Project settings updated." });
      onUpdate?.();
    }
  };

  const handlePublish = async () => {
    if (!projectId) return;
    setIsPublishing(true);

    const newPublishedState = !isPublished;

    const { error } = await supabase
      .from("projects")
      .update({ is_published: newPublishedState })
      .eq("id", projectId);

    setIsPublishing(false);

    if (error) {
      toast({ title: "Error", description: "Failed to update publish state.", variant: "destructive" });
    } else {
      setIsPublished(newPublishedState);
      toast({
        title: newPublishedState ? "Published" : "Unpublished",
        description: newPublishedState
          ? "Project is now live based on visibility settings."
          : "Project is no longer publicly accessible.",
      });
      onUpdate?.();
    }
  };

  const handleSyncNow = async () => {
    if (!projectId || !driveFolderId) {
      toast({ 
        title: "Cannot sync", 
        description: "Project is not connected to Google Drive.", 
        variant: "destructive" 
      });
      return;
    }

    if (!googleAccessToken) {
      await attemptRecovery("Google authentication expired");
      return;
    }

    setIsSyncing(true);

    try {
      const nowIso = new Date().toISOString();
      const { data: defaultVersion } = await supabase
        .from("project_versions")
        .select("id")
        .eq("project_id", projectId)
        .eq("is_default", true)
        .maybeSingle();
      const defaultVersionId = defaultVersion?.id ?? null;

      const { data: existingTopics } = await supabase
        .from("topics")
        .select("id, drive_folder_id")
        .eq("project_id", projectId);

      const topicIdByFolderId = new Map<string, string>();
      for (const topic of existingTopics || []) {
        if (topic.drive_folder_id) {
          topicIdByFolderId.set(topic.drive_folder_id, topic.id);
        }
      }

      const { root, folders } = await buildDriveFolderTree(listFolder, {
        rootFolderId: driveFolderId,
        rootName: projectName ?? "Project",
        maxDepth: 8,
      });

      let topicsCreated = 0;
      const sortedFolders = folders.slice().sort((a, b) => a.depth - b.depth);
      for (const folder of sortedFolders) {
        if (folder.depth === 0) continue;
        if (topicIdByFolderId.has(folder.id)) continue;

        const parentId =
          folder.parentId && folder.parentId !== root.id
            ? topicIdByFolderId.get(folder.parentId) ?? null
            : null;

        const payload: Record<string, any> = {
          project_id: projectId,
          name: folder.name,
          drive_folder_id: folder.id,
          parent_id: parentId,
        };
        if (defaultVersionId) {
          payload.project_version_id = defaultVersionId;
        }

        const { data: inserted } = await supabase
          .from("topics")
          .insert(payload)
          .select("id")
          .single();

        if (inserted?.id) {
          topicIdByFolderId.set(folder.id, inserted.id);
          topicsCreated += 1;
        }
      }

      let docsSynced = 0;
      const allFolders = [root, ...folders.filter((folder) => folder.id !== root.id)];
      for (const folder of allFolders) {
        const { files, needsDriveAccess } = await listFolder(folder.id);
        if (needsDriveAccess) {
          await attemptRecovery("Drive access required");
          return;
        }

        const googleDocs = (files || []).filter(
          (item) => item.mimeType === "application/vnd.google-apps.document"
        );
        const topicId = folder.depth === 0 ? null : topicIdByFolderId.get(folder.id) ?? null;

        for (const doc of googleDocs) {
          const { data: existing } = await supabase
            .from("documents")
            .select("id")
            .eq("google_doc_id", doc.id)
            .eq("project_id", projectId)
            .maybeSingle();

          if (existing?.id) {
            await supabase
              .from("documents")
              .update({
                title: doc.name,
                last_synced_at: nowIso,
                google_modified_at: doc.modifiedTime || null,
                topic_id: topicId,
                ...(defaultVersionId ? { project_version_id: defaultVersionId } : {}),
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("documents").insert({
              google_doc_id: doc.id,
              project_id: projectId,
              title: doc.name,
              owner_id: user?.id,
              last_synced_at: nowIso,
              google_modified_at: doc.modifiedTime || null,
              topic_id: topicId,
              ...(defaultVersionId ? { project_version_id: defaultVersionId } : {}),
            });
          }
          docsSynced += 1;
        }
      }

      toast({
        title: "Sync complete",
        description: `${docsSynced} document(s) synced, ${topicsCreated} topic(s) created.`,
      });
      
      fetchSyncStatus();
      onUpdate?.();
    } catch (err) {
      console.error("Sync error:", err);
      toast({ 
        title: "Sync failed", 
        description: "An error occurred while syncing.", 
        variant: "destructive" 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: ProjectRole) => {
    if (memberId.startsWith("org:")) {
      toast({
        title: "Org role",
        description: "Org-level roles can't be edited from project settings.",
        variant: "destructive",
      });
      return;
    }
    const member = members.find((item) => item.id === memberId);
    if (member?.role === "owner") {
      toast({
        title: "Owner role",
        description: "The workspace owner role cannot be changed.",
        variant: "destructive",
      });
      return;
    }
    if (member && isExternalEmail(member.profile?.email ?? "") && newRole !== "viewer") {
      toast({
        title: "External collaborators are viewer-only",
        description: "Update the project visibility to External or Public if needed.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("project_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
    } else {
      toast({ title: "Role updated", description: "Member role has been changed." });
      fetchMembers();
      
      // Auto-sync Drive permissions after role change
      if (projectId && driveFolderId) {
        supabase.functions.invoke("sync-drive-permissions", {
          body: { projectId }
        }).then(() => {
          toast({ title: "Drive access updated", description: "Google Drive permissions synced." });
        }).catch(err => {
          console.error("Failed to sync Drive permissions:", err);
        });
      }
    }
  };

  const handleSyncDrivePermissions = async () => {
    if (!projectId) return;
    setIsSyncingDrivePermissions(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-drive-permissions', {
        body: { projectId }
      });
      
      if (error) throw error;
      
      toast({
        title: "Drive permissions synced",
        description: `Successfully synced permissions for ${data?.results?.length || 0} members.`,
      });
    } catch (error: any) {
      console.error("Sync Drive permissions error:", error);
      const errorMessage = error?.message || "";
      if (
        errorMessage.includes("Google access token") ||
        errorMessage.includes("reconnect") ||
        errorMessage.includes("Drive")
      ) {
        const recovery = await attemptRecovery(errorMessage);
        toast({
          title: "Drive access required",
          description: recovery.isOwner
            ? "Please reconnect Google Drive to sync permissions."
            : "The workspace owner needs to reconnect Google Drive.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync Drive permissions.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingDrivePermissions(false);
    }
  };

  const normalizeVersionSlug = (value: string) =>
    value.toLowerCase().trim().replace(/\s+/g, "-");

  const parseSemver = (value: string) => {
    const match = value.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/);
    if (!match) return null;
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3] ?? 0),
    };
  };

  const getNextVersionSuggestion = async () => {
    if (!projectId) return;
    const { data: versions } = await supabase
      .from("project_versions")
      .select("id, slug, semver_major, semver_minor, semver_patch, is_default")
      .eq("project_id", projectId);

    const usedSlugs = new Set((versions || []).map((v) => v.slug));

    let major = 1;
    let minor = 0;
    let patch = 0;

    for (const v of versions || []) {
      const semver =
        v.semver_major !== null && v.semver_minor !== null && v.semver_patch !== null
          ? { major: v.semver_major, minor: v.semver_minor, patch: v.semver_patch }
          : parseSemver(v.slug || "");

      if (!semver) continue;

      if (
        semver.major > major ||
        (semver.major === major && semver.minor > minor) ||
        (semver.major === major && semver.minor === minor && semver.patch > patch)
      ) {
        major = semver.major;
        minor = semver.minor;
        patch = semver.patch;
      }
    }

    patch += 1;
    let slug = `v${major}.${minor}.${patch}`;
    while (usedSlugs.has(slug)) {
      patch += 1;
      slug = `v${major}.${minor}.${patch}`;
    }

    setVersionSlug(slug);
    setVersionName(slug);
  };

  const handleDuplicateVersion = async () => {
    if (!projectId || !versionSlug.trim() || !versionName.trim()) return;
    if (!user?.id) return;
    setIsDuplicatingVersion(true);

    try {
      const normalizedSlug = normalizeVersionSlug(versionSlug);
      const semver = parseSemver(normalizedSlug);

      const { data: versions } = await supabase
        .from("project_versions")
        .select("id, slug, is_default")
        .eq("project_id", projectId);

      if ((versions || []).some((v) => v.slug === normalizedSlug)) {
        toast({
          title: "Version already exists",
          description: "Choose a different version slug.",
          variant: "destructive",
        });
        return;
      }

      const sourceVersion =
        (versions || []).find((v) => v.is_default) ?? (versions || [])[0];
      if (!sourceVersion?.id) {
        toast({
          title: "No source version",
          description: "Create a base version before duplicating.",
          variant: "destructive",
        });
        return;
      }

      const { data: newVersionId, error: rpcError } = await supabase.rpc("duplicate_project_version", {
        source_version_id: sourceVersion.id,
        new_name: versionName.trim(),
        new_slug: normalizedSlug,
        created_by_id: user.id,
      });

      if (rpcError) throw rpcError;

      toast({
        title: "Version created",
        description: "Draft version created with a full copy of topics and pages.",
      });
      setDuplicateVersionOpen(false);
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: "Couldn't duplicate version",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDuplicatingVersion(false);
    }
  };

  useEffect(() => {
    if (!duplicateVersionOpen) return;
    if (!projectId) return;
    getNextVersionSuggestion();
  }, [duplicateVersionOpen, projectId]);

  const handleRemoveMember = async (memberId: string) => {
    if (memberId.startsWith("org:")) {
      toast({
        title: "Org role",
        description: "Org-level members can't be removed from a project.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({ title: "Error", description: "Failed to remove member.", variant: "destructive" });
    } else {
      toast({ title: "Member removed", description: "User has been removed from the project." });
      fetchMembers();
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId) return;
    setIsDeleting(true);

    try {
      if (driveFolderId) {
        const trashResult = await trashFile(driveFolderId);
        if (!trashResult.success) {
          if (trashResult.errorCode === "NOT_AUTHORIZED") {
            toast({
              title: "Cannot Delete from Drive",
              description:
                "Docspeare does not have permission to delete this Drive folder. Ensure the connected Google account owns the folder (or has edit access) and try again.",
              variant: "destructive",
            });
          } else if (trashResult.errorCode === "NOT_FOUND") {
            toast({
              title: "Drive folder not found",
              description:
                "The Drive folder ID cannot be accessed. Reconnect the owner account or update the folder in Settings, then retry the delete.",
              variant: "destructive",
            });
          } else if (trashResult.errorCode === "NEEDS_REAUTH") {
            toast({
              title: "Google reconnection required",
              description: "Please reconnect your Google account to delete this project.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Cannot Delete from Drive",
              description: trashResult.error || "Failed to trash the Drive folder.",
              variant: "destructive",
            });
          }
          setIsDeleting(false);
          return;
        }
        if (trashResult.alreadyDeleted) {
          toast({
            title: "Drive folder already removed",
            description: "Drive folder was already deleted. Cleaning up the project in Docspeare.",
          });
        }
      }

      // Clean up related records in order to avoid FK constraint errors
      // 1. Delete connector actions
      await supabase.from("connector_actions").delete().eq("project_id", projectId);
      
      // 2. Delete page feedback for documents in this project
      const { data: docs } = await supabase.from("documents").select("id").eq("project_id", projectId);
      if (docs && docs.length > 0) {
        const docIds = docs.map(d => d.id);
        await supabase.from("page_feedback").delete().in("document_id", docIds);
      }
      
      // 3. Delete drive permission sync
      await supabase.from("drive_permission_sync").delete().eq("project_id", projectId);
      
      // 4. Delete project invitations
      await supabase.from("project_invitations").delete().eq("project_id", projectId);
      
      // 5. Delete project members
      await supabase.from("project_members").delete().eq("project_id", projectId);
      
      // 6. Delete audit logs
      await supabase.from("audit_logs").delete().eq("project_id", projectId);
      
      // 7. Delete domains
      await supabase.from("domains").delete().eq("project_id", projectId);
      
      // 8. Delete connector credentials and connectors
      const { data: connectors } = await supabase.from("connectors").select("id").eq("project_id", projectId);
      if (connectors && connectors.length > 0) {
        const connectorIds = connectors.map(c => c.id);
        await supabase.from("connector_permissions").delete().in("connector_id", connectorIds);
        await supabase.from("connector_credentials").delete().in("connector_id", connectorIds);
        await supabase.from("connectors").delete().eq("project_id", projectId);
      }
      
      // 10. Delete documents
      await supabase.from("documents").delete().eq("project_id", projectId);
      
      // 11. Delete topics
      await supabase.from("topics").delete().eq("project_id", projectId);
      
      // 12. Delete slug history
      await supabase.from("slug_history").delete().eq("entity_id", projectId).eq("entity_type", "project");
      
      // 13. Delete child projects first
      const { data: childProjects } = await supabase
        .from("projects")
        .select("id, drive_folder_id")
        .eq("parent_id", projectId);
      if (childProjects && childProjects.length > 0) {
        for (const child of childProjects) {
          if (child.drive_folder_id) {
            const childTrashResult = await trashFile(child.drive_folder_id);
            if (!childTrashResult.success) {
              const errorTitle =
                childTrashResult.errorCode === "NOT_FOUND"
                  ? "Sub-project folder not found"
                  : "Cannot Delete Sub-project from Drive";
              const errorDescription =
                childTrashResult.errorCode === "NOT_AUTHORIZED"
                  ? "Docspeare does not have permission to delete this folder. Ensure the connected Google account owns it or has edit access."
                  : childTrashResult.errorCode === "NOT_FOUND"
                    ? "Drive folder ID cannot be accessed. Reconnect the owner account or update the folder in Settings."
                    : childTrashResult.error || "Failed to trash a sub-project Drive folder.";
              toast({
                title: errorTitle,
                description: errorDescription,
                variant: "destructive",
              });
              setIsDeleting(false);
              return;
            }
            if (childTrashResult.alreadyDeleted) {
              toast({
                title: "Sub-project Folder Missing",
                description: "Drive folder was already removed. Cleaning up the sub-project in Docspeare.",
              });
            }
          }
          // Recursively clean up child project's related data
          await supabase.from("project_members").delete().eq("project_id", child.id);
          await supabase.from("documents").delete().eq("project_id", child.id);
          await supabase.from("topics").delete().eq("project_id", child.id);
          await supabase.from("projects").delete().eq("id", child.id);
        }
      }
      
      // 14. Finally delete the project
      const { error } = await supabase.from("projects").delete().eq("id", projectId);

      if (error) throw error;

      toast({ title: "Project deleted", description: "The project has been removed." });
      onOpenChange(false);
      onUpdate?.();
    } catch (err) {
      console.error("Delete project error:", err);
      toast({ 
        title: "Delete failed", 
        description: "An error occurred while deleting the project.", 
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!projectId) return null;

  const currentVisibility = visibilityOptions.find(v => v.value === visibility);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold text-foreground">
            Project Settings
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Manage settings for {projectName}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="general" className="mt-6">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="seo" className="gap-1">
              <Search className="w-3 h-3" />
              SEO & AI
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-8">
            {/* Publish Status */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Publish Status
              </label>
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-3">
                  {isPublished ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Globe className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {isPublished ? "Published" : "Not Published"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isPublished 
                        ? `Visible to ${visibility === "public" ? "everyone" : visibility === "external" ? "external users" : "internal users"}`
                        : "Only visible in dashboard"}
                    </p>
                  </div>
                </div>
                <Button
                  variant={isPublished ? "outline" : "hero"}
                  size="sm"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="gap-2"
                >
                  <Send className="w-3 h-3" />
                  {isPublishing ? "..." : isPublished ? "Unpublish" : "Publish"}
                </Button>
              </div>
            </div>

          {/* Visibility */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Visibility
            </label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as VisibilityLevel)}>
              <SelectTrigger className="w-full bg-secondary border-border">
                <SelectValue>
                  {currentVisibility && (
                    <div className="flex items-center gap-2">
                      <currentVisibility.icon className="w-4 h-4" />
                      <span>{currentVisibility.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {visibilityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="w-4 h-4" />
                      <div>
                        <span className="font-medium">{option.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {option.description}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls who can view this project when published.
            </p>
          </div>

          {/* Project Name */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* URL Slug */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              URL Slug
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">/docs/.../</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/\s+/g, "-");
                    setSlug(value);
                    validateSlug(value);
                  }}
                  placeholder="auto-generated"
                  className={`flex-1 px-4 py-2.5 rounded-lg bg-secondary border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    slugError ? "border-destructive" : "border-border"
                  }`}
                />
              </div>
              {slugError && (
                <p className="text-xs text-destructive">{slugError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Customize the URL for this project. Leave empty to auto-generate from name.
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this project..."
              className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>

          {/* Versions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Versions
              </label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2"
                onClick={() => setDuplicateVersionOpen(true)}
                disabled={!projectId}
              >
                <Plus className="w-3 h-3" />
                New Version
              </Button>
            </div>
            
            <div className="space-y-2">
              {projectVersions.length === 0 ? (
                <div className="p-4 rounded-lg bg-secondary/50 border border-border text-center">
                  <p className="text-xs text-muted-foreground">No versions found.</p>
                </div>
              ) : (
                projectVersions.map((v) => (
                  <div key={v.id} className="group flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {v.name}
                        </span>
                        {v.is_default && (
                          <Badge variant="default" className="text-[10px] h-4 px-1 bg-primary/10 text-primary border-primary/20">
                            Default
                          </Badge>
                        )}
                        {!v.is_default && v.is_published && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 text-green-600 border-green-200 bg-green-50">
                            Published
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        /{v.slug}
                      </span>
                    </div>
                    
                    {!v.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handlePromoteVersion(v.id)}
                        disabled={isPromoting}
                      >
                        {isPromoting ? "Promoting..." : "Make Default"}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sync Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">
                Sync Status
              </label>
              {driveFolderStatus === "missing" && (
                <Badge variant="destructive" className="text-[10px]">
                  Missing in Drive
                </Badge>
              )}
              {driveFolderStatus === "needs_access" && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50">
                  Drive access required
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-3 p-4 rounded-lg bg-secondary/50 border border-border sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {lastSyncedAt 
                    ? `Last synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`
                    : "Never synced"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {syncedDocsCount} document{syncedDocsCount !== 1 ? "s" : ""} synced
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={handleRepairHierarchy}
                  disabled={isRepairing || !projectId}
                  title="Fix duplicate topics/sub-projects"
                >
                  <AlertTriangle className={`w-3 h-3 ${isRepairing ? "animate-pulse" : ""}`} />
                  {isRepairing ? "Repairing..." : "Repair Topics"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={handleRepairDriveStructure}
                  disabled={isRepairingDrive || !driveFolderId}
                  title={!driveFolderId ? "No Drive folder connected" : "Rebuild Drive folder structure"}
                >
                  <RefreshCw className={`w-3 h-3 ${isRepairingDrive ? "animate-spin" : ""}`} />
                  {isRepairingDrive ? "Repairing Drive..." : "Repair Drive"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={handleSyncNow}
                  disabled={isSyncing || !driveFolderId}
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Syncing..." : "Sync Now"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={handleCheckOrphanedFiles}
                  disabled={isCheckingOrphans || !driveFolderId}
                  title="Check for files in Drive not yet in Docspeare"
                >
                  <Search className={`w-3 h-3 ${isCheckingOrphans ? "animate-pulse" : ""}`} />
                  {isCheckingOrphans ? "Checking..." : "Check Orphans"}
                </Button>
              </div>
            </div>

            {orphanedFiles.length > 0 && (
              <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {orphanedFiles.length} Orphaned File{orphanedFiles.length !== 1 ? "s" : ""} Found
                    </span>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleImportOrphans}
                    disabled={isImportingOrphans}
                  >
                    {isImportingOrphans ? "Importing..." : "Import All"}
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                  {orphanedFiles.map(file => (
                    <div key={file.id} className="text-xs text-muted-foreground flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                      <span className="truncate max-w-[200px]">{file.name}</span>
                      <span className="text-[10px] opacity-70">Google Doc</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {driveFolderStatus === "missing" && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3 w-3" />
                <span>
                  Drive folder is missing or not accessible. You can delete this project to clean it up in Docspeare.
                </span>
              </div>
            )}
            {!driveFolderId && (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-300/40 bg-amber-50/60 p-3 text-xs text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3 w-3" />
                  <span>
                    This project is not connected to a Drive folder. Drive-based sharing and permission sync
                    won't work until a folder is linked.
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleConnectDriveFolder}
                  disabled={isConnectingDrive}
                >
                  {isConnectingDrive ? "Connecting..." : "Connect Drive"}
                </Button>
              </div>
            )}
          </div>

          {/* Project Members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Project Members
              </label>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={handleSyncDrivePermissions}
                  disabled={isSyncingDrivePermissions || !driveFolderId}
                  title={!driveFolderId ? "No Drive folder connected" : "Sync member permissions to Google Drive"}
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingDrivePermissions ? "animate-spin" : ""}`} />
                  {isSyncingDrivePermissions ? "Syncing..." : "Sync Drive Permissions"}
                </Button>
                <Button variant="ghost" size="sm" className="gap-2 text-primary">
                  <Users className="w-3 h-3" />
                  Manage
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {loadingMembers ? (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  Loading members...
                </p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  No members yet
                </p>
              ) : (
                members.map((member) => {
                  const isExternalMember = isExternalEmail(member.profile?.email ?? "");
                  const isOrgRole = member.id.startsWith("org:");
                  const roleLabel = member.role === "owner" ? "Owner" : member.role;
                  return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                        {member.profile?.avatar_url ? (
                          <img 
                            src={member.profile.avatar_url} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-primary">
                            {(member.profile?.full_name || member.profile?.email || "?")[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {member.profile?.full_name || "Unknown User"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.profile?.email || "No email"}
                        </p>
                      </div>
                    </div>
                    {isOrgRole || member.role === "owner" ? (
                      <div className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground capitalize">
                        {isExternalMember ? "Viewer (External)" : roleLabel}
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-background transition-colors flex items-center gap-1 capitalize">
                            {isExternalMember ? "Viewer (External)" : roleLabel}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {roleOptions.map((role) => (
                            <DropdownMenuItem 
                              key={role.value}
                              onClick={() => handleUpdateRole(member.id, role.value)}
                              disabled={isExternalMember && role.value !== "viewer"}
                              className={member.role === role.value ? "bg-accent" : ""}
                            >
                              {role.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
                })
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-destructive">
              Danger Zone
            </label>
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Delete Project
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This will remove the project from Docspeare. Documents in
                    Drive will not be affected.
                  </p>
                  {!showDeleteConfirm ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete Project
                    </Button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-destructive">
                        Are you sure? This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={isDeleting}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteProject}
                          disabled={isDeleting}
                          className="gap-2"
                        >
                          {isDeleting ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3 h-3" />
                              Confirm Delete
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          </TabsContent>
          
          <TabsContent value="seo">
            <SEOSettings projectId={projectId} />
          </TabsContent>
        </Tabs>

        <Dialog
          open={duplicateVersionOpen}
          onOpenChange={(value) => {
            setDuplicateVersionOpen(value);
            if (!value) {
              setVersionName("");
              setVersionSlug("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Duplicate to new version
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                This creates a draft version and copies all topics and pages.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Version Name
                </label>
                <Input
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="e.g., v1.1.0"
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Version Slug
                </label>
                <Input
                  value={versionSlug}
                  onChange={(e) => setVersionSlug(normalizeVersionSlug(e.target.value))}
                  placeholder="e.g., v1.1.0"
                  className="bg-secondary"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDuplicateVersionOpen(false)}
                  disabled={isDuplicatingVersion}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleDuplicateVersion}
                  disabled={!versionName.trim() || !versionSlug.trim() || isDuplicatingVersion}
                >
                  {isDuplicatingVersion ? "Duplicating..." : "Create Version"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
};
