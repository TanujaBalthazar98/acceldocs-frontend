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
  Moon
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

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePageTitle, setSharePageTitle] = useState("");
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showGeneralSettings, setShowGeneralSettings] = useState(false);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  
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
      
      // Get organization's root folder
      const { data: org } = await supabase
        .from("organizations")
        .select("id, drive_folder_id")
        .eq("id", profile.organization_id)
        .single();
      
      if (org?.drive_folder_id) {
        setRootFolderId(org.drive_folder_id);
        setNeedsOnboarding(false);
      } else {
        // Organization exists but no root folder - needs onboarding
        setNeedsOnboarding(true);
      }
      
      // Get projects
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, drive_folder_id")
        .eq("organization_id", profile.organization_id);
      
      if (projectsData) {
        setProjects(projectsData);
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
  
  const pages: { title: string; state: "active" | "draft" | "deprecated" | "archived"; owner: string; verified: string; visibility: "internal" | "public" | "external" }[] = [];

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
    return <GeneralSettings onBack={() => setShowGeneralSettings(false)} />;
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
            <button 
              onClick={() => setAddProjectOpen(true)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {projects.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No projects yet</p>
            ) : (
              projects.map((project, index) => (
                <div
                  key={project.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    index === 0
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <FolderTree className="w-4 h-4" />
                  <span className="flex-1 text-left truncate">{project.name}</span>
                  <button
                    onClick={() => {
                      setSelectedProject(project);
                      setProjectSettingsOpen(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all"
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                </div>
              ))
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
            <span className="text-foreground">Developer Docs</span>
          </div>
          <Button variant="hero" size="sm" className="gap-2" onClick={() => setAddPageOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Page
          </Button>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl glass">
              <p className="text-2xl font-bold text-foreground">{pages.length}</p>
              <p className="text-sm text-muted-foreground">Total Pages</p>
            </div>
            <div className="p-4 rounded-xl glass">
              <p className="text-2xl font-bold text-state-active">
                {pages.filter(p => p.state === "active").length}
              </p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
            <div className="p-4 rounded-xl glass">
              <p className="text-2xl font-bold text-state-draft">
                {pages.filter(p => p.state === "draft").length}
              </p>
              <p className="text-sm text-muted-foreground">Drafts</p>
            </div>
            <div className="p-4 rounded-xl glass">
              <p className="text-2xl font-bold text-state-deprecated">
                {pages.filter(p => p.state === "deprecated" || p.owner === "—").length}
              </p>
              <p className="text-sm text-muted-foreground">Needs Attention</p>
            </div>
          </div>

          {/* Alert - only show if there are issues */}
          {pages.some(p => p.state === "deprecated" || p.owner === "—") && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-state-deprecated/10 border border-state-deprecated/20 mb-6">
              <AlertTriangle className="w-4 h-4 text-state-deprecated" />
              <span className="text-sm text-state-deprecated">
                Some pages need attention: missing owner or deprecated
              </span>
            </div>
          )}

          {/* Topics */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Topics</h2>
              <button 
                onClick={() => setAddTopicOpen(true)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {/* TODO: Replace with real topics from database */}
              <p className="text-sm text-muted-foreground">No topics yet. Create one to organize pages.</p>
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
                  {pages.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No pages yet. Add a page to get started.
                      </td>
                    </tr>
                  ) : (
                    pages.map((page) => (
                      <tr
                        key={page.title}
                        className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                        onClick={() => handleOpenPage(page.title)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-foreground">
                                {page.title}
                              </span>
                              {page.visibility === "public" && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                                  Public
                                </span>
                              )}
                            </div>
                            <button
                              onClick={(e) => handleSharePage(e, page.title)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-secondary transition-all"
                            >
                              <Share2 className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <Circle
                              className={`w-2 h-2 ${stateConfig[page.state].color} rounded-full`}
                            />
                            <span className="text-sm text-muted-foreground">
                              {stateConfig[page.state].label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span
                              className={`text-sm ${
                                page.owner === "—"
                                  ? "text-state-deprecated"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {page.owner}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span
                              className={`text-sm ${
                                page.verified === "45 days ago"
                                  ? "text-state-deprecated"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {page.verified}
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
        projectName={selectedProject?.name}
        parentFolderId={selectedProject?.drive_folder_id || null}
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
        projectFolderId={selectedProject?.drive_folder_id || null}
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
