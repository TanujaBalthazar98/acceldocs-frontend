import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  FolderTree, 
  Plus, 
  Search, 
  Settings, 
  LogOut,
  ChevronRight,
  Folder,
  AlertTriangle,
  User,
  Clock,
  Circle,
  Share2,
  MoreHorizontal,
  Sun,
  Moon,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { PageView } from "@/components/dashboard/PageView";
import { SharePanel } from "@/components/dashboard/SharePanel";
import { AddPageDialog } from "@/components/dashboard/AddPageDialog";
import { AddProjectDialog } from "@/components/dashboard/AddProjectDialog";
import { AddTopicDialog } from "@/components/dashboard/AddTopicDialog";
import { ProjectSettingsPanel } from "@/components/dashboard/ProjectSettingsPanel";
import { GeneralSettings } from "@/components/dashboard/GeneralSettings";
import { Onboarding } from "@/components/dashboard/Onboarding";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDrive, DriveFile } from "@/hooks/useGoogleDrive";

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
}

interface Topic {
  id: string;
  name: string;
  drive_folder_id: string;
  project_id: string;
}

interface Document {
  id: string;
  title: string;
  google_doc_id: string;
  project_id: string;
  topic_id: string | null;
  google_modified_at: string | null;
  created_at: string;
}

const Dashboard = () => {
  const { user, signOut, requestDriveAccess } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { listFolder } = useGoogleDrive();
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePageTitle, setSharePageTitle] = useState("");
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showGeneralSettings, setShowGeneralSettings] = useState(false);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [needsDriveAccess, setNeedsDriveAccess] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  
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
        .select("id, drive_folder_id, name")
        .eq("id", profile.organization_id)
        .single();
      
      if (org?.drive_folder_id) {
        setRootFolderId(org.drive_folder_id);
      }
      
      // Onboarding is complete if the organization has a name set (not just the default domain)
      setNeedsOnboarding(false);
      
      // Get projects
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, drive_folder_id")
        .eq("organization_id", profile.organization_id);
      
      if (projectsData) {
        setProjects(projectsData);
        
        // Get topics for all projects
        const projectIds = projectsData.map(p => p.id);
        if (projectIds.length > 0) {
          const { data: topicsData } = await supabase
            .from("topics")
            .select("id, name, drive_folder_id, project_id")
            .in("project_id", projectIds);
          
          if (topicsData) {
            setTopics(topicsData);
          }
          
          // Get documents for all projects
          const { data: docsData } = await supabase
            .from("documents")
            .select("id, title, google_doc_id, project_id, topic_id, google_modified_at, created_at")
            .in("project_id", projectIds)
            .order("created_at", { ascending: false });
          
          if (docsData) {
            setDocuments(docsData);
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
  
  // Filter documents based on selected project/topic
  const filteredDocuments = documents.filter(doc => {
    if (selectedTopic) {
      return doc.topic_id === selectedTopic.id;
    }
    if (selectedProject) {
      return doc.project_id === selectedProject.id;
    }
    return true;
  });
  
  const handleOpenInDrive = (googleDocId: string) => {
    window.open(`https://docs.google.com/document/d/${googleDocId}/edit`, '_blank');
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

  const handleSharePage = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    setSharePageTitle(title);
    setShareOpen(true);
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

                if (!existingDoc) {
                  // Create new document with topic_id
                  const { error: docError } = await supabase
                    .from("documents")
                    .insert({
                      title: doc.name,
                      google_doc_id: doc.id,
                      project_id: projectId,
                      topic_id: topicId,
                      google_modified_at: doc.modifiedTime,
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
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow animate-pulse">
            <FileText className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
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

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">DocLayer</span>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search docs..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Projects */}
        <div className="flex-1 overflow-y-auto px-2">
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Projects
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
              <button 
                onClick={() => setAddProjectOpen(true)}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

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

          <div className="space-y-1">
            {projects.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No projects yet</p>
            ) : (
              projects.map((project) => {
                const projectTopics = topics.filter(t => t.project_id === project.id);
                const isExpanded = expandedProjects.has(project.id);
                
                return (
                  <div key={project.id}>
                    <div
                      className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        selectedProject?.id === project.id
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                      onClick={() => {
                        setSelectedProject(project);
                        setExpandedProjects(prev => {
                          const next = new Set(prev);
                          if (next.has(project.id)) {
                            next.delete(project.id);
                          } else {
                            next.add(project.id);
                          }
                          return next;
                        });
                      }}
                    >
                      <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <FolderTree className="w-4 h-4" />
                      <span className="flex-1 text-left truncate">{project.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                          setAddTopicOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all"
                        title="Add topic"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                          setProjectSettingsOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all"
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                    
                    {/* Topics under this project */}
                    {isExpanded && projectTopics.length > 0 && (
                      <div className="ml-4 mt-1 space-y-1">
                        {projectTopics.map((topic) => (
                          <div
                            key={topic.id}
                            className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                              selectedTopic?.id === topic.id
                                ? "bg-primary/10 text-foreground"
                                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                            }`}
                            onClick={() => setSelectedTopic(topic)}
                          >
                            <Folder className="w-3.5 h-3.5" />
                            <span className="flex-1 text-left truncate">{topic.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTopic(topic);
                                setAddPageOpen(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all"
                              title="Add page"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {isExpanded && projectTopics.length === 0 && (
                      <div className="ml-6 mt-1">
                        <p className="text-xs text-muted-foreground py-1">No topics yet</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-border">
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
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
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
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Projects</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{selectedProject?.name || "Select a project"}</span>
            {selectedTopic && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground">{selectedTopic.name}</span>
              </>
            )}
          </div>
          <Button 
            variant="hero" 
            size="sm" 
            className="gap-2" 
            onClick={() => setAddPageOpen(true)}
            disabled={!selectedTopic}
            title={!selectedTopic ? "Select a topic first" : "Add page"}
          >
            <Plus className="w-4 h-4" />
            Add Page
          </Button>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl glass">
              <p className="text-2xl font-bold text-foreground">{filteredDocuments.length}</p>
              <p className="text-sm text-muted-foreground">Total Pages</p>
            </div>
            <div className="p-4 rounded-xl glass">
              <p className="text-2xl font-bold text-state-active">
                {filteredDocuments.length}
              </p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
            <div className="p-4 rounded-xl glass">
              <p className="text-2xl font-bold text-state-draft">0</p>
              <p className="text-sm text-muted-foreground">Drafts</p>
            </div>
            <div className="p-4 rounded-xl glass">
              <p className="text-2xl font-bold text-state-deprecated">0</p>
              <p className="text-sm text-muted-foreground">Needs Attention</p>
            </div>
          </div>

          {/* Topics */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Topics</h2>
              <button 
                onClick={() => setAddTopicOpen(true)}
                disabled={!selectedProject}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {!selectedProject ? (
                <p className="text-sm text-muted-foreground">Select a project to view topics.</p>
              ) : topics.filter(t => t.project_id === selectedProject.id).length === 0 ? (
                <p className="text-sm text-muted-foreground">No topics yet. Create one to organize pages.</p>
              ) : (
                topics
                  .filter(t => t.project_id === selectedProject.id)
                  .map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopic(topic)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        selectedTopic?.id === topic.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {topic.name}
                    </button>
                  ))
              )}
            </div>
          </div>

          {/* Pages Table */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Recent Pages</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Page
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                      State
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      Owner
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                      Verified
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        {selectedTopic 
                          ? "No pages in this topic yet. Add a page to get started."
                          : selectedProject
                            ? "Select a topic to view pages."
                            : "Select a project to view pages."}
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <tr
                        key={doc.id}
                        className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                        onClick={() => handleOpenInDrive(doc.google_doc_id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-foreground">
                                {doc.title}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInDrive(doc.google_doc_id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-secondary transition-all"
                              title="Open in Google Docs"
                            >
                              <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={(e) => handleSharePage(e, doc.title)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-secondary transition-all"
                            >
                              <Share2 className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <Circle className="w-2 h-2 bg-state-active rounded-full" />
                            <span className="text-sm text-muted-foreground">Active</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">—</span>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <SharePanel
        open={shareOpen}
        onOpenChange={setShareOpen}
        pageTitle={sharePageTitle}
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
        onOpenChange={setAddProjectOpen}
        rootFolderId={rootFolderId}
        onCreated={(folder) => {
          setProjects(prev => [...prev, { id: folder.id, name: folder.name, drive_folder_id: folder.id }]);
        }}
      />
      
      <AddTopicDialog
        open={addTopicOpen}
        onOpenChange={setAddTopicOpen}
        projectName={selectedProject?.name || null}
        projectId={selectedProject?.id || null}
        projectFolderId={selectedProject?.drive_folder_id || null}
        onCreated={() => fetchData()}
      />
      
      <ProjectSettingsPanel
        open={projectSettingsOpen}
        onOpenChange={setProjectSettingsOpen}
        projectName={selectedProject?.name || null}
      />
    </div>
  );
};

export default Dashboard;
