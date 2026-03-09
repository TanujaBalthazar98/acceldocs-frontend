import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileText,
  Plus,
  ChevronRight,
  Folder,
  User,
  Clock,
  Circle,
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
  Upload,
  Bot,
  ArrowRight,
  UserPlus,
  CheckSquare,
  Square,
  XCircle,
  X,
  Loader2,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { DashboardLoading } from "@/components/dashboard/DashboardLoading";
import { TopicsSection } from "@/components/dashboard/TopicsSection";
import { AuditLogPanel } from "@/components/dashboard/AuditLogPanel";
import { DocAssistantChat } from "@/components/dashboard/DocAssistantChat";
import { NotificationCenter } from "@/components/dashboard/NotificationCenter";
import { DriveStatusIndicator } from "@/components/dashboard/DriveStatusIndicator";
import { DriveReauthListener } from "@/components/dashboard/DriveReauthListener";
import { DRIVE_INTEGRATION_ENABLED } from "@/lib/featureFlags";
import { InviteMemberDialog } from "@/components/dashboard/InviteMemberDialog";
import { AssignProjectDialog } from "@/components/dashboard/AssignProjectDialog";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDriveSync } from "@/hooks/useDriveSync";
import { useDashboardActions } from "@/hooks/useDashboardActions";
import { apiFetch } from "@/lib/api/client";

import { Project, ProjectVersion, Topic, Document, VisibilityLevel } from "@/types/dashboard";
import { mapDocumentFromStrapi } from "@/lib/dataMappers";

const visibilityConfig: Record<VisibilityLevel, { icon: typeof Lock; label: string; color: string }> = {
  internal: { icon: Lock, label: "Internal", color: "text-muted-foreground" },
  external: { icon: Eye, label: "External", color: "text-blue-400" },
  public: { icon: Globe, label: "Public", color: "text-green-400" },
};

const Dashboard = () => {
  const automationDocsBase =
    (import.meta.env.VITE_AUTOMATION_DOCS_URL as string | undefined)?.replace(/\/$/, "") ||
    null;
  const automationPublicDocsBase =
    (import.meta.env.VITE_AUTOMATION_PUBLIC_DOCS_URL as string | undefined)?.replace(/\/$/, "") ||
    automationDocsBase;
  const automationInternalDocsBase =
    (import.meta.env.VITE_AUTOMATION_INTERNAL_DOCS_URL as string | undefined)?.replace(/\/$/, "") ||
    null;
  const data = useDashboardData();
  const {
    user,
    signOut,
    googleAccessToken,
    navigate,
    location,
    toast,
    projects,
    setProjects,
    projectVersions,
    setProjectVersions,
    topics,
    documents,
    setDocuments,
    selectedProject,
    setSelectedProject,
    selectedVersion,
    setSelectedVersion,
    selectedTopic,
    setSelectedTopic,
    selectedDocument,
    setSelectedDocument,
    selectedPage,
    setSelectedPage,
    expandedProjects,
    setExpandedProjects,
    organizationId,
    organizationSlug,
    organizationName,
    appRole,
    rootFolderId,
    setRootFolderId,
    isLoading,
    needsOnboarding,
    setNeedsOnboarding,
    needsDriveAccess,
    setNeedsDriveAccess,
    searchQuery,
    setSearchQuery,
    visiblePagesCount,
    setVisiblePagesCount,
    subProjectsExpanded,
    setSubProjectsExpanded,
    topicsExpanded,
    setTopicsExpanded,
    permissions,
    isOrgOwner,
    approvedOrgId,
    approvedOrgName,
    switchToApprovedWorkspace,
    projectStepDone,
    canCreateProject,
    canProjectCreateRole,
    scopedDocuments,
    scopedTopics,
    unassignedDocuments,
    filteredDocuments,
    visibleDocuments,
    hasMorePages,
    filteredProjects,
    filteredTopics,
    selectedProjectVersions,
    resolveDefaultVersion,
    canPublishForProject,
    buildProjectOptions,
    getAssignableTopics,
    ensureDefaultVersionForProject,
    fetchData,
    logAction,
    logUnauthorizedAttempt,
  } = data;

  const driveSync = useDriveSync({
    rootFolderId,
    organizationId,
    organizationName,
    appRole,
    projects,
    projectVersions,
    topics,
    toast,
    setNeedsDriveAccess,
    fetchData,
    resolveDefaultVersion,
    ensureDefaultVersionForProject,
  });

  const actions = useDashboardActions({
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
    trashFile: driveSync.trashFile,
    resolveDefaultVersion,
    getAssignableTopics,
    ensureDefaultVersionForProject,
    navigate,
    signOut,
  });

  // Dialog state
  const [shareOpen, setShareOpen] = useState(false);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [importMarkdownOpen, setImportMarkdownOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [discoveryProjectId, setDiscoveryProjectId] = useState<string | null>(null);
  const [discoveryVersionId, setDiscoveryVersionId] = useState<string | null>(null);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [pageSettingsTarget, setPageSettingsTarget] = useState<Pick<Document, "id" | "title" | "project_id" | "google_doc_id"> | null>(null);
  const [topicSettingsOpen, setTopicSettingsOpen] = useState(false);
  const [settingsTopic, setSettingsTopic] = useState<Topic | null>(null);
  const [showGeneralSettings, setShowGeneralSettings] = useState(false);
  // API, MCP, Integrations panels removed — not part of Google Docs + MkDocs + Git architecture
  const [showAPISettings, setShowAPISettings] = useState(false);
  const [showMCPSettings, setShowMCPSettings] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [inviteMemberOpen, setInviteMemberOpen] = useState(false);
  const [parentProjectForCreate, setParentProjectForCreate] = useState<Project | null>(null);
  const [parentTopicForCreate, setParentTopicForCreate] = useState<Topic | null>(null);
  const [githubInfo, setGithubInfo] = useState<{ connected: boolean; pagesUrl?: string | null } | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    apiFetch<{ ok: boolean; connected: boolean; pagesUrl?: string }>(
      `/api/github/settings/${organizationId}`
    ).then(({ data }) => {
      if (data?.ok) {
        setGithubInfo({ connected: data.connected, pagesUrl: data.pagesUrl });
      }
    }).catch(() => {/* silently ignore */});
  }, [organizationId]);

  // Deep-link handling
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  useEffect(() => {
    if (deepLinkHandled) return;
    const params = new URLSearchParams(location.search);
    const wantsIntegrations = params.get("integrations") === "1";
    const requestedProjectId = params.get("project");
    if (!wantsIntegrations) {
      setDeepLinkHandled(true);
      return;
    }
    setShowIntegrations(true);
    setShowMCPSettings(false);
    setShowAPISettings(false);
    setShowGeneralSettings(false);
    if (requestedProjectId) {
      if (projects.length === 0) return;
      const project = projects.find((p) => p.id === requestedProjectId) || null;
      if (project) {
        setSelectedProject(project);
        setSelectedTopic(null);
        setExpandedProjects((prev) => new Set([...prev, project.id]));
      }
    }
    navigate("/dashboard", { replace: true });
    setDeepLinkHandled(true);
  }, [deepLinkHandled, location.search, navigate, projects]);

  const handleConnectDrive = async () => {
    setShowGeneralSettings(true);
  };

  const createProjectDisabledTitle = !canProjectCreateRole
    ? "You must be an owner, admin, or editor to create a project"
    : "Create your first project";
  const showGettingStarted = !!organizationId && !projectStepDone;

  // Assign project helpers
  const assignProjectOptions = buildProjectOptions();
  const assignProjectVersionId = actions.assignProjectId
    ? resolveDefaultVersion(actions.assignProjectId)?.id ?? null
    : null;
  const assignableTopics = getAssignableTopics(actions.assignProjectId || null, assignProjectVersionId);

  // Loading state
  if (isLoading) {
    return <DashboardLoading />;
  }

  // Onboarding
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

  // General settings
  if (showGeneralSettings) {
    return (
      <GeneralSettings
        onBack={() => {
          setShowGeneralSettings(false);
          fetchData();
        }}
      />
    );
  }

  // Page view
  if (selectedPage && selectedDocument) {
    return (
      <PageView
        document={selectedDocument}
        onBack={() => {
          setSelectedPage(null);
          setSelectedDocument(null);
        }}
        onDocumentUpdate={actions.handleDocumentUpdate}
        userRole={appRole || "viewer"}
      />
    );
  }

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
          isSyncing={driveSync.isSyncing}
          handleConnectDrive={handleConnectDrive}
          handleSyncFromDrive={driveSync.handleSyncFromDrive}
          setAddProjectOpen={setAddProjectOpen}
          setAddTopicOpen={setAddTopicOpen}
          setParentTopicForCreate={setParentTopicForCreate}
          setAddPageOpen={setAddPageOpen}
          onUploadFile={driveSync.handleUploadFile}
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
          setDeleteDialogOpen={actions.setDeleteDialogOpen}
          setItemToDelete={actions.setItemToDelete}
          setSearchQuery={setSearchQuery}
          signOut={signOut}
          permissions={{
            canCreateProject: canCreateProject,
            canDeleteProject: permissions.canDeleteProject,
            canManageTeam: permissions.canInviteMembers || permissions.canManageMembers || false,
            canViewAuditLogs: permissions.canViewAuditLogs,
            canEditProject: permissions.canEditProjectSettings || permissions.canEdit || false,
          }}
          navigate={navigate}
          fetchData={fetchData}
          currentPath={location.pathname}
        />

        {/* Main Content */}
        {(
          <main
            className={cn(
              "flex-1 flex flex-col pt-14 lg:pt-0 min-w-0 transition-all duration-300",
              sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
            )}
          >
            {/* Header */}
            <header className="h-auto min-h-14 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 py-2 sm:px-4 lg:px-6 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-medium text-foreground text-sm truncate">
                  {organizationName || "Workspace"}
                </span>
                {selectedProject && (
                  <>
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-sm truncate">{selectedProject?.name}</span>
                  </>
                )}
                {selectedTopic?.name && (
                  <>
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 hidden sm:block" />
                    <span className="text-muted-foreground text-sm truncate hidden sm:block">
                      {selectedTopic.name}
                    </span>
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
                    onClick={driveSync.handleSyncFromDrive}
                    disabled={driveSync.isSyncing}
                  >
                    <RefreshCw className={`w-4 h-4 ${driveSync.isSyncing ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{driveSync.isSyncing ? "Syncing..." : "Sync Drive"}</span>
                  </Button>
                )}
                {organizationId && (
                  <NotificationCenter organizationId={organizationId} onWorkspaceChange={() => fetchData()} />
                )}
                {(isOrgOwner || appRole === "admin") && (
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
                    {/* Internal docs viewer */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 px-2 sm:px-3"
                      onClick={() => window.open(`/internal/${organizationSlug}`, "_blank")}
                      title="Open the internal docs viewer"
                    >
                      <Lock className="w-4 h-4" />
                      <span className="hidden lg:inline">Docs</span>
                    </Button>
                    {/* Published public site — only shown once GitHub Pages is live */}
                    {githubInfo?.pagesUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 px-2 sm:px-3"
                        onClick={() => window.open(githubInfo.pagesUrl!, "_blank")}
                        title="Open the public site on GitHub Pages"
                      >
                        <Globe className="w-4 h-4" />
                        <span className="hidden lg:inline">Published Site</span>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </Button>
                    )}
                    {/* Share — for external projects, lets org members invite guests */}
                    {selectedProject?.visibility === "external" && (isOrgOwner || appRole === "admin" || appRole === "editor") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 px-2 sm:px-3"
                        onClick={() => setShareOpen(true)}
                        title="Invite external users to this project"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span className="hidden lg:inline">Share</span>
                      </Button>
                    )}
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
              <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto overflow-x-hidden">
                {/* Workspace switch banner */}
                {approvedOrgId && (
                  <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          You've been approved to join {approvedOrgName}!
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Switch to your team's workspace to collaborate with your colleagues.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="hero"
                      size="sm"
                      onClick={async () => {
                        const switched = await switchToApprovedWorkspace();
                        if (switched) await fetchData();
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
                      <Badge variant="secondary" className="w-fit">
                        Setup
                      </Badge>
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
                          <Badge variant="secondary" className="w-fit">
                            Ready
                          </Badge>
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
                        <Badge variant="secondary" className="w-fit">
                          Ready
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Stats */}
                {(() => {
                  const publishedCount = filteredDocuments.filter((d) => d.is_published).length;
                  const draftCount = filteredDocuments.filter(
                    (d) => !d.is_published && !d.published_content_html
                  ).length;
                  const pendingRepublishCount = filteredDocuments.filter(
                    (d) =>
                      d.is_published &&
                      d.content_html &&
                      d.published_content_html &&
                      d.content_html !== d.published_content_html
                  ).length;

                  const sevenDaysAgo = new Date();
                  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                  const recentlyUpdated = filteredDocuments.filter((d) => {
                    if (!d.google_modified_at) return false;
                    return new Date(d.google_modified_at) > sevenDaysAgo;
                  }).length;

                  const readyToPublish = filteredDocuments.filter(
                    (d) => !d.is_published && d.content_html
                  ).length;

                  const publishRate =
                    filteredDocuments.length > 0
                      ? Math.round((publishedCount / filteredDocuments.length) * 100)
                      : 0;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
                      <div className="p-3 sm:p-4 rounded-xl glass">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-xl sm:text-2xl font-bold text-foreground">
                            {filteredDocuments.length}
                          </p>
                          <span className="text-[10px] sm:text-xs text-muted-foreground">
                            {projects.length} proj
                          </span>
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
                          <p className="text-xl sm:text-2xl font-bold text-amber-500">
                            {pendingRepublishCount}
                          </p>
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
                          These pages aren't linked to a project yet. Assign them so they appear in project
                          navigation.
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
                              actions.setAssignTargetDoc(doc);
                              actions.setAssignProjectId("");
                              actions.setAssignTopicId("");
                              actions.setAssignProjectOpen(true);
                            }}
                          >
                            Assign
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <TopicsSection
                  selectedProject={selectedProject}
                  selectedTopic={selectedTopic}
                  scopedTopics={scopedTopics}
                  scopedDocuments={scopedDocuments}
                  onSelectTopic={(topic) => setSelectedTopic(topic)}
                  onAddTopic={() => {
                    setParentTopicForCreate(null);
                    setAddTopicOpen(true);
                  }}
                  onAddSubtopic={(parentTopic) => {
                    setParentTopicForCreate(parentTopic);
                    setAddTopicOpen(true);
                  }}
                  onDeleteTopic={(topic) => {
                    actions.setItemToDelete({ type: "topic", id: topic.id, name: topic.name });
                    actions.setDeleteDialogOpen(true);
                  }}
                />

                {/* Pages Table */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
                    <h2 className="text-base sm:text-lg font-semibold">Recent Pages</h2>
                    {actions.selectedDocIds.size > 0 && (
                      <div className="flex items-center gap-1.5 sm:gap-2 bg-primary/10 px-2 sm:px-3 py-1.5 rounded-lg animate-in slide-in-from-right-2 overflow-x-auto">
                        <span className="text-sm font-medium text-primary">
                          {actions.selectedDocIds.size} selected
                        </span>
                        {actions.bulkProgress && (
                          <span className="text-xs text-muted-foreground">
                            {actions.bulkProgress.mode === "publish" && "Publishing"}
                            {actions.bulkProgress.mode === "unpublish" && "Unpublishing"}
                            {actions.bulkProgress.mode === "delete" && "Deleting"}{" "}
                            {actions.bulkProgress.processed}/{actions.bulkProgress.total}
                            {actions.bulkProgress.failed > 0 && ` • ${actions.bulkProgress.failed} failed`}
                          </span>
                        )}
                        <div className="h-4 w-px bg-border" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                          onClick={actions.handleBulkPublish}
                          disabled={actions.isBulkPublishing}
                        >
                          {actions.isBulkPublishing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Publish
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={actions.handleBulkUnpublish}
                          disabled={actions.isBulkUnpublishing}
                        >
                          {actions.isBulkUnpublishing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          Unpublish
                        </Button>
                        {permissions.canDeleteDocument && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => actions.setBulkDeleteDialogOpen(true)}
                            disabled={actions.isBulkDeleting}
                          >
                            {actions.isBulkDeleting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Delete
                          </Button>
                        )}
                        {actions.lastBulkFailures?.docIds?.length ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                            onClick={actions.retryBulkFailures}
                            disabled={actions.isBulkPublishing || actions.isBulkUnpublishing || actions.isBulkDeleting}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retry failed
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={actions.clearSelection}>
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
                              onClick={() => actions.handleSelectAll(visibleDocuments)}
                              className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              title={
                                actions.selectedDocIds.size === visibleDocuments.length
                                  ? "Deselect all"
                                  : "Select all"
                              }
                            >
                              {actions.selectedDocIds.size === visibleDocuments.length &&
                              visibleDocuments.length > 0 ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : actions.selectedDocIds.size > 0 ? (
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
                            <td
                              colSpan={5}
                              className="px-3 sm:px-4 py-6 sm:py-8 text-center text-sm text-muted-foreground"
                            >
                              {selectedTopic ? (
                                <div className="flex flex-col items-center gap-3">
                                  <span>No pages in this topic yet.</span>
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <Button size="sm" onClick={() => setAddPageOpen(true)}>
                                      <Plus className="w-4 h-4 mr-1" />
                                      Add Page
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setImportMarkdownOpen(true)}>
                                      <Upload className="w-4 h-4 mr-1" />
                                      Import
                                    </Button>
                                  </div>
                                </div>
                              ) : selectedProject ? (
                                <div className="flex flex-col items-center gap-3">
                                  <span>Select a topic to view pages.</span>
                                  <Button size="sm" variant="outline" onClick={() => setAddTopicOpen(true)}>
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Topic
                                  </Button>
                                </div>
                              ) : (
                                "Select a project to view pages."
                              )}
                            </td>
                          </tr>
                        ) : (
                          visibleDocuments.map((doc) => {
                            const VisIcon = visibilityConfig[doc.visibility || "internal"].icon;
                            return (
                              <tr
                                key={doc.id}
                                className={cn(
                                  "hover:bg-secondary/30 transition-colors cursor-pointer group",
                                  actions.selectedDocIds.has(doc.id) && "bg-primary/5"
                                )}
                                onClick={() => {
                                  if (!doc.project_id) {
                                    actions.setAssignTargetDoc(doc);
                                    actions.setAssignProjectId("");
                                    actions.setAssignTopicId("");
                                    actions.setAssignProjectOpen(true);
                                    return;
                                  }
                                  const docProject =
                                    projects.find((p) => p.id === doc.project_id) || null;
                                  if (
                                    docProject &&
                                    (!selectedProject || selectedProject.id !== docProject.id)
                                  ) {
                                    setSelectedProject(docProject);
                                    setSelectedTopic(null);
                                  }
                                  setSelectedDocument(doc);
                                  setSelectedPage(doc.id);
                                  const docTopic = topics.find((t) => t.id === doc.topic_id);
                                  if (docTopic) setSelectedTopic(docTopic);
                                }}
                              >
                                <td className="w-8 sm:w-10 px-2 sm:px-4 py-2 sm:py-3">
                                  <button
                                    onClick={(e) => actions.handleSelectDoc(doc.id, e)}
                                    className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {actions.selectedDocIds.has(doc.id) ? (
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
                                      <VisIcon
                                        className={`w-3 h-3 ${visibilityConfig[doc.visibility || "internal"].color}`}
                                      />
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
                                              actions.setAssignTargetDoc(doc);
                                              actions.setAssignProjectId("");
                                              actions.setAssignTopicId("");
                                              actions.setAssignProjectOpen(true);
                                            }}
                                          >
                                            <Folder className="w-4 h-4 mr-2" />
                                            {doc.project_id ? "Move to Project" : "Assign Project"}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          {permissions.canPublish && (
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                actions.handleTogglePublishPage(e, doc.id, doc.is_published);
                                              }}
                                            >
                                              {doc.is_published ? (
                                                <>
                                                  <XCircle className="w-4 h-4 mr-2" />
                                                  Unpublish
                                                </>
                                              ) : (
                                                <>
                                                  <Send className="w-4 h-4 mr-2" />
                                                  Publish
                                                </>
                                              )}
                                            </DropdownMenuItem>
                                          )}
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
                                              actions.handleOpenInDrive(doc.google_doc_id);
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
                                    const hasUnpublishedChanges =
                                      !doc.is_published &&
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
                                            onClick={(e) => actions.handleRepublishPage(e, doc.id)}
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
                                    <span className="text-sm text-muted-foreground">
                                      {doc.owner_name || "\u2014"}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 hidden lg:table-cell">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                      {doc.google_modified_at
                                        ? new Date(doc.google_modified_at).toLocaleDateString()
                                        : "\u2014"}
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
                          onClick={() => setVisiblePagesCount((prev) => prev + 10)}
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

              {/* AI Assistant Panel */}
              <DocAssistantChat
                open={showAIAssistant}
                onOpenChange={setShowAIAssistant}
                currentProject={
                  selectedProject?.name ? { id: selectedProject.id, name: selectedProject.name } : null
                }
                currentTopic={
                  selectedTopic?.name ? { id: selectedTopic.id, name: selectedTopic.name } : null
                }
                onRefresh={fetchData}
                googleToken={driveSync.getGoogleToken()}
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

            if (result && "discoveryResult" in result && result.discoveryResult) {
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
          parentTopic={
            parentTopicForCreate
              ? {
                  id: parentTopicForCreate.id,
                  name: parentTopicForCreate.name,
                  drive_folder_id: parentTopicForCreate.drive_folder_id,
                }
              : null
          }
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

        <AssignProjectDialog
          open={actions.assignProjectOpen}
          onOpenChange={(open) => {
            actions.setAssignProjectOpen(open);
            if (!open) {
              actions.setAssignTargetDoc(null);
              actions.setAssignProjectId("");
              actions.setAssignTopicId("");
            }
          }}
          assignProjectId={actions.assignProjectId}
          onProjectChange={(value) => {
            actions.setAssignProjectId(value);
            actions.setAssignTopicId("");
          }}
          assignTopicId={actions.assignTopicId}
          onTopicChange={(value) => actions.setAssignTopicId(value)}
          projectOptions={assignProjectOptions}
          assignableTopics={assignableTopics}
          isAssigning={actions.isAssigningProject}
          onAssign={actions.handleAssignProject}
        />

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
            const result = await actions.handleDeleteDocument(docId);
            if (result !== false) {
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

        <AlertDialog
          open={actions.deleteDialogOpen}
          onOpenChange={(open) => {
            actions.setDeleteDialogOpen(open);
            if (!open) actions.setForceDeleteAvailable(false);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {actions.itemToDelete?.type}?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{actions.itemToDelete?.name}"?
                {actions.itemToDelete?.type === "project" &&
                  " This will also delete all topics and pages within it."}
                {actions.itemToDelete?.type === "topic" && " This will also delete all pages within it."}
                {actions.forceDeleteAvailable
                  ? " Note: Drive files could not be deleted (they contain content not created by this app). Use 'Force Delete' to remove only from the app."
                  : " The corresponding files will be moved to Google Drive trash (recoverable for 30 days)."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              {actions.forceDeleteAvailable && (
                <AlertDialogAction
                  onClick={() => actions.confirmDelete(true)}
                  className="bg-orange-600 text-white hover:bg-orange-700"
                >
                  Force Delete (App Only)
                </AlertDialogAction>
              )}
              <AlertDialogAction
                onClick={() => actions.confirmDelete(false)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={actions.bulkDeleteDialogOpen} onOpenChange={actions.setBulkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {actions.selectedDocIds.size} page{actions.selectedDocIds.size > 1 ? "s" : ""}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the selected pages? The corresponding files will be moved to
                Google Drive trash (recoverable for 30 days).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={actions.handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={actions.isBulkDeleting}
              >
                {actions.isBulkDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {permissions.canViewAuditLogs && selectedProject && (
          <AuditLogPanel open={auditLogOpen} onOpenChange={setAuditLogOpen} projectId={selectedProject.id} />
        )}

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
