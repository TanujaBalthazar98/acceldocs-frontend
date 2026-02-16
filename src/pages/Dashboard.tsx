import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ensureFreshSession } from "@/lib/authSession";
import { 
  FileText, 
  FolderTree, 
  Plus, 
  Search, 
  Settings, 
  LogOut,
  ChevronRight,
  ChevronLeft,
  Folder,
  AlertTriangle,
  User,
  Clock,
  Circle,
  Share2,
  MoreHorizontal,
  RefreshCw,
  ExternalLink,
  Trash2,
  Send,
  CheckCircle,
  Lock,
  Eye,
  Globe,
  BookOpen,
  Layers,
  FileJson,
  Code,
  Plug2,
  Upload,
  History,
  Bot,
  MessageSquare,
  ArrowRight,
  PanelLeftClose,
  PanelLeft,
  UserPlus,
  CheckSquare,
  Square,
  XCircle,
  X,
  Loader2,
  Home,
  GitBranch,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SmartSearch } from "@/components/SmartSearch";
import { PageView } from "@/components/dashboard/PageView";
import { AnalyticsPanel } from "@/components/dashboard/AnalyticsPanel";
import { ProjectSharePanel } from "@/components/dashboard/ProjectSharePanel";
import { AddPageDialog } from "@/components/dashboard/AddPageDialog";
import { AddProjectDialog } from "@/components/dashboard/AddProjectDialog";
import { AddTopicDialog } from "@/components/dashboard/AddTopicDialog";
import { ProjectSettingsPanel } from "@/components/dashboard/ProjectSettingsPanel";
import { PageSettingsDialog } from "@/components/dashboard/PageSettingsDialog";
import { ImportMarkdownDialog } from "@/components/dashboard/ImportMarkdownDialog";
import { DriveDiscoveryDialog, DiscoveryResult } from "@/components/dashboard/DriveDiscoveryDialog";
import { DashboardSidebar } from "@/components/dashboard/layout/DashboardSidebar";
import { TopicSettingsDialog } from "@/components/dashboard/TopicSettingsDialog";
import { GeneralSettings } from "@/components/dashboard/GeneralSettings";
import { Onboarding } from "@/components/dashboard/Onboarding";
import { SubtopicsView } from "@/components/dashboard/SubtopicsView";
import { SidebarTopicsTree } from "@/components/dashboard/SidebarTopicsTree";
import { UnifiedContentTree } from "@/components/dashboard/UnifiedContentTree";
import { APISettingsPanel } from "@/components/dashboard/APISettingsPanel";
import { MCPSettingsPanel } from "@/components/dashboard/MCPSettingsPanel";
import { AuditLogPanel } from "@/components/dashboard/AuditLogPanel";
import { IntegrationsPanel } from "@/components/dashboard/IntegrationsPanel";
import { DocAssistantChat } from "@/components/dashboard/DocAssistantChat";

import { NotificationCenter } from "@/components/dashboard/NotificationCenter";
import { DriveStatusIndicator } from "@/components/dashboard/DriveStatusIndicator";
import { DriveReauthListener } from "@/components/dashboard/DriveReauthListener";
import { DRIVE_INTEGRATION_ENABLED } from "@/lib/featureFlags";
import { InviteMemberDialog } from "@/components/dashboard/InviteMemberDialog";
import { invokeFunction, invokeRpc } from "@/lib/api/functions";
import { strapiFetch } from "@/lib/api/client";
import { list } from "@/lib/api/queries";
import { useGoogleDrive, DriveFile } from "@/hooks/useGoogleDrive";
import { useDriveRecovery } from "@/hooks/useDriveRecovery";
import { buildDriveFolderTree } from "@/lib/driveFolderTree";
import { usePermissions, useAuditLog } from "@/hooks/usePermissions";
import { useJoinRequestNotifications } from "@/hooks/useJoinRequestNotifications";
import docspeareLogo from "@/assets/docspeare-logo.png";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";

const stateConfig = {
  active: { color: "bg-state-active", label: "Active" },
  draft: { color: "bg-state-draft", label: "Draft" },
  deprecated: { color: "bg-state-deprecated", label: "Deprecated" },
  archived: { color: "bg-state-archived", label: "Archived" },
};

import { Project, ProjectVersion, Topic, Document, VisibilityLevel, SidebarSection, SidebarItem } from "@/types/dashboard";

const visibilityConfig: Record<VisibilityLevel, { icon: typeof Lock; label: string; color: string }> = {
  internal: { icon: Lock, label: "Internal", color: "text-muted-foreground" },
  external: { icon: Eye, label: "External", color: "text-blue-400" },
  public: { icon: Globe, label: "Public", color: "text-green-400" },
};

const Dashboard = () => {
  const { user, signOut, googleAccessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { listFolder, trashFile, getGoogleToken, uploadFile } = useGoogleDrive();
  const { attemptRecovery } = useDriveRecovery();
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [importMarkdownOpen, setImportMarkdownOpen] = useState(false);
  // Auto-Discovery State
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [discoveryProjectId, setDiscoveryProjectId] = useState<string | null>(null);
  const [discoveryVersionId, setDiscoveryVersionId] = useState<string | null>(null);
  
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [pageSettingsTarget, setPageSettingsTarget] = useState<Pick<
    Document,
    "id" | "title" | "project_id" | "google_doc_id"
  > | null>(null);
  const [assignProjectOpen, setAssignProjectOpen] = useState(false);
  const [assignTargetDoc, setAssignTargetDoc] = useState<Document | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<string>("");
  const [assignTopicId, setAssignTopicId] = useState<string>("");
  const [isAssigningProject, setIsAssigningProject] = useState(false);
  const [topicSettingsOpen, setTopicSettingsOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ProjectVersion | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [parentTopicForCreate, setParentTopicForCreate] = useState<Topic | null>(null);
  const [settingsTopic, setSettingsTopic] = useState<Topic | null>(null);
  const [showGeneralSettings, setShowGeneralSettings] = useState(false);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [needsDriveAccess, setNeedsDriveAccess] = useState(false);
  const [isConnectingDrive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'project' | 'topic' | 'document'; id: string; name: string; forceDelete?: boolean } | null>(null);
  const [forceDeleteAvailable, setForceDeleteAvailable] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [orgMcpEnabled, setOrgMcpEnabled] = useState(false);
  const [orgHasApiSpec, setOrgHasApiSpec] = useState(false);
  const [showAPISettings, setShowAPISettings] = useState(false);
  const [showMCPSettings, setShowMCPSettings] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [visiblePagesCount, setVisiblePagesCount] = useState(10);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [inviteMemberOpen, setInviteMemberOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState<string>("");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [parentProjectForCreate, setParentProjectForCreate] = useState<Project | null>(null);
  const [isBulkUnpublishing, setIsBulkUnpublishing] = useState(false);
  const [subProjectsExpanded, setSubProjectsExpanded] = useState(true);
  const [topicsExpanded, setTopicsExpanded] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const unwrapStrapiEntity = <T extends Record<string, any>>(
    entity: T | null | undefined,
  ): T | null => {
    if (!entity) return null;
    if ((entity as any).attributes) {
      return { id: (entity as any).id, ...(entity as any).attributes } as T;
    }
    return entity;
  };

  const mapProjectFromStrapi = (item: any, orgId: string): Project => {
    const attrs = item?.attributes || item || {};
    const parentRaw =
      attrs.parent?.data?.id ??
      attrs.parent?.id ??
      attrs.parent_id ??
      attrs.parent ??
      null;
    const normalizedParent =
      parentRaw && parentRaw !== "null" && parentRaw !== "undefined" ? String(parentRaw) : null;
    return {
      id: String(item?.id ?? attrs.id),
      name: attrs.name || "",
      slug: attrs.slug ?? null,
      drive_folder_id: attrs.drive_folder_id ?? null,
      drive_parent_id: attrs.drive_parent_id ?? null,
      visibility: attrs.visibility ?? "internal",
      is_published: !!attrs.is_published,
      parent_id: normalizedParent,
      organization_id: orgId,
      show_version_switcher: attrs.show_version_switcher ?? true,
    };
  };

  const mapVersionFromStrapi = (item: any): ProjectVersion => {
    const attrs = item?.attributes || item || {};
    return {
      id: String(item?.id ?? attrs.id),
      project_id: attrs.project?.data?.id
        ? String(attrs.project.data.id)
        : attrs.project?.id
          ? String(attrs.project.id)
          : "",
      name: attrs.name || "",
      slug: attrs.slug || "",
      is_default: !!attrs.is_default,
      is_published: !!attrs.is_published,
      semver_major: Number(attrs.semver_major ?? 0),
      semver_minor: Number(attrs.semver_minor ?? 0),
      semver_patch: Number(attrs.semver_patch ?? 0),
    };
  };

  const mapTopicFromStrapi = (item: any): Topic => {
    const attrs = item?.attributes || item || {};
    return {
      id: String(item?.id ?? attrs.id),
      name: attrs.name || "",
      drive_folder_id: attrs.drive_folder_id ?? "",
      project_id: attrs.project?.data?.id
        ? String(attrs.project.data.id)
        : attrs.project?.id
          ? String(attrs.project.id)
          : "",
      project_version_id: attrs.project_version?.data?.id
        ? String(attrs.project_version.data.id)
        : attrs.project_version?.id
          ? String(attrs.project_version.id)
          : null,
      parent_id: attrs.parent?.data?.id
        ? String(attrs.parent.data.id)
        : attrs.parent?.id
          ? String(attrs.parent.id)
          : null,
      display_order: attrs.display_order ?? null,
    };
  };

  const mapDocumentFromStrapi = (item: any): Document => {
    const attrs = item?.attributes || item || {};
    const owner = attrs.owner?.data?.attributes || attrs.owner || {};
    return {
      id: String(item?.id ?? attrs.id),
      title: attrs.title || "",
      google_doc_id: attrs.google_doc_id || "",
      project_id: attrs.project?.data?.id
        ? String(attrs.project.data.id)
        : attrs.project?.id
          ? String(attrs.project.id)
          : null,
      project_version_id: attrs.project_version?.data?.id
        ? String(attrs.project_version.data.id)
        : attrs.project_version?.id
          ? String(attrs.project_version.id)
          : null,
      topic_id: attrs.topic?.data?.id
        ? String(attrs.topic.data.id)
        : attrs.topic?.id
          ? String(attrs.topic.id)
          : null,
      display_order: attrs.display_order ?? null,
      google_modified_at: attrs.google_modified_at ?? null,
      created_at: attrs.createdAt || attrs.created_at || "",
      updated_at: attrs.updatedAt || attrs.updated_at || "",
      visibility: attrs.visibility ?? "internal",
      is_published: !!attrs.is_published,
      owner_id: attrs.owner?.data?.id ? String(attrs.owner.data.id) : null,
      owner_name: owner.full_name || owner.email || owner.username || undefined,
      content_html: attrs.content_html ?? null,
      published_content_html: attrs.published_content_html ?? null,
      content_id: attrs.content_id ?? null,
      published_content_id: attrs.published_content_id ?? null,
      video_url: attrs.video_url ?? null,
      video_title: attrs.video_title ?? null,
    };
  };
  
  // Permissions and audit logging
  const { permissions, role, loading: permissionsLoading, isOrgOwner } = usePermissions(selectedProject?.id || null);
  const { logAction, logUnauthorizedAttempt } = useAuditLog();
  const projectStepDone = projects.length > 0;
  const canProjectCreateRole =
    appRole === "owner" || appRole === "admin" || appRole === "editor";
  const canCreateProject = canProjectCreateRole;
  const createProjectDisabledTitle = !canProjectCreateRole
    ? "You must be an owner, admin, or editor to create a project"
    : "Create your first project";
  const showGettingStarted =
    !!organizationId && !projectStepDone;

  // Helper: Check if user can publish for a specific project (used when no project is selected)
  const canPublishForProject = async (projectId: string): Promise<boolean> => {
    if (!user) return false;
    // If we have a selected project and it matches, use cached permissions
    if (selectedProject?.id === projectId && permissions.canPublish) return true;
    
    // Otherwise, call the database function directly
    const { data: canEdit, error } = await invokeRpc("can_edit_project" as any, {
      _project_id: projectId as any,
      _user_id: user.id as any,
    });
    
    if (error) {
      console.error("Error checking publish permission:", error);
      return false;
    }
    return (canEdit as any) === true;
  };
  
  // Join request notifications for workspace switching
  const { approvedOrgId, approvedOrgName, switchToApprovedWorkspace } = useJoinRequestNotifications(user?.id);

  // Handle deep-links from Page Preview → Integrations
  useEffect(() => {
    if (deepLinkHandled) return;

    const params = new URLSearchParams(location.search);
    const wantsIntegrations = params.get('integrations') === '1';
    const requestedProjectId = params.get('project');

    if (!wantsIntegrations) {
      setDeepLinkHandled(true);
      return;
    }

    setShowIntegrations(true);
    setShowMCPSettings(false);
    setShowAPISettings(false);
    setShowGeneralSettings(false);

    // If we have a project id, wait until projects are loaded to select it.
    if (requestedProjectId) {
      if (projects.length === 0) return;
      const project = projects.find(p => p.id === requestedProjectId) || null;
      if (project) {
        setSelectedProject(project);
        setSelectedTopic(null);
        setExpandedProjects(prev => new Set([...prev, project.id]));
      }
    }

    // Clean the URL to avoid reopening on refresh.
    navigate('/dashboard', { replace: true });
    setDeepLinkHandled(true);
  }, [deepLinkHandled, location.search, navigate, projects]);

  
  // Fetch organization's root folder ID and projects
  const fetchData = async () => {
    if (!user) {
      setIsLoading(false);
      setAppRole(null);
      return;
    }

    const blockUI = !hasLoadedOnce;
    if (blockUI) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const { data: workspace, error: workspaceError } = await invokeFunction("ensure-workspace", {
        body: {},
      });

      if (workspaceError || !workspace?.ok || !workspace?.organizationId) {
        throw workspaceError || new Error(workspace?.error || "Failed to ensure workspace");
      }

      const orgId = String(workspace.organizationId);
      setOrganizationId(orgId);
      setNeedsOnboarding(false);

      const { data: orgResponse, error: orgError } = await invokeFunction<{
        ok?: boolean;
        organization?: any;
        error?: string;
      }>("get-organization");
      if (orgError || !orgResponse?.ok) {
        throw orgError || new Error(orgResponse?.error || "Failed to load organization");
      }
      const org = orgResponse.organization || null;

      if (org?.drive_folder_id) {
        setRootFolderId(org.drive_folder_id);
      }
      setNeedsDriveAccess(!org?.drive_folder_id);
      if (org?.slug || org?.domain) {
        setOrganizationSlug(org.slug || org.domain);
      }
      setOrgMcpEnabled(org?.mcp_enabled ?? false);
      setOrgHasApiSpec(!!(org?.openapi_spec_json || org?.openapi_spec_url));
      setOrganizationName(org?.name || "");

      const memberRole =
        orgResponse?.members?.find((member: any) => String(member?.id) === String(user.id))?.role ||
        "viewer";
      setAppRole(memberRole);

      const { data: projectRes, error: projectError } = await invokeFunction<{
        ok?: boolean;
        projects?: any[];
        error?: string;
      }>("list-projects", {
        body: { organizationId: orgId },
      });

      if (projectError || !projectRes?.ok) {
        throw projectError || new Error(projectRes?.error || "Failed to load projects");
      }

      const mappedProjects = (projectRes.projects || [])
        .map((row) => mapProjectFromStrapi(row, orgId))
        .filter((p) => p.name.trim().length > 0);

      const normalizeName = (value: string) => value.trim().toLowerCase();
      const uniqueByDrive = new Map<string, Project>();
      const uniqueByNameParent = new Map<string, Project>();
      for (const project of mappedProjects) {
        if (project.drive_folder_id) {
          const existing = uniqueByDrive.get(project.drive_folder_id);
          if (!existing || (!existing.parent_id && project.parent_id)) {
            uniqueByDrive.set(project.drive_folder_id, project);
          }
          continue;
        }
        const key = `${project.parent_id || "root"}::${normalizeName(project.name)}`;
        if (!uniqueByNameParent.has(key)) {
          uniqueByNameParent.set(key, project);
        }
      }

      const dedupedProjects = [
        ...uniqueByDrive.values(),
        ...uniqueByNameParent.values(),
      ].filter((p, idx, arr) => arr.findIndex((other) => other.id === p.id) === idx);

      setProjects(dedupedProjects);

      const projectIds = dedupedProjects.map((p) => p.id);
      if (projectIds.length === 0) {
        setProjectVersions([]);
        setTopics([]);
        setDocuments([]);
        return;
      }

      const { data: versionRes, error: versionError } = await invokeFunction<{
        ok?: boolean;
        versions?: any[];
        error?: string;
      }>("list-project-versions", { body: { projectIds } });
      if (versionError || !versionRes?.ok) {
        throw versionError || new Error(versionRes?.error || "Failed to load versions");
      }
      setProjectVersions((versionRes.versions || []).map(mapVersionFromStrapi));

      const { data: topicRes, error: topicError } = await invokeFunction<{
        ok?: boolean;
        topics?: any[];
        error?: string;
      }>("list-topics", { body: { projectIds } });
      if (topicError || !topicRes?.ok) {
        throw topicError || new Error(topicRes?.error || "Failed to load topics");
      }
      setTopics((topicRes.topics || []).map(mapTopicFromStrapi));

      const { data: docRes, error: docError } = await invokeFunction<{
        ok?: boolean;
        documents?: any[];
        error?: string;
      }>("list-documents", { body: { projectIds } });
      if (docError || !docRes?.ok) {
        throw docError || new Error(docRes?.error || "Failed to load documents");
      }
      const mappedDocs = (docRes.documents || []).map(mapDocumentFromStrapi);
      const docByKey = new Map<string, Document>();
      for (const doc of mappedDocs) {
        const key = doc.google_doc_id ? `gdoc:${doc.google_doc_id}` : `id:${doc.id}`;
        const existing = docByKey.get(key);
        if (!existing) {
          docByKey.set(key, doc);
          continue;
        }
        if (!existing.is_published && doc.is_published) {
          docByKey.set(key, doc);
          continue;
        }
        const existingUpdated = Date.parse(existing.updated_at || "") || 0;
        const currentUpdated = Date.parse(doc.updated_at || "") || 0;
        if (currentUpdated > existingUpdated) {
          docByKey.set(key, doc);
        }
      }
      setDocuments(Array.from(docByKey.values()));
      return;
    } finally {
      if (blockUI) {
        setIsLoading(false);
      }
      setIsRefreshing(false);
      setHasLoadedOnce(true);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [user?.id]);

  useEffect(() => {
    setNeedsDriveAccess(!rootFolderId);
  }, [rootFolderId]);

  const getHighestSemverVersion = (versions: ProjectVersion[]) =>
    versions
      .slice()
      .sort((a, b) => {
        if (a.semver_major !== b.semver_major) return b.semver_major - a.semver_major;
        if (a.semver_minor !== b.semver_minor) return b.semver_minor - a.semver_minor;
        return b.semver_patch - a.semver_patch;
      })[0] ?? null;

  const resolveDefaultVersion = (projectId: string) => {
    const versions = projectVersions.filter(v => v.project_id === projectId);
    if (versions.length === 0) return null;
    const defaultVersion = versions.find(v => v.is_default);
    if (defaultVersion) return defaultVersion;

    const publishedVersions = versions.filter(v => v.is_published);
    return getHighestSemverVersion(publishedVersions) ?? getHighestSemverVersion(versions);
  };

  useEffect(() => {
    if (!selectedProject) {
      setSelectedVersion(null);
      return;
    }

    const resolved = resolveDefaultVersion(selectedProject.id);
    if (!resolved) {
      setSelectedVersion(null);
      return;
    }

    if (resolved.id !== selectedVersion?.id) {
      setSelectedVersion(resolved);
    }
  }, [selectedProject, projectVersions]);

  useEffect(() => {
    if (!selectedVersion) return;
    if (selectedTopic && selectedTopic.project_version_id !== selectedVersion.id) {
      setSelectedTopic(null);
    }
    if (selectedDocument && selectedDocument.project_version_id !== selectedVersion.id) {
      setSelectedDocument(null);
    }
  }, [selectedVersion, selectedTopic, selectedDocument]);

  // Keep selectedDocument in sync with documents array after refetch
  useEffect(() => {
    if (selectedDocument && documents.length > 0) {
      const updatedDoc = documents.find(d => d.id === selectedDocument.id);
      if (updatedDoc && (
        updatedDoc.content_html !== selectedDocument.content_html ||
        updatedDoc.published_content_html !== selectedDocument.published_content_html ||
        updatedDoc.title !== selectedDocument.title ||
        updatedDoc.is_published !== selectedDocument.is_published
      )) {
        setSelectedDocument(updatedDoc);
      }
    }
  }, [documents]);
  
  // Reset visible pages when filters change
  useEffect(() => {
    setVisiblePagesCount(10);
  }, [selectedProject, selectedTopic, searchQuery]);

  const scopedDocuments = selectedVersion
    ? documents.filter(doc => doc.project_version_id === selectedVersion.id)
    : documents;

  const scopedTopics = selectedVersion
    ? topics.filter(topic => topic.project_version_id === selectedVersion.id)
    : topics;

  const getDescendantProjectIds = (projectId: string) => {
    const ids = new Set<string>([projectId]);
    const queue = [projectId];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const project of projects) {
        if (project.parent_id === current && !ids.has(project.id)) {
          ids.add(project.id);
          queue.push(project.id);
        }
      }
    }
    return ids;
  };

  const selectedProjectIds = selectedProject ? getDescendantProjectIds(selectedProject.id) : null;
  const unassignedDocuments = documents.filter((doc) => !doc.project_id);

  const buildProjectOptions = () => {
    const byParent = new Map<string | null, Project[]>();
    for (const project of projects) {
      const key = project.parent_id ?? null;
      const list = byParent.get(key) ?? [];
      list.push(project);
      byParent.set(key, list);
    }

    const options: Array<{ id: string; label: string }> = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = byParent.get(parentId) ?? [];
      children.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      for (const child of children) {
        const prefix = depth > 0 ? new Array(depth + 1).join("-- ") : "";
        options.push({ id: child.id, label: `${prefix}${child.name}` });
        walk(child.id, depth + 1);
      }
    };

    walk(null, 0);
    return options;
  };

  const getAssignableTopics = (projectId: string | null, projectVersionId: string | null) => {
    if (!projectId) return [];
    return topics.filter((topic) => {
      if (topic.project_id !== projectId) return false;
      if (!projectVersionId) return true;
      return topic.project_version_id === projectVersionId;
    });
  };

  // Filter documents based on selected project/topic and search query
  const filteredDocuments = scopedDocuments.filter(doc => {
    // Filter by search query first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (!doc.title.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    // Then filter by project/topic
    if (selectedTopic) {
      return doc.topic_id === selectedTopic.id;
    }
    if (selectedProject) {
      return !!selectedProjectIds?.has(doc.project_id);
    }
    return true;
  });
  
  // Paginated documents for infinite scroll
  const visibleDocuments = filteredDocuments.slice(0, visiblePagesCount);
  const hasMorePages = visiblePagesCount < filteredDocuments.length;
  
  // Filter projects and topics by search
  const filteredProjects = projects.filter(p => 
    !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredTopics = scopedTopics.filter(t => 
    !searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const assignProjectOptions = buildProjectOptions();
  const assignProjectVersionId = assignProjectId
    ? resolveDefaultVersion(assignProjectId)?.id ?? null
    : null;
  const assignableTopics = getAssignableTopics(assignProjectId || null, assignProjectVersionId);

  const selectedProjectVersions = selectedProject
    ? projectVersions
        .filter(v => v.project_id === selectedProject.id)
        .slice()
        .sort((a, b) => {
          if (a.semver_major !== b.semver_major) return b.semver_major - a.semver_major;
          if (a.semver_minor !== b.semver_minor) return b.semver_minor - a.semver_minor;
          return b.semver_patch - a.semver_patch;
        })
    : [];

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
        // Determine if conversion to Google Doc is needed
        let targetMimeType: string | undefined = undefined;
        const fileName = file.name.toLowerCase();
        
        if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
          targetMimeType = "application/vnd.google-apps.document";
        } else if (fileName.endsWith(".md") || fileName.endsWith(".markdown")) {
          // Drive API handles Markdown to Google Doc conversion well
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
  
  // Delete handlers with RBAC enforcement
  const handleDeleteProject = async (projectId: string, forceDelete = false): Promise<boolean> => {
    if (!permissions.canDeleteProject) {
      toast({ title: "Permission Denied", description: "You don't have permission to delete projects.", variant: "destructive" });
      await logUnauthorizedAttempt('delete_project', 'project', projectId, projectId, 'canDeleteProject');
      return false;
    }

    const project = projects.find((p) => p.id === projectId);
    const { data, error } = await invokeFunction<{
      ok?: boolean;
      error?: string;
    }>("delete-project", {
      body: { projectId },
    });

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

    await logAction('delete_project', 'project', projectId, projectId, { forceDelete });
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
    // RBAC check - editors and admins can delete topics
    if (!permissions.canDeleteTopic) {
      toast({ title: "Permission Denied", description: "You don't have permission to delete topics.", variant: "destructive" });
      await logUnauthorizedAttempt('delete_topic', 'topic', topicId, selectedProject?.id || '', 'canDeleteTopic');
      return false;
    }
    
    // Get the topic's drive folder ID first
    const topic = topics.find(t => t.id === topicId);
    
    // If Drive is not connected, allow app-only delete
    const canUseDrive = !!googleAccessToken;

    // Trash the Drive folder if it exists - block deletion if it fails (unless force delete)
    if (topic?.drive_folder_id && !forceDelete && canUseDrive) {
      const trashResult = await trashFile(topic.drive_folder_id);
      if (!trashResult.success) {
        if (trashResult.errorCode === "NOT_AUTHORIZED" || trashResult.errorCode === "NEEDS_REAUTH") {
          setForceDeleteAvailable(true);
          toast({ 
            title: "Cannot Delete from Drive", 
            description: "Drive access is unavailable. Deleting from app only.", 
            variant: "destructive" 
          });
          // fall through to app-only delete
        } else {
          toast({ 
            title: "Cannot Delete Topic", 
            description: trashResult.error || "Failed to trash the Drive folder. Please reconnect to Google Drive and try again.", 
            variant: "destructive" 
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
    
    const { data, error } = await invokeFunction<{
      ok?: boolean;
      error?: string;
    }>("delete-topic", {
      body: { topicId },
    });
    
    if (error || !data?.ok) {
      toast({ title: "Error", description: "Failed to delete topic.", variant: "destructive" });
      return false;
    } else {
      await logAction('delete_topic', 'topic', topicId, (selectedProject as any)?.id || '', { topicName: topic?.name, forceDelete });
      toast({ title: "Deleted", description: forceDelete ? "Topic deleted from app (Drive files remain)." : "Topic moved to Drive trash and deleted from app." });
      if ((selectedTopic as any)?.id === topicId) {
        setSelectedTopic(null);
      }
      fetchData();
      return true;
    }
  };
  
  const handleDeleteDocument = async (docId: string, forceDelete = false): Promise<boolean> => {
    // RBAC check - editors and admins can delete documents
    if (!permissions.canDeleteDocument) {
      toast({ title: "Permission Denied", description: "You don't have permission to delete pages.", variant: "destructive" });
      await logUnauthorizedAttempt('delete_document', 'document', docId, selectedProject?.id || '', 'canDeleteDocument');
      return false;
    }
    
    // Get the document's google doc ID first (search all documents, not just filtered)
    const doc = documents.find(d => d.id === docId);
    
    const canUseDrive = !!googleAccessToken;

    // Trash the Drive file if it exists - block deletion if it fails (unless force delete)
    if (doc?.google_doc_id && !forceDelete && canUseDrive) {
      const trashResult = await trashFile(doc.google_doc_id);
      if (!trashResult.success) {
        if (trashResult.errorCode === "NOT_AUTHORIZED" || trashResult.errorCode === "NEEDS_REAUTH") {
          setForceDeleteAvailable(true);
          toast({ 
            title: "Cannot Delete from Drive", 
            description: "Drive access is unavailable. Deleting from app only.", 
            variant: "destructive" 
          });
          // fall through to app-only delete
        } else {
          toast({ 
            title: "Cannot Delete Page", 
            description: trashResult.error || "Failed to trash the Drive file.", 
            variant: "destructive" 
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
    
    const { data, error } = await invokeFunction<{
      ok?: boolean;
      error?: string;
    }>("delete-document", {
      body: { documentId: docId },
    });
    
    if (error || !data?.ok) {
      toast({ title: "Error", description: "Failed to delete page.", variant: "destructive" });
      return false;
    } else {
      // Clear selected document/page to prevent showing a deleted page
      if (selectedDocument?.id === docId) {
        setSelectedDocument(null);
      }
      if (selectedPage === docId) {
        setSelectedPage(null);
      }
      await logAction('delete_document', 'document', docId, selectedProject?.id || '', { documentTitle: doc?.title, forceDelete });
      toast({ title: "Deleted", description: forceDelete ? "Page deleted from app (Drive file remains)." : "Page moved to Drive trash and deleted from app." });
      fetchData();
      return true;
    }
  };
  
  const confirmDelete = async (forceDelete = false) => {
    if (!itemToDelete) return;
    
    // Clear selected page/document before deleting to prevent navigation issues
    if (itemToDelete.type === 'document' && selectedPage === itemToDelete.id) {
      setSelectedPage(null);
    }
    if (itemToDelete.type === 'document' && selectedDocument?.id === itemToDelete.id) {
      setSelectedDocument(null);
    }
    
    let success = true;
    switch (itemToDelete.type) {
      case 'project':
        success = await handleDeleteProject(itemToDelete.id, forceDelete);
        break;
      case 'topic':
        success = await handleDeleteTopic(itemToDelete.id, forceDelete);
        break;
      case 'document':
        success = await handleDeleteDocument(itemToDelete.id, forceDelete);
        break;
    }
    
    // Only close dialog if deletion was successful or forced
    if (success || forceDelete) {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setForceDeleteAvailable(false);
    }
  };
  
  const handleOpenInDrive = (googleDocId: string) => {
    window.open(`https://docs.google.com/document/d/${googleDocId}/edit`, '_blank');
  };

  const handleTogglePublishPage = async (e: React.MouseEvent, docId: string, currentState: boolean) => {
    e.stopPropagation();
    const newState = !currentState;
    
    // Find the document to get its project and content
    const doc = documents.find(d => d.id === docId);
    const docProjectId = doc?.project_id ?? selectedProject?.id ?? '';

    // RBAC check - use document's project for permission check
    const hasPermission = selectedProject?.id === docProjectId
      ? (newState ? permissions.canPublish : permissions.canUnpublish)
      : await canPublishForProject(docProjectId);

    if (newState && !hasPermission) {
      toast({ title: "Permission Denied", description: "You don't have permission to publish pages.", variant: "destructive" });
      await logUnauthorizedAttempt('publish', 'document', docId, docProjectId, 'canPublish');
      return;
    }
    if (!newState && !hasPermission) {
      toast({ title: "Permission Denied", description: "You don't have permission to unpublish pages.", variant: "destructive" });
      await logUnauthorizedAttempt('unpublish', 'document', docId, docProjectId, 'canUnpublish');
      return;
    }
    
    const updateData: Record<string, any> = { is_published: newState };
    
    // If publishing, copy current content to published content (Copy-on-Write)
    if (newState) {
      if (doc?.content_id) {
        updateData.published_content_id = doc.content_id;
      }
      if (doc?.content_html) {
        updateData.published_content_html = doc.content_html; // Backward compatibility
      }
    }
    
    const { data, error } = await invokeFunction<{
      ok?: boolean;
      document?: any;
      error?: string;
    }>("update-document", {
      body: {
        documentId: docId,
        data: updateData,
      },
    });

    if (error || !data?.ok) {
      toast({ title: "Error", description: "Failed to update publish state.", variant: "destructive" });
    } else {
      await logAction(newState ? 'publish' : 'unpublish', 'document', docId, docProjectId, { 
        documentTitle: doc?.title,
        previousState: currentState ? 'published' : 'draft',
        newState: newState ? 'published' : 'draft'
      });
      toast({
        title: newState ? "Published" : "Unpublished",
        description: newState ? "Page is now live." : "Page is no longer published.",
      });
      setDocuments(prev => prev.map(d => d.id === docId ? { 
        ...d, 
        is_published: newState,
        published_content_id: newState ? d.content_id : d.published_content_id,
        published_content_html: newState ? d.content_html : d.published_content_html 
      } : d));
    }
  };

  const handleRepublishPage = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    
    const doc = documents.find(d => d.id === docId);
    if (!doc?.content_html) {
      toast({ title: "Error", description: "No content to publish.", variant: "destructive" });
      return;
    }

    // RBAC check - use document's project for permission check
    const docProjectId = doc.project_id;
    const hasPermission = selectedProject?.id === docProjectId
      ? permissions.canPublish
      : await canPublishForProject(docProjectId);

    if (!hasPermission) {
      toast({ title: "Permission Denied", description: "You don't have permission to publish pages.", variant: "destructive" });
      await logUnauthorizedAttempt('republish', 'document', docId, docProjectId, 'canPublish');
      return;
    }
    
    const { data, error } = await invokeFunction<{
      ok?: boolean;
      document?: any;
      error?: string;
    }>("update-document", {
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
      await logAction('republish', 'document', docId, docProjectId, { documentTitle: doc?.title });
      toast({
        title: "Republished",
        description: "Changes are now live.",
      });
      setDocuments(prev => prev.map(d => d.id === docId ? { 
        ...d, 
        is_published: true,
        published_content_id: d.content_id,
        published_content_html: d.content_html 
      } : d));
    }
  };

  // Bulk action handlers
  const handleSelectDoc = (docId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedDocIds.size === visibleDocuments.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(visibleDocuments.map(d => d.id)));
    }
  };

  const handleBulkPublish = async () => {
    if (!permissions.canPublish) {
      toast({ title: "Permission Denied", description: "You don't have permission to publish pages.", variant: "destructive" });
      return;
    }
    
    setIsBulkPublishing(true);
    const docsToPublish = documents.filter(d => selectedDocIds.has(d.id) && !d.is_published);
    
    let successCount = 0;
    for (const doc of docsToPublish) {
      const { data, error } = await invokeFunction<{
        ok?: boolean;
        document?: any;
        error?: string;
      }>("update-document", {
        body: {
          documentId: doc.id,
          data: {
            is_published: true,
            ...(doc.content_html ? { published_content_html: doc.content_html } : {}),
          },
        },
      });
      
      if (!error && data?.ok) {
        successCount++;
        await logAction('publish', 'document', doc.id, doc.project_id, { documentTitle: doc.title, bulk: true });
      }
    }
    
    if (successCount > 0) {
      toast({
        title: "Bulk Publish Complete",
        description: `Published ${successCount} page${successCount > 1 ? 's' : ''} successfully.`,
      });
      setSelectedDocIds(new Set());
      fetchData();
    } else {
      toast({ title: "No pages published", description: "Selected pages are already published.", variant: "destructive" });
    }
    setIsBulkPublishing(false);
  };

  const handleBulkUnpublish = async () => {
    if (!permissions.canPublish) {
      toast({ title: "Permission Denied", description: "You don't have permission to unpublish pages.", variant: "destructive" });
      return;
    }
    
    setIsBulkUnpublishing(true);
    const docsToUnpublish = documents.filter(d => selectedDocIds.has(d.id) && d.is_published);
    
    let successCount = 0;
    for (const doc of docsToUnpublish) {
      const { data, error } = await invokeFunction<{
        ok?: boolean;
        document?: any;
        error?: string;
      }>("update-document", {
        body: {
          documentId: doc.id,
          data: { is_published: false },
        },
      });
      
      if (!error && data?.ok) {
        successCount++;
        await logAction('unpublish', 'document', doc.id, doc.project_id, { documentTitle: doc.title, bulk: true });
      }
    }
    
    if (successCount > 0) {
      toast({
        title: "Bulk Unpublish Complete",
        description: `Unpublished ${successCount} page${successCount > 1 ? 's' : ''} successfully.`,
      });
      setSelectedDocIds(new Set());
      fetchData();
    } else {
      toast({ title: "No pages unpublished", description: "No published pages were selected.", variant: "destructive" });
    }
    setIsBulkUnpublishing(false);
  };

  const clearSelection = () => {
    setSelectedDocIds(new Set());
  };
  
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  
  const handleBulkDelete = async () => {
    if (!permissions.canDeleteDocument) {
      toast({ title: "Permission Denied", description: "You don't have permission to delete pages.", variant: "destructive" });
      return;
    }

    setIsBulkDeleting(true);
    const docIds = Array.from(selectedDocIds);
    let successCount = 0;

    for (const docId of docIds) {
      const { data, error } = await invokeFunction<{
        ok?: boolean;
        error?: string;
      }>("delete-document", {
        body: { documentId: docId },
      });

      if (!error && data?.ok) {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Bulk delete complete",
        description: `Deleted ${successCount} page${successCount > 1 ? "s" : ""}.`,
      });
      setSelectedDocIds(new Set());
      fetchData();
    } else {
      toast({ title: "No pages deleted", description: "Could not delete selected pages.", variant: "destructive" });
    }

    setIsBulkDeleting(false);
    setBulkDeleteDialogOpen(false);
  };
  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
  };

  const handleOpenPage = (title: string) => {
    console.log("Opening page:", title);
    setSelectedPage(title);
  };

  const handleShareProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    
    // RBAC check - only admins can share projects
    if (!permissions.canManageMembers) {
      toast({ title: "Permission Denied", description: "You don't have permission to share projects.", variant: "destructive" });
      await logUnauthorizedAttempt('share_project', 'project', project.id, project.id, 'canManageMembers');
      return;
    }
    
    setSelectedProject(project);
    setShareOpen(true);
  };

  // Normalize structure - merge scattered topics with same prefix
  const handleNormalizeStructure = async (projectId: string) => {
    setIsNormalizing(true);
    try {
      const { data, error } = await invokeFunction('normalize-structure', {
        body: { projectId }
      });
      
      if (error) throw error;
      
      toast({
        title: "Structure Normalized",
        description: `Merged ${data?.mergedCount || 0} topics into parent-child hierarchy.`,
      });
      
      // Refresh data to show updated structure
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

  // Repair hierarchy - detect and fix duplicate topics/sub-projects
  const [isRepairing, setIsRepairing] = useState(false);
  const handleRepairHierarchy = async (projectId: string) => {
    setIsRepairing(true);
    try {
      // First do a dry run to see what would be repaired
      const { data: dryRunData, error: dryRunError } = await invokeFunction('repair-hierarchy', {
        body: { projectId, dryRun: true }
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
      
      // Show what was found and apply repairs
      const { data, error } = await invokeFunction('repair-hierarchy', {
        body: { projectId, dryRun: false }
      });
      
      if (error) throw error;
      
      toast({
        title: "Hierarchy Repaired",
        description: `Found ${data?.duplicatesFound || 0} duplicates, applied ${data?.repairsApplied || 0} repairs.`,
      });
      
      // Refresh data to show updated structure
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

  // Connect to Google Drive (request access)
  const handleConnectDrive = async () => {
    setShowGeneralSettings(true);
  };

  const ensureDefaultVersionForProject = async (projectId: string, isPublished: boolean) => {
    const { data: versionRes, error: versionError } = await invokeFunction<{
      ok?: boolean;
      versions?: any[];
      error?: string;
    }>("list-project-versions", { body: { projectIds: [projectId] } });

    if (versionError || !versionRes?.ok) {
      console.error("Error checking default version:", versionError || versionRes?.error);
    } else {
      const existingDefault = (versionRes.versions || []).find((v: any) => v.is_default);
      if (existingDefault?.id) return String(existingDefault.id);
    }

    const { data: created, error: createError } = await invokeFunction<{
      ok?: boolean;
      versionId?: string;
      error?: string;
    }>("create-project-version", {
      body: {
        projectId,
        name: "v1.0",
        slug: "v1.0",
        isDefault: true,
        isPublished,
        semverMajor: 1,
        semverMinor: 0,
        semverPatch: 0,
      },
    });

    if (createError || !created?.ok) {
      console.error("Error creating default version:", createError || created?.error);
      return null;
    }

    return created?.versionId ?? null;
  };

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
        assignTopicId && assignableTopics.some((t) => t.id === assignTopicId) ? assignTopicId : null;

      const { data: updated, error } = await invokeFunction<{
        ok?: boolean;
        document?: any;
        error?: string;
      }>("update-document", {
        body: {
          documentId: assignTargetDoc.id,
          data: {
            project: assignProjectId,
            project_version: versionId,
            topic: finalTopicId,
          },
        },
      });

      if (error || !updated?.ok) {
        toast({
          title: "Couldn't assign project",
          description: error?.message || "No changes were applied.",
          variant: "destructive",
        });
        return;
      }

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === assignTargetDoc.id
            ? {
                ...doc,
                project_id: assignProjectId,
                project_version_id: versionId ?? doc.project_version_id,
                topic_id: finalTopicId,
              }
            : doc
        )
      );

      setAssignProjectOpen(false);
      setAssignTargetDoc(null);
      setAssignProjectId("");
      setAssignTopicId("");
      toast({ title: "Project assigned", description: "This page now belongs to the selected project." });
    } catch (error: any) {
      toast({
        title: "Couldn't assign project",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningProject(false);
    }
  };

  // Sync projects from Google Drive
  const handleSyncFromDrive = async () => {
    if (!rootFolderId || !organizationId || !user) {
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
        rootFolderId,
        rootName: organizationName || "Root",
      });

      const folderNodes = folderTree.folders
        .filter((node) => node.id !== rootFolderId)
        .sort((a, b) => a.depth - b.depth);
      const nodeById = new Map(folderNodes.map((node) => [node.id, node]));
      const topLevelFolders = folderNodes.filter(
        (node) => node.parentId === rootFolderId && node.depth === 1
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
        const list = projectsByNameParent.get(nameKey) ?? [];
        list.push(project);
        projectsByNameParent.set(nameKey, list);
      }
      let syncedProjects = 0;
      let syncedTopics = 0;
      let syncedDocs = 0;

      const getTopFolderId = (nodeId: string): string | null => {
        let current = nodeById.get(nodeId);
        while (current) {
          if (current.parentId === rootFolderId) return current.id;
          current = current.parentId ? nodeById.get(current.parentId) : undefined;
        }
        return null;
      };

      const getParentIdFromRow = (row: any): string | null => {
        const attrs = row?.attributes || row || {};
        const parentRaw =
          attrs.parent?.data?.id ??
          attrs.parent?.id ??
          attrs.parent_id ??
          attrs.parent ??
          null;
        return parentRaw && parentRaw !== "null" && parentRaw !== "undefined" ? String(parentRaw) : null;
      };

      const getDriveParentIdFromRow = (row: any): string | null => {
        const attrs = row?.attributes || row || {};
        const raw =
          attrs.drive_parent_id ??
          attrs.driveParentId ??
          attrs.drive_parent ??
          null;
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
          let existingProject: any = null;
          const { data: projectRows } = await list("projects", {
            filters: { drive_folder_id: node.id },
            limit: 1,
          });
          existingProject = Array.isArray(projectRows) ? projectRows[0] : null;

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
              driveParentId: rootFolderId,
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
          if (existingParentId) {
            updateData.parent = null;
          }
          if (!projectsByDriveId.has(node.id)) {
            updateData.drive_folder_id = node.id;
          }
          if (existingDriveParentId !== rootFolderId) {
            updateData.drive_parent_id = rootFolderId;
          }
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
          let existingProject: any = null;
          const { data: projectRows } = await list("projects", {
            filters: { drive_folder_id: node.id },
            limit: 1,
          });
          existingProject = Array.isArray(projectRows) ? projectRows[0] : null;

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
          if (existingParentId !== parentProjectId) {
            updateData.parent = parentProjectId;
          }
          if (!projectsByDriveId.has(node.id)) {
            updateData.drive_folder_id = node.id;
          }
          if (existingDriveParentId !== (node.parentId || null)) {
            updateData.drive_parent_id = node.parentId || null;
          }
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

        let existingTopic: any = null;
        const { data: topicRows } = await list("topics", {
          filters: { drive_folder_id: node.id },
          limit: 1,
        });
        existingTopic = Array.isArray(topicRows) ? topicRows[0] : null;

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

        const docs = projectResult.files.filter(item => item.mimeType === docMimeType);

        for (const doc of docs) {
          let existingDocs: any[] = [];
          const { data: docRows } = await list("documents", {
            filters: { google_doc_id: doc.id },
            limit: 50,
          });
          existingDocs = Array.isArray(docRows) ? docRows : [];

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

          if (existingDoc) {
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
              body: {
                documentId: (existingDoc as any).id,
                data: payload as any,
              },
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
              syncedDocs++;
            } else if (docError || created?.error) {
              console.error("Error creating document:", docError || created?.error);
            }
          }
        }
      }

      toast({
        title: "Sync complete",
        description: `Synced ${syncedProjects} new projects, ${syncedTopics} topics, and ${syncedDocs} documents.`,
      });

      // Refresh the projects list
      fetchData();
      
    } catch (error: any) {
      console.error("Sync error:", error);
      
      // Check if it's a scope/permission error
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
          description:
            recovery.isOwner
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <span className="text-2xl font-semibold text-foreground">Docspeare</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding flow for new users (with or without organization)
  if (needsOnboarding) {
    return (
      <Onboarding 
        onComplete={() => {
          setNeedsOnboarding(false);
          fetchData();
        }} 
        organizationId={organizationId}
      />
    );
  }

  // If showing general settings
  if (showGeneralSettings) {
    return <GeneralSettings onBack={() => {
      setShowGeneralSettings(false);
      fetchData(); // Refresh data when returning from settings
    }} />;
  }

  // If a page is selected, show the PageView
  if (selectedPage && selectedDocument) {
    // Callback to refresh document content after sync
    const handleDocumentUpdate = async () => {
      const { data: freshRes, error } = await strapiFetch<{ data: any }>(
        `/api/documents/${selectedDocument.id}?populate[owner][fields][0]=full_name&populate[owner][fields][1]=email&populate[owner][fields][2]=username&populate[project][fields][0]=id&populate[project_version][fields][0]=id&populate[topic][fields][0]=id`
      );
      if (error || !freshRes?.data) return;
      const updatedDoc = mapDocumentFromStrapi(freshRes.data);
      setSelectedDocument(updatedDoc as Document);
      setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc as Document : d));
    };

    return (
      <PageView
        document={selectedDocument}
        onBack={() => {
          setSelectedPage(null);
          setSelectedDocument(null);
        }}
        onDocumentUpdate={handleDocumentUpdate}
      />
    );
  }

  // Projects tree helpers (single-level nesting)
  const rootProjects = filteredProjects.filter((p) => !p.parent_id);
  const getSubProjects = (parentId: string) => filteredProjects.filter((p) => p.parent_id === parentId);

  const selectedParentProject = selectedProject?.parent_id
    ? filteredProjects.find((p) => p.id === selectedProject.parent_id) || null
    : null;

  // If you're inside a sub-project, show its siblings (parent's sub-projects) for easy switching.
  const subProjectsGroupProject = selectedParentProject ?? selectedProject ?? null;
  const visibleSubProjects = subProjectsGroupProject ? getSubProjects(subProjectsGroupProject.id) : [];

  return (
    <TooltipProvider>
    <DriveReauthListener />
    <div className="min-h-screen bg-background flex w-full">
      <DashboardSidebar
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
        user={user}
        organizationSlug={organizationSlug}
        organizationName={organizationName}
        appRole={appRole}
        isOrgOwner={isOrgOwner}
        projects={projects}
        filteredProjects={filteredProjects}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        setExpandedProjects={setExpandedProjects}
        subProjectsExpanded={subProjectsExpanded}
        setSubProjectsExpanded={setSubProjectsExpanded}
        filteredTopics={filteredTopics}
        scopedDocuments={scopedDocuments}
        scopedTopics={scopedTopics}
        selectedTopic={selectedTopic}
        setSelectedTopic={setSelectedTopic}
        selectedPage={selectedPage}
        setSelectedPage={setSelectedPage}
        setSelectedDocument={setSelectedDocument}
        selectedVersion={selectedVersion}
        setSelectedVersion={setSelectedVersion}
        projectVersions={projectVersions}
        topicsExpanded={topicsExpanded}
        setTopicsExpanded={setTopicsExpanded}
        driveIntegrationEnabled={DRIVE_INTEGRATION_ENABLED}
        needsDriveAccess={needsDriveAccess}
        rootFolderId={rootFolderId}
        isConnectingDrive={false}
        isSyncing={isSyncing}
        handleConnectDrive={handleConnectDrive}
        handleSyncFromDrive={handleSyncFromDrive}
        setAddProjectOpen={setAddProjectOpen}
        setAddTopicOpen={setAddTopicOpen}
        setParentTopicForCreate={setParentTopicForCreate}
        setAddPageOpen={setAddPageOpen}
        onUploadFile={handleUploadFile}
        setShowAPISettings={setShowAPISettings}
        setShowMCPSettings={setShowMCPSettings}
        setShowIntegrations={setShowIntegrations}
        setShowGeneralSettings={setShowGeneralSettings}
        setProjectSettingsOpen={setProjectSettingsOpen}
        setShareOpen={setShareOpen}
        setTopicSettingsOpen={setTopicSettingsOpen}
        setSettingsTopic={setSettingsTopic}
        setPageSettingsOpen={setPageSettingsOpen}
        setPageSettingsTarget={setPageSettingsTarget}
        setInviteMemberOpen={setInviteMemberOpen}
        setShowAIAssistant={setShowAIAssistant}
        setAuditLogOpen={setAuditLogOpen}
        setDeleteDialogOpen={setDeleteDialogOpen}
        setItemToDelete={setItemToDelete}
        setSearchQuery={setSearchQuery}
        signOut={signOut}
        permissions={{
          canCreateProject: canCreateProject,
          canDeleteProject: permissions.canDeleteProject,
          canManageTeam: permissions.canInviteMembers || permissions.canManageMembers || false,
          canViewAuditLogs: permissions.canViewAuditLogs,
          canEditProject: permissions.canEditProjectSettings || permissions.canEdit || false
        }}
        navigate={navigate}
        fetchData={fetchData}
        currentPath={location.pathname}
      />

      {/* Main Content */}
      {showAPISettings && organizationId ? (
        <APISettingsPanel
          organizationId={organizationId}
          orgSlug={organizationSlug}
          onBack={() => {
            setShowAPISettings(false);
            fetchData();
          }}
        />
      ) : showMCPSettings && organizationId ? (
        <MCPSettingsPanel
          organizationId={organizationId}
          orgSlug={organizationSlug}
          onBack={() => {
            setShowMCPSettings(false);
            fetchData();
          }}
        />
      ) : showIntegrations ? (
        <IntegrationsPanel
          projectId={selectedProject?.id || null}
          onBack={() => {
            setShowIntegrations(false);
          }}
        />
      ) : (
        <main className={cn(
          "flex-1 flex flex-col pt-14 lg:pt-0 min-w-0 transition-all duration-300",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}>
          {/* Header */}
          <header className="h-auto min-h-14 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 py-2 sm:px-4 lg:px-6 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-medium text-foreground text-sm truncate">{organizationName || "Workspace"}</span>
              {selectedProject && (
                <>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground text-sm truncate">{selectedProject?.name}</span>
                </>
              )}
              {selectedTopic?.name && (
                <>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 hidden sm:block" />
                  <span className="text-muted-foreground text-sm truncate hidden sm:block">{selectedTopic.name}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <DriveStatusIndicator onStatusChange={(connected) => setNeedsDriveAccess(!connected)} />
              {rootFolderId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 px-2 sm:px-3"
                  onClick={handleSyncFromDrive}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Drive"}</span>
                </Button>
              )}
              {organizationId && <NotificationCenter organizationId={organizationId} onWorkspaceChange={() => fetchData()} />}
              {(isOrgOwner || appRole === 'admin') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 px-2 sm:px-3"
                  onClick={() => setInviteMemberOpen(true)}
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Invite</span>
                </Button>
              )}
              <Button 
                variant={showAIAssistant ? "secondary" : "outline"}
                size="sm" 
                className="gap-1.5 h-8 px-2 sm:px-3" 
                onClick={() => setShowAIAssistant(!showAIAssistant)}
              >
                <Bot className="w-4 h-4" />
                <span className="hidden md:inline">AI Assistant</span>
              </Button>
              {organizationSlug && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5 h-8 px-2 sm:px-3" 
                    onClick={() => window.open(`/internal/${organizationSlug}`, '_blank')}
                  >
                    <Lock className="w-4 h-4" />
                    <span className="hidden lg:inline">Internal Docs</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5 h-8 px-2 sm:px-3" 
                    onClick={() => window.open(`/docs/${organizationSlug}`, '_blank')}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span className="hidden lg:inline">View Docs</span>
                  </Button>
                </>
              )}
              <Button 
                variant="hero" 
                size="sm" 
                className="gap-1.5 h-8 px-2 sm:px-3" 
                onClick={() => setAddPageOpen(true)}
                disabled={!selectedTopic}
                title={!selectedTopic ? "Select a topic first" : "Add page"}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Page</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 h-8 px-2 sm:px-3" 
                onClick={() => setImportMarkdownOpen(true)}
                disabled={!selectedProject}
                title={!selectedProject ? "Select a project first" : "Import Markdown files"}
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Import</span>
              </Button>
            </div>
          </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main content area */}
          <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto overflow-x-hidden">
          
          {/* Workspace switch banner */}
          {approvedOrgId && (
            <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">You've been approved to join {approvedOrgName}!</p>
                  <p className="text-sm text-muted-foreground">Switch to your team's workspace to collaborate with your colleagues.</p>
                </div>
              </div>
              <Button 
                variant="hero" 
                size="sm" 
                onClick={async () => {
                  const switched = await switchToApprovedWorkspace();
                  if (switched) {
                    // Refresh data to load the new workspace
                    await fetchData();
                  }
                }}
                className="gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                Switch Workspace
              </Button>
            </div>
          )}

          {showGettingStarted && (
            <div className="mb-6 rounded-xl border border-border bg-card/50 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold">Getting started</h2>
                  <p className="text-sm text-muted-foreground">
                    Complete these steps to publish from Google Drive.
                  </p>
                </div>
                <Badge variant="secondary" className="w-fit">Setup</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {projectStepDone ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Create your first project</p>
                      <p className="text-xs text-muted-foreground">
                        Organize docs into a project with topics and pages.
                      </p>
                    </div>
                  </div>
                  {projectStepDone ? (
                    <Badge variant="secondary" className="w-fit">Ready</Badge>
                  ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setParentProjectForCreate(null);
                          setAddProjectOpen(true);
                        }}
                        disabled={!canCreateProject}
                        title={!canCreateProject ? createProjectDisabledTitle : "Create a project"}
                      >
                        Create Project
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {needsDriveAccess ? (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Connect Google Drive</p>
                      <p className="text-xs text-muted-foreground">
                        Authorize Drive access so Docspeare can sync and publish your docs.
                      </p>
                    </div>
                  </div>
                  {needsDriveAccess ? (
                    <Button size="sm" onClick={handleConnectDrive}>
                      Connect Drive
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="w-fit">Ready</Badge>
                  )}
                </div>
            </div>
          )}
          
          {/* Stats */}
          {(() => {
            const publishedCount = filteredDocuments.filter(d => d.is_published).length;
            const draftCount = filteredDocuments.filter(d => !d.is_published && !d.published_content_html).length;
            const pendingRepublishCount = filteredDocuments.filter(d => 
              d.is_published && d.content_html && d.published_content_html && d.content_html !== d.published_content_html
            ).length;
            
            // Calculate recent activity (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentlyUpdated = filteredDocuments.filter(d => {
              if (!d.google_modified_at) return false;
              return new Date(d.google_modified_at) > sevenDaysAgo;
            }).length;
            
            // Pages ready to publish (drafts with content)
            const readyToPublish = filteredDocuments.filter(d => !d.is_published && d.content_html).length;
            
            const publishRate = filteredDocuments.length > 0 
              ? Math.round((publishedCount / filteredDocuments.length) * 100) 
              : 0;
            
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div className="p-3 sm:p-4 rounded-xl glass">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{filteredDocuments.length}</p>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">{projects.length} proj</span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Pages</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl glass">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="text-xl sm:text-2xl font-bold text-state-active">{publishedCount}</p>
                    <span className="text-[10px] sm:text-xs text-state-active">{publishRate}%</span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Published</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl glass hidden sm:block">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="text-xl sm:text-2xl font-bold text-blue-500">{recentlyUpdated}</p>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">7 days</span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Recently Updated</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl glass">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="text-xl sm:text-2xl font-bold text-amber-500">{pendingRepublishCount}</p>
                    {pendingRepublishCount > 0 && <RefreshCw className="w-3 h-3 text-amber-500" />}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl glass hidden lg:block">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="text-xl sm:text-2xl font-bold text-primary">{readyToPublish}</p>
                    {readyToPublish > 0 && <Send className="w-3 h-3 text-primary" />}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Ready to Publish</p>
                </div>
              </div>
            );
          })()}

          <AnalyticsPanel
            projectId={selectedProject?.id || null}
            documentId={selectedDocument?.id || null}
            className="mb-4 sm:mb-6"
          />

          {unassignedDocuments.length > 0 && (
            <div className="mb-4 sm:mb-6 rounded-xl border border-amber-300/40 bg-amber-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">Unassigned pages</h3>
                  <p className="text-xs text-amber-800">
                    These pages aren't linked to a project yet. Assign them so they appear in project navigation.
                  </p>
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                  {unassignedDocuments.length}
                </Badge>
              </div>
              <div className="mt-3 space-y-2">
                {unassignedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-amber-700" />
                      <span className="truncate">{doc.title || "Untitled"}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssignTargetDoc(doc);
                        setAssignProjectId("");
                        setAssignTopicId("");
                        setAssignProjectOpen(true);
                      }}
                    >
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-semibold shrink-0">Topics</h2>
                {selectedTopic?.name && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <ChevronRight className="w-4 h-4" />
                    <button
                      onClick={() => setSelectedTopic(null)}
                      className="hover:text-foreground transition-colors"
                    >
                      All
                    </button>
                    {(() => {
                      // Build breadcrumb path
                      const path: Topic[] = [];
                      let current: Topic | undefined = selectedTopic;
                      while (current?.name) {
                        path.unshift(current);
                        current = scopedTopics.find(t => t.id === current?.parent_id);
                      }
                      return path.map((topic, idx) => (
                        topic?.name ? (
                          <span key={topic.id} className="flex items-center">
                            <ChevronRight className="w-4 h-4" />
                            <button
                              onClick={() => setSelectedTopic(topic)}
                              className={idx === path.length - 1 ? "text-foreground font-medium" : "hover:text-foreground transition-colors"}
                            >
                              {topic.name}
                            </button>
                          </span>
                        ) : null
                      ));
                    })()}
                  </div>
                )}
              </div>
              <button 
                onClick={() => {
                  setParentTopicForCreate(null);
                  setAddTopicOpen(true);
                }}
                disabled={!selectedProject}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title={!selectedProject ? "Select a project first" : "Add topic"}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {!selectedProject ? (
              <p className="text-sm text-muted-foreground">Select a project to view topics.</p>
            ) : (
              <SubtopicsView
                topics={scopedTopics.filter(t => t.project_id === selectedProject.id)}
                allTopics={scopedTopics.filter(t => t.project_id === selectedProject.id)}
                selectedTopic={selectedTopic}
                onSelectTopic={(topic) => setSelectedTopic(topic)}
                onAddSubtopic={(parentTopic) => {
                  setParentTopicForCreate(parentTopic);
                  setAddTopicOpen(true);
                }}
                onDeleteTopic={(topic) => {
                  setItemToDelete({ type: 'topic', id: topic.id, name: topic.name });
                  setDeleteDialogOpen(true);
                }}
                documents={scopedDocuments}
              />
            )}
          </div>

          {/* Pages Table */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold">Recent Pages</h2>
              {/* Bulk Actions Bar */}
              {selectedDocIds.size > 0 && (
                <div className="flex items-center gap-1.5 sm:gap-2 bg-primary/10 px-2 sm:px-3 py-1.5 rounded-lg animate-in slide-in-from-right-2 overflow-x-auto">
                  <span className="text-sm font-medium text-primary">
                    {selectedDocIds.size} selected
                  </span>
                  <div className="h-4 w-px bg-border" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                    onClick={handleBulkPublish}
                    disabled={isBulkPublishing}
                  >
                    {isBulkPublishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Publish
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={handleBulkUnpublish}
                    disabled={isBulkUnpublishing}
                  >
                    {isBulkUnpublishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                    Unpublish
                  </Button>
                  {permissions.canDeleteDocument && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setBulkDeleteDialogOpen(true)}
                      disabled={isBulkDeleting}
                    >
                      {isBulkDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Delete
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={clearSelection}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="w-8 sm:w-10 px-2 sm:px-4 py-2 sm:py-3">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title={selectedDocIds.size === visibleDocuments.length ? "Deselect all" : "Select all"}
                      >
                        {selectedDocIds.size === visibleDocuments.length && visibleDocuments.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : selectedDocIds.size > 0 ? (
                          <div className="w-4 h-4 border-2 border-primary rounded bg-primary/20" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Page
                    </th>
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                      Status
                    </th>
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      Owner
                    </th>
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                      Modified
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 sm:px-4 py-6 sm:py-8 text-center text-sm text-muted-foreground">
                        {selectedTopic 
                          ? "No pages in this topic yet."
                          : selectedProject
                            ? "Select a topic to view pages."
                            : "Select a project to view pages."}
                      </td>
                    </tr>
                  ) : (
                    visibleDocuments.map((doc) => {
                      const VisIcon = visibilityConfig[doc.visibility || 'internal'].icon;
                      return (
                        <tr
                          key={doc.id}
                          className={cn(
                            "hover:bg-secondary/30 transition-colors cursor-pointer group",
                            selectedDocIds.has(doc.id) && "bg-primary/5"
                          )}
                          onClick={() => {
                            if (!doc.project_id) {
                              setAssignTargetDoc(doc);
                              setAssignProjectId("");
                              setAssignTopicId("");
                              setAssignProjectOpen(true);
                              return;
                            }

                            const docProject = projects.find((p) => p.id === doc.project_id) || null;
                            if (docProject && (!selectedProject || selectedProject.id !== docProject.id)) {
                              setSelectedProject(docProject);
                              setSelectedTopic(null);
                            }

                            // Use inline PageView instead of navigating to separate page
                            setSelectedDocument(doc);
                            setSelectedPage(doc.id);
                            // Set topic context for the document
                            const docTopic = topics.find(t => t.id === doc.topic_id);
                            if (docTopic) {
                              setSelectedTopic(docTopic);
                            }
                          }}
                        >
                          <td className="w-8 sm:w-10 px-2 sm:px-4 py-2 sm:py-3">
                            <button
                              onClick={(e) => handleSelectDoc(doc.id, e)}
                              className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {selectedDocIds.has(doc.id) ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs sm:text-sm font-medium text-foreground line-clamp-1">
                                  {doc.title || "Untitled Page"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {doc.is_published ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                ) : null}
                                <VisIcon className={`w-3 h-3 ${visibilityConfig[doc.visibility || 'internal'].color}`} />
                              </div>
                              <div className="flex items-center gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-1.5 rounded-md hover:bg-secondary transition-all text-muted-foreground"
                                      title="Page options"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAssignTargetDoc(doc);
                                        setAssignProjectId("");
                                        setAssignTopicId("");
                                        setAssignProjectOpen(true);
                                      }}
                                    >
                                      <Folder className="w-4 h-4 mr-2" />
                                      {doc.project_id ? "Move to Project" : "Assign Project"}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPageSettingsTarget(doc);
                                        setPageSettingsOpen(true);
                                      }}
                                    >
                                      <Settings className="w-4 h-4 mr-2" />
                                      Settings
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenInDrive(doc.google_doc_id);
                                      }}
                                    >
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      Open in Google Docs
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {(() => {
                              // Has unpublished changes if: not published, has published_content_html, and content differs
                              const hasUnpublishedChanges = !doc.is_published && 
                                doc.published_content_html && 
                                doc.content_html !== doc.published_content_html;
                              
                              if (doc.is_published) {
                                return (
                                  <div className="flex items-center gap-2">
                                    <Circle className="w-2 h-2 bg-green-500 rounded-full" />
                                    <span className="text-sm text-green-600">Published</span>
                                  </div>
                                );
                              } else if (hasUnpublishedChanges) {
                                return (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-xs gap-1.5 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600"
                                      onClick={(e) => handleRepublishPage(e, doc.id)}
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      Republish
                                    </Button>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="flex items-center gap-2">
                                    <Circle className="w-2 h-2 bg-muted-foreground rounded-full" />
                                    <span className="text-sm text-muted-foreground">Draft</span>
                                  </div>
                                );
                              }
                            })()}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{doc.owner_name || "—"}</span>
                            </div>
                          </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {doc.google_modified_at 
                                ? new Date(doc.google_modified_at).toLocaleDateString()
                                : "—"}
                            </span>
                          </div>
                        </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {hasMorePages && (
                <div className="p-4 border-t border-border flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisiblePagesCount(prev => prev + 10)}
                    className="gap-2"
                  >
                    Load More
                    <span className="text-muted-foreground">
                      ({visiblePagesCount} of {filteredDocuments.length})
                    </span>
                  </Button>
                </div>
              )}
            </div>
          </div>
          </div>
          
          {/* AI Assistant Panel - Now as Sheet */}
          <DocAssistantChat
            open={showAIAssistant}
            onOpenChange={setShowAIAssistant}
            currentProject={selectedProject?.name ? { id: selectedProject.id, name: selectedProject.name } : null}
            currentTopic={selectedTopic?.name ? { id: selectedTopic.id, name: selectedTopic.name } : null}
            onRefresh={fetchData}
            googleToken={getGoogleToken()}
          />
        </div>
        </main>
      )}

      <ProjectSharePanel
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={selectedProject?.id || ""}
        projectName={selectedProject?.name || ""}
        projectSlug={selectedProject?.slug}
        organizationSlug={organizationSlug}
        projectVersionSlug={selectedVersion?.slug || null}
      />
      
      <AddPageDialog
        open={addPageOpen}
        onOpenChange={setAddPageOpen}
        projectId={selectedProject?.id}
        projectName={selectedProject?.name}
        projectVersionId={selectedVersion?.id || null}
        topicId={selectedTopic?.id}
        topicName={selectedTopic?.name}
        parentFolderId={selectedTopic?.drive_folder_id || selectedProject?.drive_folder_id || null}
        organizationId={organizationId}
        onCreated={() => fetchData()}
      />
      
      <ImportMarkdownDialog
        open={importMarkdownOpen}
        onOpenChange={setImportMarkdownOpen}
        projectId={selectedProject?.id || ""}
        projectVersionId={selectedVersion?.id || ""}
        driveFolderId={selectedProject?.drive_folder_id || ""}
        organizationId={organizationId || ""}
        rootFolderId={rootFolderId || ""}
        onImportComplete={() => fetchData()}
      />

      <AddProjectDialog
        open={addProjectOpen}
        onOpenChange={(open) => {
          setAddProjectOpen(open);
          if (!open) setParentProjectForCreate(null);
        }}
        rootFolderId={rootFolderId}
        driveParentFolderId={parentProjectForCreate?.drive_folder_id ?? null}
        organizationId={organizationId || undefined}
        parentProjectId={parentProjectForCreate?.id}
        parentProjectName={parentProjectForCreate?.name}
        onOpenSettings={() => setShowGeneralSettings(true)}
        onCreated={(result) => {
          if (result?.id) {
            setProjects((prev) => {
              if (prev.some((p) => p.id === result.id)) return prev;
              const newProject: Project = {
                id: result.id,
                name: result.name,
                slug: null,
                drive_folder_id: null,
                visibility: "internal",
                is_published: false,
                parent_id: parentProjectForCreate?.id ?? null,
                organization_id: organizationId || "",
                show_version_switcher: true,
              };
              return [newProject, ...prev];
            });

            if (result.versionId) {
              setProjectVersions((prev) => {
                if (prev.some((v) => v.id === result.versionId)) return prev;
                return [
                  {
                    id: result.versionId,
                    project_id: result.id,
                    name: "v1.0",
                    slug: "v1.0",
                    is_default: true,
                    is_published: false,
                    semver_major: 1,
                    semver_minor: 0,
                    semver_patch: 0,
                  },
                  ...prev,
                ];
              });
            }
          }

          fetchData();
          setParentProjectForCreate(null);
          
          if (result && 'discoveryResult' in result && result.discoveryResult) {
            setDiscoveryResult(result.discoveryResult);
            setDiscoveryProjectId(result.id);
            setDiscoveryVersionId(result.versionId || null);
            setDiscoveryOpen(true);
          }
        }}
      />
      
      {discoveryResult && discoveryProjectId && (
        <DriveDiscoveryDialog
          open={discoveryOpen}
          onOpenChange={setDiscoveryOpen}
          projectId={discoveryProjectId}
          projectVersionId={discoveryVersionId}
          discoveryResult={discoveryResult}
          onImportComplete={() => fetchData()}
          onCancel={() => setDiscoveryOpen(false)}
        />
      )}
      
      <AddTopicDialog
        open={addTopicOpen}
        onOpenChange={(open) => {
          setAddTopicOpen(open);
          if (!open) setParentTopicForCreate(null);
        }}
        projectName={selectedProject?.name || null}
        projectId={selectedProject?.id || null}
        projectVersionId={selectedVersion?.id || null}
        projectFolderId={selectedProject?.drive_folder_id || null}
        parentTopic={parentTopicForCreate ? {
          id: parentTopicForCreate.id,
          name: parentTopicForCreate.name,
          drive_folder_id: parentTopicForCreate.drive_folder_id,
        } : null}
        organizationId={organizationId}
        onCreated={() => {
          fetchData();
          setParentTopicForCreate(null);
        }}
      />
      
      <ProjectSettingsPanel
        open={projectSettingsOpen}
        onOpenChange={setProjectSettingsOpen}
        projectId={selectedProject?.id || null}
        projectName={selectedProject?.name || null}
        onUpdate={() => fetchData()}
      />

      <Dialog
        open={assignProjectOpen}
        onOpenChange={(open) => {
          setAssignProjectOpen(open);
          if (!open) {
            setAssignTargetDoc(null);
            setAssignProjectId("");
            setAssignTopicId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Assign project</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose a project (or sub-project) for this page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Project</label>
              <Select
                value={assignProjectId}
                onValueChange={(value) => {
                  setAssignProjectId(value);
                  setAssignTopicId("");
                }}
              >
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {assignProjectOptions.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No projects found
                    </SelectItem>
                  ) : (
                    assignProjectOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {assignProjectId && assignableTopics.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Topic (optional)</label>
                <Select
                  value={assignTopicId || "root"}
                  onValueChange={(value) => setAssignTopicId(value === "root" ? "" : value)}
                >
                  <SelectTrigger className="bg-secondary">
                    <SelectValue placeholder="Project root" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">
                      <span className="text-muted-foreground">Project root (no topic)</span>
                    </SelectItem>
                    {assignableTopics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This list is scoped to the project's default version.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setAssignProjectOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignProject}
                disabled={!assignProjectId || isAssigningProject}
                className="flex-1"
              >
                {isAssigningProject ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <PageSettingsDialog
        open={pageSettingsOpen}
        onOpenChange={(open) => {
          setPageSettingsOpen(open);
          if (!open) setPageSettingsTarget(null);
        }}
        documentId={pageSettingsTarget?.id || null}
        documentTitle={pageSettingsTarget?.title || null}
        projectId={pageSettingsTarget?.project_id || null}
        googleDocId={pageSettingsTarget?.google_doc_id || null}
        onUpdate={() => fetchData()}
        onDelete={async (docId) => {
          const result = await handleDeleteDocument(docId);
          if (result !== false) {
            // If the user was viewing this page inline, close it.
            if (selectedPage === docId) setSelectedPage(null);
            if (selectedDocument?.id === docId) setSelectedDocument(null);
            setPageSettingsTarget(null);
          }
          return result;
        }}
      />
      
      <TopicSettingsDialog
        open={topicSettingsOpen}
        onOpenChange={setTopicSettingsOpen}
        topicId={settingsTopic?.id || null}
        topicName={settingsTopic?.name || null}
        projectId={settingsTopic?.project_id || null}
        organizationId={organizationId}
        onUpdate={() => fetchData()}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setForceDeleteAvailable(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemToDelete?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? 
              {itemToDelete?.type === 'project' && " This will also delete all topics and pages within it."}
              {itemToDelete?.type === 'topic' && " This will also delete all pages within it."}
              {forceDeleteAvailable 
                ? " Note: Drive files could not be deleted (they contain content not created by this app). Use 'Force Delete' to remove only from the app."
                : " The corresponding files will be moved to Google Drive trash (recoverable for 30 days)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {forceDeleteAvailable && (
              <AlertDialogAction 
                onClick={() => confirmDelete(true)}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                Force Delete (App Only)
              </AlertDialogAction>
            )}
            <AlertDialogAction 
              onClick={() => confirmDelete(false)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedDocIds.size} page{selectedDocIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the selected pages? 
              The corresponding files will be moved to Google Drive trash (recoverable for 30 days).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {permissions.canViewAuditLogs && selectedProject && (
        <AuditLogPanel
          open={auditLogOpen}
          onOpenChange={setAuditLogOpen}
          projectId={selectedProject.id}
        />
      )}
      
      {/* Invite Member Dialog */}
      {organizationId && (
        <InviteMemberDialog
          open={inviteMemberOpen}
          onOpenChange={setInviteMemberOpen}
          organizationId={organizationId}
          organizationName={organizationName}
        />
      )}
      
    </div>
    </TooltipProvider>
  );
};

export default Dashboard;
