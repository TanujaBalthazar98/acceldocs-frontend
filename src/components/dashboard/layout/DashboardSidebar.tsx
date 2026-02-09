
import {
  FileText,
  FolderTree,
  Plus,
  Search,
  Settings,
  Folder,
  User,
  RefreshCw,
  LogOut,
  ChevronDown,
  Plug2,
  Lock,
  MessageSquare,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";
import { SmartSearch } from "@/components/SmartSearch";
// Import ProjectSwitcher properly - assuming it's a default export based on file name
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { UnifiedContentTree } from "@/components/dashboard/UnifiedContentTree";
import { Project, Topic, Document, ProjectVersion } from "@/types/dashboard";

interface DashboardSidebarProps {
  // Unchanged state needed for rendering
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  
  // Organization / User
  user: any; // Type from AuthContext
  appRole: string | null;
  organizationSlug: string | null;
  organizationName: string;
  isOrgOwner: boolean;
  
  // Projects Data
  projects: Project[];
  filteredProjects: Project[]; // Derived in parent
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  setExpandedProjects: (callback: (prev: Set<string>) => Set<string>) => void;
  
  // Content Data
  filteredTopics: Topic[];
  scopedDocuments: Document[];
  scopedTopics: Topic[];
  selectedTopic: Topic | null;
  setSelectedTopic: (topic: Topic | null) => void;
  selectedPage: string | null;
  setSelectedPage: (pageId: string | null) => void;
  setSelectedDocument: (doc: Document | null) => void; // For full doc object
  
  // UI Actions / State
  topicsExpanded: boolean;
  setTopicsExpanded: (expanded: boolean) => void;
  
  // Drive Integration
  driveIntegrationEnabled: boolean;
  needsDriveAccess: boolean;
  rootFolderId: string | null;
  isConnectingDrive: boolean;
  isSyncing: boolean;
  handleConnectDrive: () => void;
  handleSyncFromDrive: () => void;
  getGoogleToken: () => string | null;
  
  // Dialog Triggers
  setAddProjectOpen: (open: boolean) => void;
  setAddTopicOpen: (open: boolean) => void;
  setParentTopicForCreate: (topic: Topic | null) => void;
  setAddPageOpen: (open: boolean) => void;
  
  // Settings Triggers
  setShowAPISettings: (open: boolean) => void;
  setShowMCPSettings: (open: boolean) => void;
  setShowIntegrations: (open: boolean) => void;
  setShowGeneralSettings: (open: boolean) => void;
  setProjectSettingsOpen: (open: boolean) => void;
  setShareOpen: (open: boolean) => void;
  setTopicSettingsOpen: (open: boolean) => void;
  setSettingsTopic: (topic: Topic | null) => void;
  setPageSettingsOpen: (open: boolean) => void;
  setPageSettingsTarget: (doc: Document | null) => void;
  setInviteMemberOpen: (open: boolean) => void;
  setShowAIAssistant: (open: boolean) => void;
  setAuditLogOpen: (open: boolean) => void;
  
  // Deletion
  setDeleteDialogOpen: (open: boolean) => void;
  setItemToDelete: (item: { type: 'project' | 'topic' | 'document'; id: string; name: string; forceDelete?: boolean } | null) => void;
  setForceDeleteAvailable: (avail: boolean) => void;
  
  // Search
  setSearchQuery: (query: string) => void;
  
  // Auth Actions
  signOut: () => void;
  
  // Permissions
  permissions: {
    canCreateProject: boolean;
    canDeleteProject: boolean;
    canManageTeam: boolean;
    canViewAuditLogs: boolean;
  };
  
  // Navigation
  navigate: (path: string) => void;
  
  // Refresh
  fetchData: () => void;
}

export function DashboardSidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  user,
  appRole,
  organizationSlug,
  organizationName,
  isOrgOwner,
  projects,
  filteredProjects,
  selectedProject,
  setSelectedProject,
  setExpandedProjects,
  filteredTopics,
  scopedDocuments,
  scopedTopics,
  selectedTopic,
  setSelectedTopic,
  selectedPage,
  setSelectedPage,
  setSelectedDocument,
  topicsExpanded,
  setTopicsExpanded,
  driveIntegrationEnabled,
  needsDriveAccess,
  rootFolderId,
  isConnectingDrive,
  isSyncing,
  handleConnectDrive,
  handleSyncFromDrive,
  getGoogleToken,
  setAddProjectOpen,
  setAddTopicOpen,
  setParentTopicForCreate,
  setAddPageOpen,
  setShowAPISettings,
  setShowMCPSettings,
  setShowIntegrations,
  setShowGeneralSettings,
  setProjectSettingsOpen,
  setShareOpen,
  setTopicSettingsOpen,
  setSettingsTopic,
  setPageSettingsOpen,
  setPageSettingsTarget,
  setInviteMemberOpen,
  setShowAIAssistant,
  setAuditLogOpen,
  setDeleteDialogOpen,
  setItemToDelete,
  setForceDeleteAvailable,
  setSearchQuery,
  signOut,
  permissions,
  navigate,
  fetchData
}: DashboardSidebarProps) {
  
  return (
    <>
      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-card border-r border-border transition-all duration-300 flex flex-col",
        sidebarCollapsed ? "w-16" : "w-64",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Sidebar Header */}
        <div className="h-14 border-b border-border flex items-center px-4 justify-between shrink-0">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 font-semibold truncate">
              <span className="bg-primary/10 p-1.5 rounded-md text-primary">
                <FileText className="w-4 h-4" />
              </span>
              <span className="truncate">{organizationName || "Docspeare"}</span>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="mx-auto">
              <span className="bg-primary/10 p-1.5 rounded-md text-primary flex">
                <FileText className="w-4 h-4" />
              </span>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className={cn(
          "border-b border-border transition-all",
          sidebarCollapsed ? "p-2" : "p-4"
        )}>
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full h-10" onClick={() => setSidebarCollapsed(false)}>
                  <Search className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Search docs</TooltipContent>
            </Tooltip>
          ) : (
            <SmartSearch
              placeholder="Search docs..."
              documents={scopedDocuments.filter(d => !selectedProject || d.project_id === selectedProject.id).map(d => ({
                id: d.id,
                title: d.title,
                project_id: d.project_id,
                topic_id: d.topic_id,
                content_html: d.content_html,
              }))}
              topics={scopedTopics.filter(t => !selectedProject || t.project_id === selectedProject.id).map(t => ({
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
                  const topic = scopedTopics.find(t => t.id === result.id);
                  if (topic) {
                    const project = projects.find(p => p.id === topic.project_id);
                    if (project) {
                      setSelectedProject(project);
                      setSelectedTopic(topic);
                      setExpandedProjects(prev => new Set([...prev, project.id]));
                    }
                  }
                } else if (result.type === "page") {
                  const doc = scopedDocuments.find(d => d.id === result.id);
                  if (doc) {
                    setSelectedDocument(doc);
                    setSelectedPage(doc.id);
                    const project = projects.find(p => p.id === doc.project_id);
                    if (project) {
                      setSelectedProject(project);
                      setExpandedProjects(prev => new Set([...prev, project.id]));
                    }
                    const docTopic = scopedTopics.find(t => t.id === doc.topic_id);
                    if (docTopic) {
                      setSelectedTopic(docTopic);
                    } else {
                      setSelectedTopic(null);
                    }
                  }
                }
              }}
            />
          )}
        </div>

        {/* Navigation Content */}
        <div className={cn(
          "flex-1 overflow-y-auto",
          sidebarCollapsed ? "px-1" : "px-2"
        )}>
          {sidebarCollapsed ? (
            /* Collapsed View */
            <div className="py-2 space-y-1">
              <ProjectSwitcher
                projects={projects}
                selectedProject={selectedProject}
                organizationSlug={organizationSlug}
                collapsed={true}
                onSelectProject={(project: Project) => {
                  setSelectedProject(project);
                  setSelectedTopic(null);
                  setShowAPISettings(false);
                  setShowMCPSettings(false);
                  setShowIntegrations(false);
                  setShowGeneralSettings(false);
                }}
                onCreateProject={() => setAddProjectOpen(true)}
              />
              
              {/* Recent/Filtered Projects Icons */}
              {filteredProjects.slice(0, 5).map((project) => (
                <Tooltip key={project.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "w-full h-10",
                        selectedProject?.id === project.id
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => {
                        setSelectedProject(project);
                        setShowAPISettings(false);
                        setShowMCPSettings(false);
                        setShowIntegrations(false);
                        setExpandedProjects(prev => new Set([...prev, project.id]));
                      }}
                    >
                      <FolderTree className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{project.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : (
            /* Expanded View */
            <div className="py-2 space-y-1">
              {/* Project Context */}
              <div className="mb-4">
                <ProjectSwitcher
                  projects={projects}
                  selectedProject={selectedProject}
                  organizationSlug={organizationSlug}
                  collapsed={false}
                  onSelectProject={(project: Project) => {
                    setSelectedProject(project);
                    setSelectedTopic(null);
                    setShowAPISettings(false);
                    setShowMCPSettings(false);
                    setShowIntegrations(false);
                    setShowGeneralSettings(false);
                    if (project) {
                      setExpandedProjects(prev => new Set([...prev, project.id]));
                    }
                  }}
                  onCreateProject={() => setAddProjectOpen(true)}
                />
              </div>

              {!selectedProject && (
                <div className="px-3 py-6 text-center">
                  <FolderTree className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Select a project to view contents</p>
                </div>
              )}

              {selectedProject && (
                <>
                  {/* Connect Drive Banner */}
                  {driveIntegrationEnabled && needsDriveAccess && rootFolderId && (
                    <div className="mx-2 mb-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-2">Connect Google Drive to sync</p>
                      <Button
                        size="sm"
                        onClick={handleConnectDrive}
                        disabled={isConnectingDrive}
                        className="w-full"
                      >
                        {isConnectingDrive ? "Connecting..." : "Connect Drive"}
                      </Button>
                    </div>
                  )}

                  {/* Topics Header */}
                  <div className="flex items-center justify-between px-2 py-1 mb-1">
                     <button 
                      className="flex items-center gap-2 hover:bg-secondary/50 p-1.5 rounded-md transition-colors flex-1 text-left"
                      onClick={() => setTopicsExpanded(!topicsExpanded)}
                    >
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Content</span>
                      <ChevronDown className={cn(
                        "w-3 h-3 text-muted-foreground transition-transform",
                        !topicsExpanded && "-rotate-90"
                      )} />
                    </button>
                    <div className="flex items-center gap-1">
                      {driveIntegrationEnabled && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSyncFromDrive}>
                              <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Sync from Drive</TooltipContent>
                        </Tooltip>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Plus className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setParentTopicForCreate(null);
                            setAddTopicOpen(true);
                          }}>
                            <Folder className="w-4 h-4 mr-2" /> Add Topic
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedTopic(null);
                            setAddPageOpen(true);
                          }}>
                            <FileText className="w-4 h-4 mr-2" /> Add Page
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Content Tree */}
                  {topicsExpanded && (
                    <div className="pl-1">
                      <UnifiedContentTree
                        topics={filteredTopics.filter(t => t.project_id === selectedProject.id)}
                        documents={scopedDocuments.filter(d => d.project_id === selectedProject.id).map(d => ({
                          id: d.id,
                          title: d.title,
                          google_doc_id: d.google_doc_id,
                          project_id: d.project_id,
                          topic_id: d.topic_id,
                          display_order: d.display_order,
                        }))}
                        selectedTopicId={selectedTopic?.id || null}
                        selectedDocumentId={selectedPage}
                        autoCollapseDepth={3}
                        onSelectTopic={(topic) => {
                          setSelectedTopic(topic);
                          setSelectedPage(null);
                          setMobileSidebarOpen(false);
                        }}
                        onSelectDocument={(doc) => {
                           const fullDoc = scopedDocuments.find(d => d.id === doc.id);
                           if (fullDoc) setSelectedDocument(fullDoc);
                           setSelectedPage(doc.id);
                           
                           // Set context
                           const docTopic = scopedTopics.find(t => t.id === doc.topic_id);
                           setSelectedTopic(docTopic || null);
                           
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
                        onOpenTopicSettings={(topic) => {
                          setSettingsTopic(topic);
                          setTopicSettingsOpen(true);
                        }}
                        onDeleteTopic={(topic) => {
                          setItemToDelete({ type: 'topic', id: topic.id, name: topic.name });
                          setDeleteDialogOpen(true);
                        }}
                        onOpenDocumentSettings={(doc) => {
                          const fullDoc = scopedDocuments.find(d => d.id === doc.id);
                          if (fullDoc) {
                            setPageSettingsTarget(fullDoc);
                            setPageSettingsOpen(true);
                          }
                        }}
                        onDeleteDocument={(doc) => {
                          setItemToDelete({ type: 'document', id: doc.id, name: doc.title });
                          setDeleteDialogOpen(true);
                        }}
                        onTopicsReordered={fetchData}
                        onDocumentsReordered={fetchData}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-border p-2 space-y-1">
           {permissions.canManageTeam && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn("w-full justify-start", sidebarCollapsed ? "px-2" : "px-4")}
                  onClick={() => setInviteMemberOpen(true)}
                >
                  <User className="w-4 h-4 mr-2" />
                  {!sidebarCollapsed && <span>Invite Members</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Invite Members</TooltipContent>
            </Tooltip>
          )}
           
           <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn("w-full justify-start", sidebarCollapsed ? "px-2" : "px-4")}
                  onClick={() => {
                     setShowGeneralSettings(true);
                     setSelectedProject(null);
                     setSelectedTopic(null);
                     setSelectedPage(null);
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {!sidebarCollapsed && <span>Settings</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">General Settings</TooltipContent>
            </Tooltip>

            {/* AI Assistant Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                   className={cn("w-full justify-start", sidebarCollapsed ? "px-2" : "px-4")}
                  onClick={() => setShowAIAssistant(true)}
                >
                  <Bot className="w-4 h-4 mr-2" />
                  {!sidebarCollapsed && <span>AI Assistant</span>}
                </Button>
              </TooltipTrigger>
               <TooltipContent side="right">AI Assistant</TooltipContent>
            </Tooltip>

            {selectedProject && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn("w-full justify-start", sidebarCollapsed ? "px-2" : "px-4")}
                      onClick={() => setShowAPISettings(true)}
                    >
                       <Plug2 className="w-4 h-4 mr-2" />
                       {!sidebarCollapsed && <span>API Access</span>}
                    </Button>
                  </TooltipTrigger>
                   <TooltipContent side="right">API Access</TooltipContent>
                </Tooltip>

                {permissions.canViewAuditLogs && (
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                        variant="ghost"
                        className={cn("w-full justify-start", sidebarCollapsed ? "px-2" : "px-4")}
                        onClick={() => setAuditLogOpen(true)}
                        >
                        <FileText className="w-4 h-4 mr-2" />
                        {!sidebarCollapsed && <span>Audit Logs</span>}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Audit Logs</TooltipContent>
                    </Tooltip>
                )}
              </>
            )}

            <div className="pt-2 border-t border-border mt-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        className={cn("w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20", sidebarCollapsed ? "px-2" : "px-4")}
                        onClick={signOut}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        {!sidebarCollapsed && <span>Sign Out</span>}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Sign Out</TooltipContent>
                </Tooltip>
            </div>
        </div>
      </aside>
    </>
  );
}
