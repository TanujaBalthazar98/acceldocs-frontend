import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SmartSearch } from "@/components/SmartSearch";
import { PageView } from "@/components/dashboard/PageView";
import { ProjectSharePanel } from "@/components/dashboard/ProjectSharePanel";
import { AddPageDialog } from "@/components/dashboard/AddPageDialog";
import { AddProjectDialog } from "@/components/dashboard/AddProjectDialog";
import { AddTopicDialog } from "@/components/dashboard/AddTopicDialog";
import { ProjectSettingsPanel } from "@/components/dashboard/ProjectSettingsPanel";
import { PageSettingsDialog } from "@/components/dashboard/PageSettingsDialog";
import { TopicSettingsDialog } from "@/components/dashboard/TopicSettingsDialog";
import { GeneralSettings } from "@/components/dashboard/GeneralSettings";
import { Onboarding } from "@/components/dashboard/Onboarding";
import { SubtopicsView } from "@/components/dashboard/SubtopicsView";
import { SidebarTopicsTree } from "@/components/dashboard/SidebarTopicsTree";
import { APISettingsPanel } from "@/components/dashboard/APISettingsPanel";
import { MCPSettingsPanel } from "@/components/dashboard/MCPSettingsPanel";
import { AuditLogPanel } from "@/components/dashboard/AuditLogPanel";
import { IntegrationsPanel } from "@/components/dashboard/IntegrationsPanel";
import { DocAssistantChat } from "@/components/dashboard/DocAssistantChat";

import { NotificationCenter } from "@/components/dashboard/NotificationCenter";
import { DriveStatusIndicator } from "@/components/dashboard/DriveStatusIndicator";
import { InviteMemberDialog } from "@/components/dashboard/InviteMemberDialog";
import { GlobalImportProgress } from "@/components/dashboard/GlobalImportProgress";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDrive, DriveFile } from "@/hooks/useGoogleDrive";
import { usePermissions, useAuditLog } from "@/hooks/usePermissions";
import { useJoinRequestNotifications } from "@/hooks/useJoinRequestNotifications";
import acceldataLogo from "@/assets/acceldata-logo.svg";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";

const stateConfig = {
  active: { color: "bg-state-active", label: "Active" },
  draft: { color: "bg-state-draft", label: "Draft" },
  deprecated: { color: "bg-state-deprecated", label: "Deprecated" },
  archived: { color: "bg-state-archived", label: "Archived" },
};

interface Project {
  id: string;
  name: string;
  drive_folder_id: string | null;
  visibility: VisibilityLevel;
  is_published: boolean;
  parent_id: string | null;
}

interface Topic {
  id: string;
  name: string;
  drive_folder_id: string;
  project_id: string;
  parent_id: string | null;
  display_order: number;
}

type VisibilityLevel = "internal" | "external" | "public";

interface Document {
  id: string;
  title: string;
  google_doc_id: string;
  project_id: string;
  topic_id: string | null;
  google_modified_at: string | null;
  created_at: string;
  visibility: VisibilityLevel;
  is_published: boolean;
  owner_id: string | null;
  owner_name?: string;
  content_html: string | null;
  published_content_html: string | null;
}

const visibilityConfig: Record<VisibilityLevel, { icon: typeof Lock; label: string; color: string }> = {
  internal: { icon: Lock, label: "Internal", color: "text-muted-foreground" },
  external: { icon: Eye, label: "External", color: "text-blue-400" },
  public: { icon: Globe, label: "Public", color: "text-green-400" },
};

const Dashboard = () => {
  const { user, signOut, requestDriveAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { listFolder, trashFile, getGoogleToken } = useGoogleDrive();
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [topicSettingsOpen, setTopicSettingsOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [parentTopicForCreate, setParentTopicForCreate] = useState<Topic | null>(null);
  const [settingsTopic, setSettingsTopic] = useState<Topic | null>(null);
  const [showGeneralSettings, setShowGeneralSettings] = useState(false);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [needsDriveAccess, setNeedsDriveAccess] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
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
  
  // Permissions and audit logging
  const { permissions, role, loading: permissionsLoading } = usePermissions(selectedProject?.id || null);
  const { logAction, logUnauthorizedAttempt } = useAuditLog();
  
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
      return;
    }
    
    setIsLoading(true);
    
    // Get user's profile and organization (use maybeSingle since profile might not exist)
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    
    if (profile?.organization_id) {
      setOrganizationId(profile.organization_id);
      
      // Get organization details
      const { data: org } = await supabase
        .from("organizations")
        .select("id, drive_folder_id, name, slug, domain, mcp_enabled, openapi_spec_json, openapi_spec_url")
        .eq("id", profile.organization_id)
        .single();
      
      if (org?.drive_folder_id) {
        setRootFolderId(org.drive_folder_id);
      }
      if (org?.slug || org?.domain) {
        setOrganizationSlug(org.slug || org.domain);
      }
      
      // Set org-level API/MCP settings
      setOrgMcpEnabled((org as any)?.mcp_enabled ?? false);
      setOrgHasApiSpec(!!((org as any)?.openapi_spec_json || (org as any)?.openapi_spec_url));
      setOrganizationName(org?.name || "");
      
      // Onboarding is complete if the organization has a name set (not just the default domain)
      setNeedsOnboarding(false);
      
      // Get projects - only from user's own organization (not public projects from other orgs)
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, drive_folder_id, visibility, is_published, parent_id")
        .eq("organization_id", profile.organization_id)
        .order("name");

      if (projectsData) {
        setProjects(projectsData as Project[]);
        
        // Get topics for all projects
        const projectIds = projectsData.map(p => p.id);
        if (projectIds.length > 0) {
          const { data: topicsData } = await supabase
            .from("topics")
            .select("id, name, drive_folder_id, project_id, parent_id, display_order")
            .in("project_id", projectIds)
            .order("display_order");
          
          if (topicsData) {
            setTopics(topicsData as Topic[]);
          }
          
          // Get documents for all projects with owner info
          // Note: avoid fetching heavy HTML content for already-published pages (faster dashboard load)
          const { data: docsData } = await supabase
            .from("documents")
            .select(
              `
              id, title, google_doc_id, project_id, topic_id, google_modified_at, created_at, updated_at,
              visibility, is_published, owner_id,
              owner:profiles!documents_owner_id_fkey(full_name, email)
            `
            )
            .in("project_id", projectIds)
            .order("created_at", { ascending: false });

          if (docsData) {
            const baseDocs = docsData.map((doc: any) => ({
              ...doc,
              // default to null so the rest of the dashboard logic keeps working
              content_html: null,
              published_content_html: null,
              owner_name: doc.owner?.full_name || doc.owner?.email?.split("@")[0] || null,
            }));

            const unpublishedIds = baseDocs
              .filter((d: any) => !d.is_published)
              .map((d: any) => d.id);

            if (unpublishedIds.length > 0) {
              const { data: contentRows } = await supabase
                .from("documents")
                .select("id, content_html, published_content_html")
                .in("id", unpublishedIds);

              const contentById = new Map(
                (contentRows || []).map((r: any) => [r.id, r])
              );

              const merged = baseDocs.map((d: any) => ({
                ...d,
                ...(contentById.get(d.id) || {}),
              }));

              setDocuments(merged as Document[]);
            } else {
              setDocuments(baseDocs as Document[]);
            }
          }
        }
      }
    } else {
      // No organization - individual user needs onboarding to create one
      setNeedsOnboarding(true);
      setOrganizationId(null);
    }
    
    setIsLoading(false);
  };
  
  useEffect(() => {
    fetchData();
  }, [user]);
  
  // Reset visible pages when filters change
  useEffect(() => {
    setVisiblePagesCount(10);
  }, [selectedProject, selectedTopic, searchQuery]);

  // Filter documents based on selected project/topic and search query
  const filteredDocuments = documents.filter(doc => {
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
      return doc.project_id === selectedProject.id;
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
  
  const filteredTopics = topics.filter(t => 
    !searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Delete handlers with RBAC enforcement
  const handleDeleteProject = async (projectId: string, forceDelete = false): Promise<boolean> => {
    // RBAC check - only admins can delete projects
    if (!permissions.canDeleteProject) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to delete projects.",
        variant: "destructive",
      });
      await logUnauthorizedAttempt(
        "delete_project",
        "project",
        projectId,
        projectId,
        "canDeleteProject"
      );
      return false;
    }

    const project = projects.find((p) => p.id === projectId);

    const fail = (title: string, description: string) => {
      toast({ title, description, variant: "destructive" });
      return false;
    };

    // Trash the Drive folder if it exists - block deletion if it fails (unless force delete)
    if (project?.drive_folder_id && !forceDelete) {
      const trashResult = await trashFile(project.drive_folder_id);
      if (!trashResult.success) {
        if (trashResult.errorCode === "NOT_AUTHORIZED") {
          setForceDeleteAvailable(true);
          toast({
            title: "Cannot Delete from Drive",
            description:
              "This folder contains files not created by this app. Use 'Force Delete' to remove only from the app.",
            variant: "destructive",
          });
          return false;
        }

        return fail(
          "Cannot Delete Project",
          trashResult.error ||
            "Failed to trash the Drive folder. Please reconnect to Google Drive and try again."
        );
      }
    }

    // IMPORTANT: Projects have many related records with foreign keys.
    // We must delete/clear those first or the project delete will fail.

    // 1) Delete connector actions (FK to documents/connectors)
    {
      const { error } = await supabase
        .from("connector_actions")
        .delete()
        .eq("project_id", projectId);
      if (error) return fail("Error", `Failed to delete connector actions: ${error.message}`);
    }

    // 2) Delete page feedback for documents in this project (FK to documents)
    {
      const { data: docRows, error: docRowsError } = await supabase
        .from("documents")
        .select("id")
        .eq("project_id", projectId);
      if (docRowsError)
        return fail("Error", `Failed to load project documents: ${docRowsError.message}`);

      const docIds = (docRows || []).map((r: any) => r.id).filter(Boolean);
      if (docIds.length > 0) {
        const { error } = await supabase
          .from("page_feedback")
          .delete()
          .in("document_id", docIds);
        if (error) return fail("Error", `Failed to delete page feedback: ${error.message}`);
      }
    }

    // 3) Delete other project-linked rows
    {
      const { error } = await supabase
        .from("drive_permission_sync")
        .delete()
        .eq("project_id", projectId);
      if (error) return fail("Error", `Failed to delete Drive permission sync rows: ${error.message}`);
    }

    {
      const { error } = await supabase
        .from("import_jobs")
        .delete()
        .eq("project_id", projectId);
      if (error) return fail("Error", `Failed to delete import jobs: ${error.message}`);
    }

    {
      const { error } = await supabase
        .from("project_invitations")
        .delete()
        .eq("project_id", projectId);
      if (error) return fail("Error", `Failed to delete project invitations: ${error.message}`);
    }

    {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId);
      if (error) return fail("Error", `Failed to delete project members: ${error.message}`);
    }

    // 4) Clear nullable foreign keys (keep history)
    {
      const { error } = await supabase
        .from("audit_logs")
        .update({ project_id: null })
        .eq("project_id", projectId);
      if (error) return fail("Error", `Failed to detach audit logs: ${error.message}`);
    }

    {
      const { error } = await supabase
        .from("domains")
        .update({ project_id: null })
        .eq("project_id", projectId);
      if (error) return fail("Error", `Failed to detach domains: ${error.message}`);
    }

    // 5) Delete project connectors (and their related rows)
    {
      const { data: connectorRows, error: connectorRowsError } = await supabase
        .from("connectors")
        .select("id")
        .eq("project_id", projectId);

      if (connectorRowsError)
        return fail("Error", `Failed to load project connectors: ${connectorRowsError.message}`);

      const connectorIds = (connectorRows || []).map((r: any) => r.id).filter(Boolean);
      if (connectorIds.length > 0) {
        const { error: permsError } = await supabase
          .from("connector_permissions")
          .delete()
          .in("connector_id", connectorIds);
        if (permsError) return fail("Error", `Failed to delete connector permissions: ${permsError.message}`);

        const { error: credsError } = await supabase
          .from("connector_credentials")
          .delete()
          .in("connector_id", connectorIds);
        if (credsError) return fail("Error", `Failed to delete connector credentials: ${credsError.message}`);

        const { error: connectorsError } = await supabase
          .from("connectors")
          .delete()
          .in("id", connectorIds);
        if (connectorsError) return fail("Error", `Failed to delete connectors: ${connectorsError.message}`);
      }
    }

    // 6) Delete project content
    {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("project_id", projectId);
      if (error) return fail("Error", `Failed to delete project pages: ${error.message}`);
    }

    {
      const { error } = await supabase
        .from("topics")
        .delete()
        .eq("project_id", projectId);
      if (error) return fail("Error", `Failed to delete project topics: ${error.message}`);
    }

    // 6b) Delete slug history for project
    {
      const { error } = await supabase
        .from("slug_history")
        .delete()
        .eq("entity_type", "project")
        .eq("entity_id", projectId);
      if (error) console.warn("Failed to delete slug history:", error.message);
    }

    // 7) Delete the project
    {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) return fail("Error", `Failed to delete project: ${error.message}`);
    }

    await logAction("delete_project", "project", projectId, projectId, {
      projectName: project?.name,
      forceDelete,
    });

    toast({
      title: "Deleted",
      description: forceDelete
        ? "Project deleted from app (Drive files remain)."
        : "Project moved to Drive trash and deleted from app.",
    });

    if (selectedProject?.id === projectId) {
      setSelectedProject(null);
      setSelectedTopic(null);
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
    
    // Trash the Drive folder if it exists - block deletion if it fails (unless force delete)
    if (topic?.drive_folder_id && !forceDelete) {
      const trashResult = await trashFile(topic.drive_folder_id);
      if (!trashResult.success) {
        if (trashResult.errorCode === "NOT_AUTHORIZED") {
          setForceDeleteAvailable(true);
          toast({ 
            title: "Cannot Delete from Drive", 
            description: "This folder contains files not created by this app. Use 'Force Delete' to remove only from the app.", 
            variant: "destructive" 
          });
          return false;
        }
        toast({ 
          title: "Cannot Delete Topic", 
          description: trashResult.error || "Failed to trash the Drive folder. Please reconnect to Google Drive and try again.", 
          variant: "destructive" 
        });
        return false;
      }
    }
    
    // Delete all documents in the topic first
    await supabase.from("documents").delete().eq("topic_id", topicId);
    // Delete the topic
    const { error } = await supabase.from("topics").delete().eq("id", topicId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to delete topic.", variant: "destructive" });
      return false;
    } else {
      await logAction('delete_topic', 'topic', topicId, selectedProject?.id || '', { topicName: topic?.name, forceDelete });
      toast({ title: "Deleted", description: forceDelete ? "Topic deleted from app (Drive files remain)." : "Topic moved to Drive trash and deleted from app." });
      if (selectedTopic?.id === topicId) {
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
    
    // Get the document's google doc ID first
    const doc = filteredDocuments.find(d => d.id === docId);
    
    // Trash the Drive file if it exists - block deletion if it fails (unless force delete)
    if (doc?.google_doc_id && !forceDelete) {
      const trashResult = await trashFile(doc.google_doc_id);
      if (!trashResult.success) {
        if (trashResult.errorCode === "NOT_AUTHORIZED") {
          setForceDeleteAvailable(true);
          toast({ 
            title: "Cannot Delete from Drive", 
            description: "This file was not created by this app. Use 'Force Delete' to remove only from the app.", 
            variant: "destructive" 
          });
          return false;
        }
        toast({ 
          title: "Cannot Delete Page", 
          description: trashResult.error || "Failed to trash the Drive file. Please reconnect to Google Drive and try again.", 
          variant: "destructive" 
        });
        return false;
      }
    }
    
    const { error } = await supabase.from("documents").delete().eq("id", docId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to delete page.", variant: "destructive" });
      return false;
    } else {
      await logAction('delete_document', 'document', docId, selectedProject?.id || '', { documentTitle: doc?.title, forceDelete });
      toast({ title: "Deleted", description: forceDelete ? "Page deleted from app (Drive file remains)." : "Page moved to Drive trash and deleted from app." });
      fetchData();
      return true;
    }
  };
  
  const confirmDelete = async (forceDelete = false) => {
    if (!itemToDelete) return;
    
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
    
    // RBAC check - only editors and admins can publish/unpublish
    const requiredPermission = newState ? 'canPublish' : 'canUnpublish';
    if (newState && !permissions.canPublish) {
      toast({ title: "Permission Denied", description: "You don't have permission to publish pages.", variant: "destructive" });
      await logUnauthorizedAttempt('publish', 'document', docId, selectedProject?.id || '', 'canPublish');
      return;
    }
    if (!newState && !permissions.canUnpublish) {
      toast({ title: "Permission Denied", description: "You don't have permission to unpublish pages.", variant: "destructive" });
      await logUnauthorizedAttempt('unpublish', 'document', docId, selectedProject?.id || '', 'canUnpublish');
      return;
    }
    
    // Find the document to get its content_html for republishing
    const doc = documents.find(d => d.id === docId);
    
    const updateData: Record<string, any> = { is_published: newState };
    
    // If publishing, copy current content to published content
    if (newState && doc?.content_html) {
      updateData.published_content_html = doc.content_html;
    }
    
    const { error } = await supabase
      .from("documents")
      .update(updateData)
      .eq("id", docId);

    if (error) {
      toast({ title: "Error", description: "Failed to update publish state.", variant: "destructive" });
    } else {
      await logAction(newState ? 'publish' : 'unpublish', 'document', docId, selectedProject?.id || '', { 
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
        published_content_html: newState ? d.content_html : d.published_content_html 
      } : d));
    }
  };

  const handleRepublishPage = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    
    // RBAC check - only editors and admins can republish
    if (!permissions.canPublish) {
      toast({ title: "Permission Denied", description: "You don't have permission to publish pages.", variant: "destructive" });
      await logUnauthorizedAttempt('republish', 'document', docId, selectedProject?.id || '', 'canPublish');
      return;
    }
    
    const doc = documents.find(d => d.id === docId);
    if (!doc?.content_html) {
      toast({ title: "Error", description: "No content to publish.", variant: "destructive" });
      return;
    }
    
    const { error } = await supabase
      .from("documents")
      .update({ 
        is_published: true,
        published_content_html: doc.content_html 
      })
      .eq("id", docId);

    if (error) {
      toast({ title: "Error", description: "Failed to republish.", variant: "destructive" });
    } else {
      await logAction('republish', 'document', docId, selectedProject?.id || '', { documentTitle: doc?.title });
      toast({
        title: "Republished",
        description: "Changes are now live.",
      });
      setDocuments(prev => prev.map(d => d.id === docId ? { 
        ...d, 
        is_published: true,
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
    const docsToPublish = documents.filter(d => selectedDocIds.has(d.id) && d.content_html && !d.is_published);
    
    let successCount = 0;
    for (const doc of docsToPublish) {
      const { error } = await supabase
        .from("documents")
        .update({ 
          is_published: true,
          published_content_html: doc.content_html 
        })
        .eq("id", doc.id);
      
      if (!error) {
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
      toast({ title: "No pages published", description: "Selected pages are already published or have no content.", variant: "destructive" });
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
      const { error } = await supabase
        .from("documents")
        .update({ is_published: false })
        .eq("id", doc.id);
      
      if (!error) {
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
      const { data, error } = await supabase.functions.invoke('normalize-structure', {
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

  // Connect to Google Drive (request access)
  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    try {
      await requestDriveAccess();
    } catch (error) {
      console.error("Failed to connect Drive:", error);
      toast({
        title: "Failed to connect",
        description: "Could not connect to Google Drive. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnectingDrive(false);
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
      // List all items in root folder
      const rootResult = await listFolder(rootFolderId);
      
      // Check if we need Drive access
      if (rootResult.needsDriveAccess) {
        setNeedsDriveAccess(true);
        setIsSyncing(false);
        toast({
          title: "Drive access required",
          description: "Click 'Connect Google Drive' to grant access.",
        });
        return;
      }
      
      setNeedsDriveAccess(false);
      
      if (!rootResult.files) {
        throw new Error("Failed to access Google Drive.");
      }

      // Filter for folders (projects)
      const folderMimeType = "application/vnd.google-apps.folder";
      const projectFolders = rootResult.files.filter(item => item.mimeType === folderMimeType);
      
      let syncedProjects = 0;
      let syncedDocs = 0;

      for (const folder of projectFolders) {
        // Check if project already exists
        const { data: existingProject } = await supabase
          .from("projects")
          .select("id")
          .eq("drive_folder_id", folder.id)
          .maybeSingle();

        let projectId: string;

        if (existingProject) {
          projectId = existingProject.id;
        } else {
          // Create new project
          const { data: newProject, error: projectError } = await supabase
            .from("projects")
            .insert({
              name: folder.name,
              drive_folder_id: folder.id,
              organization_id: organizationId,
              created_by: user.id,
              is_connected: true,
            })
            .select("id")
            .single();

          if (projectError) {
            console.error("Error creating project:", projectError);
            continue;
          }
          
          projectId = newProject.id;
          syncedProjects++;
        }

        // List items in this project folder (topics = subfolders, docs = pages)
        const projectResult = await listFolder(folder.id);
        
        if (projectResult.needsDriveAccess) {
          toast({
            title: "Drive access required",
            description: "Please grant Google Drive access to sync your folders.",
          });
          await requestDriveAccess();
          return;
        }
        
        let syncedTopics = 0;
        
        if (projectResult.files) {
          const folderMimeType = "application/vnd.google-apps.folder";
          const docMimeType = "application/vnd.google-apps.document";
          
          // Sync topic folders within the project
          const topicFolders = projectResult.files.filter(item => item.mimeType === folderMimeType);
          
          for (const topicFolder of topicFolders) {
            // Check if topic already exists
            const { data: existingTopic } = await supabase
              .from("topics")
              .select("id")
              .eq("drive_folder_id", topicFolder.id)
              .maybeSingle();

            let topicId: string;

            if (existingTopic) {
              topicId = existingTopic.id;
            } else {
              // Create new topic
              const { data: newTopic, error: topicError } = await supabase
                .from("topics")
                .insert({
                  name: topicFolder.name,
                  drive_folder_id: topicFolder.id,
                  project_id: projectId,
                })
                .select("id")
                .single();

              if (topicError) {
                console.error("Error creating topic:", topicError);
                continue;
              }
              
              topicId = newTopic.id;
              syncedTopics++;
            }
            
            // List docs within this topic folder
            const topicResult = await listFolder(topicFolder.id);
            
            if (topicResult.files) {
              const docs = topicResult.files.filter(item => item.mimeType === docMimeType);
              
              for (const doc of docs) {
                // Check if document already exists
                const { data: existingDoc } = await supabase
                  .from("documents")
                  .select("id")
                  .eq("google_doc_id", doc.id)
                  .maybeSingle();

                if (existingDoc) {
                  // Update existing document's title and modified time (NOT is_published!)
                  await supabase
                    .from("documents")
                    .update({
                      title: doc.name,
                      google_modified_at: doc.modifiedTime,
                    })
                    .eq("id", existingDoc.id);
                } else {
                  // Create new document with topic_id - set current user as owner
                  const { error: docError } = await supabase
                    .from("documents")
                    .insert({
                      title: doc.name,
                      google_doc_id: doc.id,
                      project_id: projectId,
                      topic_id: topicId,
                      google_modified_at: doc.modifiedTime,
                      owner_id: user.id,
                    });

                  if (!docError) {
                    syncedDocs++;
                  }
                }
              }
            }
          }
        }
      }

      toast({
        title: "Sync complete",
        description: `Synced ${syncedProjects} new projects and ${syncedDocs} new documents.`,
      });

      // Refresh the projects list
      fetchData();
      
    } catch (error: any) {
      console.error("Sync error:", error);
      
      // Check if it's a scope/permission error
      const errorMessage = error.message || "";
      if (errorMessage.includes("insufficient") || errorMessage.includes("scope") || errorMessage.includes("re-authenticate")) {
        toast({
          title: "Drive access required",
          description: "Please grant Google Drive access to sync your folders.",
        });
        // Request Drive access
        await requestDriveAccess();
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
            <span className="text-2xl font-semibold text-foreground">Acceldocs</span>
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
  if (selectedPage) {
    return <PageView onBack={() => setSelectedPage(null)} />;
  }

  // Get root projects (no parent) and their children
  const rootProjects = filteredProjects.filter(p => !p.parent_id);
  const getSubProjects = (parentId: string) => filteredProjects.filter(p => p.parent_id === parentId);

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background flex w-full">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setMobileSidebarOpen(false)} 
        />
      )}
      
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-background border-b border-border flex items-center justify-between px-3 z-30 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-sm truncate">Acceldocs</span>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <X className="h-5 w-5 opacity-0" /> {/* Invisible spacer for balance */}
        </Button>
      </div>
      
      {/* Sidebar */}
      <aside className={cn(
        "border-r border-border flex flex-col transition-all duration-300 bg-background z-50",
        sidebarCollapsed ? 'w-16' : 'w-64',
        // Mobile: fixed position, slides in from left
        "fixed inset-y-0 left-0 lg:relative",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo, Workspace, Notifications & Collapse Toggle */}
        <div className={`border-b border-border ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
          {sidebarCollapsed ? (
            /* Collapsed: Stack items vertically */
            <div className="flex flex-col items-center gap-2">
              {/* Logo */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-6 cursor-pointer">
                    <img src={acceldataLogo} alt="Acceldocs" className="h-full" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-semibold">Acceldocs</p>
                </TooltipContent>
              </Tooltip>

              {/* Expand button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-foreground"
                    onClick={() => setSidebarCollapsed(false)}
                  >
                    <PanelLeft className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            /* Expanded: Horizontal layout */
            <>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-foreground">Acceldocs</span>

                <div className="flex items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setSidebarCollapsed(true)}
                      >
                        <PanelLeftClose className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Collapse sidebar</TooltipContent>
                  </Tooltip>
                </div>
              </div>

            </>
          )}
        </div>

        {/* Project Switcher */}
        {!sidebarCollapsed && (
          <div className="px-3 py-2 border-b border-border">
            <ProjectSwitcher
              projects={projects}
              selectedProject={selectedProject}
              organizationSlug={organizationSlug}
              onSelectProject={(project) => {
                setSelectedProject(project);
                setSelectedTopic(null);
                setShowAPISettings(false);
                setShowMCPSettings(false);
                setShowIntegrations(false);
                setShowGeneralSettings(false);
                setMobileSidebarOpen(false);
              }}
              onCreateProject={() => setAddProjectOpen(true)}
            />
          </div>
        )}

        {/* Navigation items for selected project */}
        {!sidebarCollapsed && selectedProject && (
          <div className="px-2 py-2 border-b border-border space-y-1">
            {/* Dashboard / Overview */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer relative",
                !selectedTopic && !showAPISettings && !showMCPSettings && !showIntegrations
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
              onClick={() => {
                setSelectedTopic(null);
                setShowAPISettings(false);
                setShowMCPSettings(false);
                setShowIntegrations(false);
                setShowGeneralSettings(false);
              }}
            >
              {!selectedTopic && !showAPISettings && !showMCPSettings && !showIntegrations && (
                <span className="absolute left-0 w-0.5 h-6 bg-primary rounded-r" />
              )}
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </div>

            {/* Documentation section */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer relative",
                selectedTopic ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
              onClick={() => {
                // Show first topic or just indicate documentation view
                const projectTopics = topics.filter(t => t.project_id === selectedProject.id && !t.parent_id);
                if (projectTopics.length > 0) {
                  setSelectedTopic(projectTopics[0]);
                }
                setShowAPISettings(false);
                setShowMCPSettings(false);
                setShowIntegrations(false);
                setShowGeneralSettings(false);
              }}
            >
              {selectedTopic && (
                <span className="absolute left-0 w-0.5 h-6 bg-primary rounded-r" />
              )}
              <BookOpen className="w-4 h-4" />
              <span>Documentation</span>
              {selectedProject.is_published && (
                <span className="w-2 h-2 rounded-full bg-green-500 ml-auto" />
              )}
            </div>

            {/* Project Settings */}
            {permissions.canEditProjectSettings && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                onClick={() => setProjectSettingsOpen(true)}
              >
                <Settings className="w-4 h-4" />
                <span>Project Settings</span>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        {sidebarCollapsed ? (
          <div className="p-2 border-b border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-10"
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <Search className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Search docs</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="p-4">
            <SmartSearch
              placeholder="Search docs..."
              documents={documents.filter(d => !selectedProject || d.project_id === selectedProject.id).map(d => ({
                id: d.id,
                title: d.title,
                project_id: d.project_id,
                topic_id: d.topic_id,
                content_html: d.content_html,
              }))}
              topics={topics.filter(t => !selectedProject || t.project_id === selectedProject.id).map(t => ({
                id: t.id,
                name: t.name,
                project_id: t.project_id,
              }))}
              projects={projects.map(p => ({
                id: p.id,
                name: p.name,
              }))}
              showAIButton={false}
              onSearch={setSearchQuery}
              onSelect={(result) => {
                if (result.type === "project") {
                  const project = projects.find(p => p.id === result.id);
                  if (project) {
                    setSelectedProject(project);
                    setSelectedTopic(null);
                    setExpandedProjects(prev => new Set([...prev, project.id]));
                  }
                } else if (result.type === "topic") {
                  const topic = topics.find(t => t.id === result.id);
                  if (topic) {
                    const project = projects.find(p => p.id === topic.project_id);
                    if (project) {
                      setSelectedProject(project);
                      setSelectedTopic(topic);
                      setExpandedProjects(prev => new Set([...prev, project.id]));
                    }
                  }
                } else if (result.type === "page") {
                  navigate(`/page/${result.id}`);
                }
              }}
            />
          </div>
        )}

        {/* Topics for Selected Project */}
        <div className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'px-1' : 'px-2'}`}>
          {sidebarCollapsed ? (
            /* Collapsed: Show project switcher and some navigation */
            <div className="py-2 space-y-1">
              <ProjectSwitcher
                projects={projects}
                selectedProject={selectedProject}
                organizationSlug={organizationSlug}
                collapsed
                onSelectProject={(project) => {
                  setSelectedProject(project);
                  setSelectedTopic(null);
                  setShowAPISettings(false);
                  setShowMCPSettings(false);
                  setShowIntegrations(false);
                  setShowGeneralSettings(false);
                }}
                onCreateProject={() => setAddProjectOpen(true)}
              />
              
              {filteredProjects.slice(0, 5).map((project) => (
                <Tooltip key={project.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`w-full h-10 ${
                        selectedProject?.id === project.id
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => {
                        setSelectedProject(project);
                        setShowAPISettings(false);
                        setShowMCPSettings(false);
                        setShowIntegrations(false);
                        setExpandedProjects(prev => new Set([...prev, project.id]));
                      }}
                    >
                      <FolderTree className="w-4 h-4" />
                      {selectedProject?.id === project.id && (
                        <span className="absolute left-0 w-0.5 h-6 bg-primary rounded-r" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {project.is_published ? 'Published' : 'Draft'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : selectedProject ? (
            /* Expanded: Show topics tree for selected project */
            <>
              {/* Connect Drive Banner */}
              {needsDriveAccess && rootFolderId && (
                <div className="mx-2 mb-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-2">
                    Connect Google Drive to sync your folders
                  </p>
                  <Button
                    size="sm"
                    onClick={handleConnectDrive}
                    disabled={isConnectingDrive}
                    className="w-full"
                  >
                    {isConnectingDrive ? "Connecting..." : "Connect Google Drive"}
                  </Button>
                </div>
              )}

              {/* Topics header */}
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Topics
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={handleSyncFromDrive}
                    disabled={isSyncing || !rootFolderId}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    title="Sync from Google Drive"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setAddTopicOpen(true);
                    }}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Topics list */}
              <div className="space-y-1">
                <SidebarTopicsTree
                  topics={filteredTopics.filter(t => t.project_id === selectedProject.id)}
                  selectedTopic={selectedTopic}
                  onSelectTopic={(topic) => {
                    setSelectedTopic(topic);
                    setMobileSidebarOpen(false);
                  }}
                  onAddPage={(topic) => {
                    setSelectedTopic(topic);
                    setAddPageOpen(true);
                  }}
                  onAddSubtopic={(topic) => {
                    setParentTopicForCreate(topic);
                    setAddTopicOpen(true);
                  }}
                  onOpenSettings={(topic) => {
                    setSettingsTopic(topic);
                    setTopicSettingsOpen(true);
                  }}
                  onDeleteTopic={(topic) => {
                    setItemToDelete({ type: 'topic', id: topic.id, name: topic.name });
                    setDeleteDialogOpen(true);
                  }}
                  onTopicsReordered={fetchData}
                />
              </div>
            </>
          ) : (
            /* No project selected - prompt to select one */
            <div className="px-3 py-6 text-center">
              <FolderTree className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Select a project to view its topics
              </p>
            </div>
          )}

          {/* Developer Resources - API/MCP */}
          <div className={`mt-4 pt-4 border-t border-border ${sidebarCollapsed ? 'py-2' : ''}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Developer Resources
                </span>
              </div>
            )}
            <div className="space-y-1">
              {sidebarCollapsed ? (
                /* Collapsed: Icon buttons with tooltips */
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`w-full h-10 relative ${
                          showAPISettings
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => {
                          setShowAPISettings(true);
                          setShowMCPSettings(false);
                          setShowIntegrations(false);
                          setShowGeneralSettings(false);
                          setSelectedProject(null);
                          setSelectedTopic(null);
                        }}
                      >
                        <Code className="w-4 h-4" />
                        {showAPISettings && (
                          <span className="absolute left-0 w-0.5 h-6 bg-primary rounded-r" />
                        )}
                        {orgHasApiSpec && (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-medium">API Reference</p>
                      {orgHasApiSpec && <p className="text-xs text-green-400">Published</p>}
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`w-full h-10 relative ${
                          showMCPSettings
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => {
                          setShowMCPSettings(true);
                          setShowAPISettings(false);
                          setShowIntegrations(false);
                          setShowGeneralSettings(false);
                          setSelectedProject(null);
                          setSelectedTopic(null);
                        }}
                      >
                        <FileJson className="w-4 h-4" />
                        {showMCPSettings && (
                          <span className="absolute left-0 w-0.5 h-6 bg-primary rounded-r" />
                        )}
                        {orgMcpEnabled && (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-medium">MCP Protocol</p>
                      {orgMcpEnabled && <p className="text-xs text-green-400">Enabled</p>}
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`w-full h-10 relative ${
                          showIntegrations
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => {
                          setShowIntegrations(true);
                          setShowMCPSettings(false);
                          setShowAPISettings(false);
                          setShowGeneralSettings(false);
                          setSelectedTopic(null);
                        }}
                      >
                        <Plug2 className="w-4 h-4" />
                        {showIntegrations && (
                          <span className="absolute left-0 w-0.5 h-6 bg-primary rounded-r" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Integrations</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                /* Expanded: Full navigation items */
                <>
                  <div
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer relative ${
                      showAPISettings
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                    onClick={() => {
                      setShowAPISettings(true);
                      setShowMCPSettings(false);
                      setShowIntegrations(false);
                      setShowGeneralSettings(false);
                      setSelectedProject(null);
                      setSelectedTopic(null);
                    }}
                  >
                    {showAPISettings && (
                      <span className="absolute left-0 w-0.5 h-6 bg-primary rounded-r" />
                    )}
                    <Code className="w-4 h-4" />
                    <span className="flex-1 text-left">API Reference</span>
                    {orgHasApiSpec && (
                      <span className="w-2 h-2 rounded-full bg-green-500" title="Published" />
                    )}
                  </div>
                  <div
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer relative ${
                      showMCPSettings
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                    onClick={() => {
                      setShowMCPSettings(true);
                      setShowAPISettings(false);
                      setShowIntegrations(false);
                      setShowGeneralSettings(false);
                      setSelectedProject(null);
                      setSelectedTopic(null);
                    }}
                  >
                    {showMCPSettings && (
                      <span className="absolute left-0 w-0.5 h-6 bg-primary rounded-r" />
                    )}
                    <FileJson className="w-4 h-4" />
                    <span className="flex-1 text-left">MCP Protocol</span>
                    {orgMcpEnabled && (
                      <span className="w-2 h-2 rounded-full bg-green-500" title="Published" />
                    )}
                  </div>
                  <div
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer relative ${
                      showIntegrations
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                    onClick={() => {
                      setShowIntegrations(true);
                      setShowMCPSettings(false);
                      setShowAPISettings(false);
                      setShowGeneralSettings(false);
                      setSelectedTopic(null);
                    }}
                  >
                    {showIntegrations && (
                      <span className="absolute left-0 w-0.5 h-6 bg-primary rounded-r" />
                    )}
                    <Plug2 className="w-4 h-4" />
                    <span className="flex-1 text-left">Integrations</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* User Section */}
        <div className={`border-t border-border ${sidebarCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-4'}`}>
          {sidebarCollapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className={`w-full h-10 relative ${
                      showGeneralSettings
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setShowGeneralSettings(true)}
                  >
                    <Settings className="w-4 h-4" />
                    {showGeneralSettings && (
                      <span className="absolute left-0 w-0.5 h-6 bg-primary rounded-r" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors">
                    <span className="text-sm font-medium text-primary">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{user?.email?.split("@")[0]}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full h-10 text-muted-foreground hover:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.email?.split("@")[0]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex-1 justify-start gap-2"
                  onClick={() => setShowGeneralSettings(true)}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </aside>

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
        <main className="flex-1 flex flex-col pt-14 lg:pt-0 min-w-0">
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
              {selectedTopic && (
                <>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 hidden sm:block" />
                  <span className="text-muted-foreground text-sm truncate hidden sm:block">{selectedTopic.name}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <DriveStatusIndicator onStatusChange={(connected) => setNeedsDriveAccess(!connected)} />
              {organizationId && <NotificationCenter organizationId={organizationId} onWorkspaceChange={() => window.location.reload()} />}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 px-2 sm:px-3"
                onClick={() => setInviteMemberOpen(true)}
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Invite</span>
              </Button>
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1.5 h-8 px-2 sm:px-3 hidden sm:flex" 
                  onClick={() => window.open(`/docs/${organizationSlug}`, '_blank')}
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden lg:inline">View Docs</span>
                </Button>
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
                onClick={switchToApprovedWorkspace}
                className="gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                Switch Workspace
              </Button>
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

          {/* Topics */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-semibold shrink-0">Topics</h2>
                {selectedTopic && (
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
                      while (current) {
                        path.unshift(current);
                        current = topics.find(t => t.id === current?.parent_id);
                      }
                      return path.map((topic, idx) => (
                        <span key={topic.id} className="flex items-center">
                          <ChevronRight className="w-4 h-4" />
                          <button 
                            onClick={() => setSelectedTopic(topic)}
                            className={idx === path.length - 1 ? "text-foreground font-medium" : "hover:text-foreground transition-colors"}
                          >
                            {topic.name}
                          </button>
                        </span>
                      ));
                    })()}
                  </div>
                )}
              </div>
              <button 
                onClick={() => setAddTopicOpen(true)}
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
                topics={topics.filter(t => t.project_id === selectedProject.id)}
                allTopics={topics.filter(t => t.project_id === selectedProject.id)}
                selectedTopic={selectedTopic}
                onSelectTopic={(topic) => setSelectedTopic(topic)}
                documents={documents}
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
                          onClick={() => navigate(`/page/${doc.id}`)}
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
                                  {doc.title}
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
                                        setSelectedDocument(doc);
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
            currentProject={selectedProject ? { id: selectedProject.id, name: selectedProject.name } : null}
            currentTopic={selectedTopic ? { id: selectedTopic.id, name: selectedTopic.name } : null}
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
      />
      
      <AddPageDialog
        open={addPageOpen}
        onOpenChange={setAddPageOpen}
        projectId={selectedProject?.id}
        projectName={selectedProject?.name}
        topicId={selectedTopic?.id}
        topicName={selectedTopic?.name}
        parentFolderId={selectedTopic?.drive_folder_id || null}
        onCreated={() => fetchData()}
      />
      
      <AddProjectDialog
        open={addProjectOpen}
        onOpenChange={(open) => {
          setAddProjectOpen(open);
          if (!open) setParentProjectForCreate(null);
        }}
        rootFolderId={rootFolderId}
        organizationId={organizationId || undefined}
        parentProjectId={parentProjectForCreate?.id}
        parentProjectName={parentProjectForCreate?.name}
        onCreated={(folder) => {
          fetchData();
          setParentProjectForCreate(null);
        }}
      />
      
      <AddTopicDialog
        open={addTopicOpen}
        onOpenChange={(open) => {
          setAddTopicOpen(open);
          if (!open) setParentTopicForCreate(null);
        }}
        projectName={selectedProject?.name || null}
        projectId={selectedProject?.id || null}
        projectFolderId={selectedProject?.drive_folder_id || null}
        parentTopic={parentTopicForCreate ? {
          id: parentTopicForCreate.id,
          name: parentTopicForCreate.name,
          drive_folder_id: parentTopicForCreate.drive_folder_id,
        } : null}
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
      
      <PageSettingsDialog
        open={pageSettingsOpen}
        onOpenChange={setPageSettingsOpen}
        documentId={selectedDocument?.id || null}
        documentTitle={selectedDocument?.title || null}
        projectId={selectedDocument?.project_id || null}
        googleDocId={selectedDocument?.google_doc_id || null}
        onUpdate={() => fetchData()}
        onDelete={handleDeleteDocument}
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
      
      {/* Audit Log Panel - Admin only */}
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
      
      {/* Global Import Progress Indicator */}
      {organizationId && (
        <GlobalImportProgress 
          organizationId={organizationId} 
          onComplete={() => fetchData()} 
        />
      )}
    </div>
    </TooltipProvider>
  );
};

export default Dashboard;
