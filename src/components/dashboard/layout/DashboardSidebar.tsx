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
  Bot,
  PanelLeftClose,
  PanelLeft,
  Home,
  BookOpen,
  GitBranch,
  ExternalLink,
  Code as CodeIcon,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SmartSearch } from "@/components/SmartSearch";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { UnifiedContentTree } from "@/components/dashboard/UnifiedContentTree";
import { Project, Topic, Document, ProjectVersion } from "@/types/dashboard";

interface DashboardSidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  
  user: any;
  appRole: string | null;
  organizationSlug: string | null;
  organizationName: string;
  isOrgOwner: boolean;
  
  projects: Project[];
  filteredProjects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  setExpandedProjects: (callback: (prev: Set<string>) => Set<string>) => void;
  subProjectsExpanded: boolean;
  setSubProjectsExpanded: (expanded: boolean) => void;
  
  filteredTopics: Topic[];
  scopedDocuments: Document[];
  scopedTopics: Topic[];
  selectedTopic: Topic | null;
  setSelectedTopic: (topic: Topic | null) => void;
  selectedPage: string | null;
  setSelectedPage: (pageId: string | null) => void;
  setSelectedDocument: (doc: Document | null) => void;
  selectedVersion: ProjectVersion | null;
  setSelectedVersion: (version: ProjectVersion | null) => void;
  projectVersions: ProjectVersion[];
  
  topicsExpanded: boolean;
  setTopicsExpanded: (expanded: boolean) => void;
  
  driveIntegrationEnabled: boolean;
  needsDriveAccess: boolean;
  rootFolderId: string | null;
  isConnectingDrive: boolean;
  isSyncing: boolean;
  handleConnectDrive: () => void;
  handleSyncFromDrive: () => void;
  
  setAddProjectOpen: (open: boolean) => void;
  setAddTopicOpen: (open: boolean) => void;
  setParentTopicForCreate: (topic: Topic | null) => void;
  setAddPageOpen: (open: boolean) => void;
  onUploadFile: (parentTopic: Topic) => void;
  
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
  
  setDeleteDialogOpen: (open: boolean) => void;
  setItemToDelete: (item: { type: 'project' | 'topic' | 'document'; id: string; name: string; forceDelete?: boolean } | null) => void;
  
  setSearchQuery: (query: string) => void;
  signOut: () => void;
  permissions: {
    canCreateProject: boolean;
    canDeleteProject: boolean;
    canManageTeam: boolean;
    canViewAuditLogs: boolean;
    canEditProject: boolean;
  };
  
  navigate: (path: string) => void;
  fetchData: () => void;
  currentPath: string;
}

interface NavItemProps {
  icon: any;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
  badge?: string;
  className?: string;
}

function NavItem({ icon: Icon, label, active, collapsed, onClick, badge, className }: NavItemProps) {
  const content = (
    <Button
      variant={active ? "secondary" : "ghost"}
      className={cn(
        "w-full justify-start h-9 px-3 transition-all duration-200",
        collapsed && "justify-center px-0",
        active ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={onClick}
    >
      <Icon className={cn("w-4 h-4 shrink-0", !collapsed && "mr-3")} />
      {!collapsed && (
        <div className="flex items-center justify-between flex-1 min-w-0">
          <span className="truncate">{label}</span>
          {badge && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-secondary rounded-full font-mono uppercase shrink-0">
              {badge}
            </span>
          )}
        </div>
      )}
    </Button>
  );

  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {label}
            {badge && <span className="text-[10px] opacity-70">({badge})</span>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

export function DashboardSidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  user,
  organizationSlug,
  organizationName,
  projects,
  filteredProjects,
  selectedProject,
  setSelectedProject,
  setExpandedProjects,
  subProjectsExpanded,
  setSubProjectsExpanded,
  filteredTopics,
  scopedDocuments,
  scopedTopics,
  selectedTopic,
  setSelectedTopic,
  selectedPage,
  setSelectedPage,
  setSelectedDocument,
  selectedVersion,
  setSelectedVersion,
  projectVersions,
  topicsExpanded,
  setTopicsExpanded,
  driveIntegrationEnabled,
  needsDriveAccess,
  rootFolderId,
  isConnectingDrive,
  isSyncing,
  handleConnectDrive,
  handleSyncFromDrive,
  setAddProjectOpen,
  setAddTopicOpen,
  setParentTopicForCreate,
  setAddPageOpen,
  setShowAPISettings,
  setShowMCPSettings,
  setShowIntegrations,
  setShowGeneralSettings,
  setProjectSettingsOpen,
  setTopicSettingsOpen,
  setSettingsTopic,
  setPageSettingsOpen,
  setPageSettingsTarget,
  setInviteMemberOpen,
  setShowAIAssistant,
  setAuditLogOpen,
  setDeleteDialogOpen,
  setItemToDelete,
  setSearchQuery,
  signOut,
  permissions,
  navigate,
  fetchData,
  currentPath
}: DashboardSidebarProps) {
  
  const subProjects = projects.filter(p => p.parent_id === selectedProject?.id);

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
          {!sidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2 font-semibold truncate cursor-pointer" onClick={() => navigate('/dashboard')}>
                <span className="bg-primary/10 p-1.5 rounded-md text-primary">
                  <FileText className="w-4 h-4" />
                </span>
                <span className="truncate text-lg">{organizationName || "Docspeare"}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setSidebarCollapsed(true)}
              >
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <div className="mx-auto">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setSidebarCollapsed(false)}
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Project Context */}
        <div className={cn(
          "border-b border-border py-2",
          sidebarCollapsed ? "px-2" : "px-4"
        )}>
          <ProjectSwitcher
            projects={projects}
            selectedProject={selectedProject}
            organizationSlug={organizationSlug}
            collapsed={sidebarCollapsed}
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

        {/* Dynamic Navigation Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className={cn("py-4 space-y-6", sidebarCollapsed ? "px-2" : "px-4")}>
            
            {/* Main Navigation Section */}
            <div className="space-y-1">
              <NavItem
                icon={Home}
                label="Dashboard"
                active={currentPath === '/dashboard'}
                collapsed={sidebarCollapsed}
                onClick={() => navigate('/dashboard')}
              />
              
              <NavItem
                icon={BookOpen}
                label="Documentation"
                collapsed={sidebarCollapsed}
              />
              
              {selectedProject && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-full text-left outline-none">
                              <NavItem
                                icon={GitBranch}
                                label="Version"
                                collapsed={sidebarCollapsed}
                                badge={selectedVersion?.name || 'v1.0'}
                                active={false}
                                className="cursor-pointer"
                              />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-[200px]">
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Project Versions
                            </div>
                            {projectVersions
                              .filter(v => v.project_id === selectedProject.id)
                              .map((v) => (
                                <DropdownMenuItem
                                  key={v.id}
                                  onClick={() => setSelectedVersion(v)}
                                  className={cn(
                                    "flex items-center justify-between gap-2",
                                    selectedVersion?.id === v.id && "bg-secondary font-medium"
                                  )}
                                >
                                  <span className="truncate">{v.name}</span>
                                  {v.is_default && (
                                    <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 h-4">Default</Badge>
                                  )}
                                  {!v.is_published && (
                                    <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 h-4 bg-amber-50 text-amber-600 border-amber-200">Draft</Badge>
                                  )}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipTrigger>
                      {sidebarCollapsed && (
                        <TooltipContent side="right">
                          Version: {selectedVersion?.name || 'v1.0'}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>

                  <NavItem
                    icon={Settings}
                    label="Project Settings"
                    collapsed={sidebarCollapsed}
                    onClick={() => setProjectSettingsOpen(true)}
                  />
                </>
              )}
            </div>

            {/* Sub-Projects Section */}
            {selectedProject && (
              <div className="space-y-2">
                {!sidebarCollapsed ? (
                  <>
                    <div className="flex items-center justify-between px-3">
                      <button 
                        className="flex items-center gap-2 group"
                        onClick={() => setSubProjectsExpanded(!subProjectsExpanded)}
                      >
                        <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Sub-Projects</span>
                        <ChevronDown className={cn(
                          "w-3 h-3 text-muted-foreground/50 transition-transform group-hover:text-foreground",
                          !subProjectsExpanded && "-rotate-90"
                        )} />
                      </button>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => setAddProjectOpen(true)}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {subProjectsExpanded && (
                      <div className="space-y-1 pl-3">
                        {subProjects.length > 0 ? (
                          subProjects.map(p => (
                            <Button 
                              key={p.id}
                              variant="ghost" 
                              className="w-full justify-start h-8 px-3 text-sm text-muted-foreground hover:text-foreground"
                              onClick={() => setSelectedProject(p)}
                            >
                              <Folder className="w-4 h-4 mr-2" />
                              <span className="truncate">{p.name}</span>
                            </Button>
                          ))
                        ) : (
                          <p className="text-[11px] italic text-muted-foreground/60 px-3 py-1">No sub-projects yet</p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => setSidebarCollapsed(false)}
                          >
                            <FolderTree className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Sub-Projects ({subProjects.length})</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            )}

            {/* Search Bar (Moved contextually) */}
            <div className="px-1">
              {sidebarCollapsed ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-full h-10" onClick={() => setSidebarCollapsed(false)}>
                        <Search className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Search</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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

            {/* Content Section */}
            {selectedProject && (
              <div className="space-y-2">
                {!sidebarCollapsed ? (
                  <>
                    <div className="flex items-center justify-between px-3">
                      <button 
                        className="flex items-center gap-2 group"
                        onClick={() => setTopicsExpanded(!topicsExpanded)}
                      >
                        <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Content</span>
                        <ChevronDown className={cn(
                          "w-3 h-3 text-muted-foreground/50 transition-transform group-hover:text-foreground",
                          !topicsExpanded && "-rotate-90"
                        )} />
                      </button>
                      <div className="flex items-center gap-1">
                        {driveIntegrationEnabled && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleSyncFromDrive}>
                                  <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Sync</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-5 w-5">
                              <Plus className="w-3.5 h-3.5" />
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

                    {topicsExpanded && (
                      <div className="pl-1">
                        <UnifiedContentTree
                          topics={filteredTopics.filter(t => t.project_id === selectedProject.id)}
                          documents={scopedDocuments.filter(d => d.project_id === selectedProject.id)}
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
                          onUploadFile={(topic) => {
                            if (onUploadFile) {
                              onUploadFile(topic);
                            }
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
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => setSidebarCollapsed(false)}
                          >
                            <BookOpen className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Content</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            )}

            {/* Developer Resources Section */}
            <div className="space-y-2">
              {!sidebarCollapsed ? (
                <>
                  <div className="px-3">
                    <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Developer Resources</span>
                  </div>
                  <div className="space-y-1">
                    <NavItem icon={CodeIcon} label="API Reference" collapsed={sidebarCollapsed} onClick={() => setShowAPISettings(true)} />
                    <NavItem icon={MessageSquare} label="MCP Protocol" collapsed={sidebarCollapsed} onClick={() => setShowMCPSettings(true)} />
                    <NavItem icon={Plug2} label="Integrations" collapsed={sidebarCollapsed} onClick={() => setShowIntegrations(true)} />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <NavItem icon={CodeIcon} label="API Reference" collapsed={sidebarCollapsed} onClick={() => setShowAPISettings(true)} />
                  <NavItem icon={MessageSquare} label="MCP Protocol" collapsed={sidebarCollapsed} onClick={() => setShowMCPSettings(true)} />
                  <NavItem icon={Plug2} label="Integrations" collapsed={sidebarCollapsed} onClick={() => setShowIntegrations(true)} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Footer - User Profile & System Actions */}
        <div className="shrink-0 border-t border-border bg-card/50 backdrop-blur-md">
          {!sidebarCollapsed ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-primary/5 text-primary text-xs">
                    {user?.email?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{user?.user_metadata?.full_name || user?.email?.split('@')[0]}</span>
                  <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs gap-2"
                  onClick={() => setShowGeneralSettings(true)}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={signOut}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-2 flex flex-col items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-8 w-8 border border-border cursor-pointer">
                      <AvatarImage src={user?.user_metadata?.avatar_url} />
                      <AvatarFallback className="bg-primary/5 text-primary text-xs">
                        {user?.email?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex flex-col">
                      <span className="font-medium">{user?.email}</span>
                     </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowGeneralSettings(true)}>
                      <Settings className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
