import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
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
import { TopicsGrid } from "@/components/dashboard/TopicsGrid";
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
  visibility: VisibilityLevel;
  is_published: boolean;
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
  const { toast } = useToast();
  const { listFolder, trashFile } = useGoogleDrive();
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
  const [itemToDelete, setItemToDelete] = useState<{ type: 'project' | 'topic' | 'document'; id: string; name: string } | null>(null);
  const [isNormalizing, setIsNormalizing] = useState(false);
  
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
        .select("id, drive_folder_id, name, slug, domain")
        .eq("id", profile.organization_id)
        .single();
      
      if (org?.drive_folder_id) {
        setRootFolderId(org.drive_folder_id);
      }
      if (org?.slug || org?.domain) {
        setOrganizationSlug(org.slug || org.domain);
      }
      
      // Onboarding is complete if the organization has a name set (not just the default domain)
      setNeedsOnboarding(false);
      
      // Get projects
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, drive_folder_id, visibility, is_published")
        .eq("organization_id", profile.organization_id);

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
          const { data: docsData } = await supabase
            .from("documents")
            .select(`
              id, title, google_doc_id, project_id, topic_id, google_modified_at, created_at, visibility, is_published, owner_id, content_html, published_content_html,
              owner:profiles!documents_owner_id_fkey(full_name, email)
            `)
            .in("project_id", projectIds)
            .order("created_at", { ascending: false });
          
          if (docsData) {
            // Map the owner data to a flat owner_name field
            const docsWithOwnerName = docsData.map(doc => ({
              ...doc,
              owner_name: doc.owner?.full_name || doc.owner?.email?.split('@')[0] || null,
            }));
            setDocuments(docsWithOwnerName as Document[]);
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
  
  // Filter projects and topics by search
  const filteredProjects = projects.filter(p => 
    !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredTopics = topics.filter(t => 
    !searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Delete handlers
  const handleDeleteProject = async (projectId: string) => {
    // Get the project's drive folder ID first
    const project = projects.find(p => p.id === projectId);
    
    // Trash the Drive folder if it exists
    if (project?.drive_folder_id) {
      const trashed = await trashFile(project.drive_folder_id);
      if (!trashed) {
        toast({ 
          title: "Warning", 
          description: "Could not move Drive folder to trash, but project will be deleted from the app.", 
          variant: "destructive" 
        });
      }
    }
    
    // Delete all documents in the project first
    await supabase.from("documents").delete().eq("project_id", projectId);
    // Delete all topics in the project
    await supabase.from("topics").delete().eq("project_id", projectId);
    // Delete the project
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to delete project.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Project moved to Drive trash and deleted from app." });
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setSelectedTopic(null);
      }
      fetchData();
    }
  };
  
  const handleDeleteTopic = async (topicId: string) => {
    // Get the topic's drive folder ID first
    const topic = topics.find(t => t.id === topicId);
    
    // Trash the Drive folder if it exists
    if (topic?.drive_folder_id) {
      const trashed = await trashFile(topic.drive_folder_id);
      if (!trashed) {
        toast({ 
          title: "Warning", 
          description: "Could not move Drive folder to trash, but topic will be deleted from the app.", 
          variant: "destructive" 
        });
      }
    }
    
    // Delete all documents in the topic first
    await supabase.from("documents").delete().eq("topic_id", topicId);
    // Delete the topic
    const { error } = await supabase.from("topics").delete().eq("id", topicId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to delete topic.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Topic moved to Drive trash and deleted from app." });
      if (selectedTopic?.id === topicId) {
        setSelectedTopic(null);
      }
      fetchData();
    }
  };
  
  const handleDeleteDocument = async (docId: string) => {
    // Get the document's google doc ID first
    const doc = filteredDocuments.find(d => d.id === docId);
    
    // Trash the Drive file if it exists
    if (doc?.google_doc_id) {
      const trashed = await trashFile(doc.google_doc_id);
      if (!trashed) {
        toast({ 
          title: "Warning", 
          description: "Could not move Drive file to trash, but page will be deleted from the app.", 
          variant: "destructive" 
        });
      }
    }
    
    const { error } = await supabase.from("documents").delete().eq("id", docId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to delete page.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Page moved to Drive trash and deleted from app." });
      fetchData();
    }
  };
  
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    switch (itemToDelete.type) {
      case 'project':
        await handleDeleteProject(itemToDelete.id);
        break;
      case 'topic':
        await handleDeleteTopic(itemToDelete.id);
        break;
      case 'document':
        await handleDeleteDocument(itemToDelete.id);
        break;
    }
    
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };
  
  const handleOpenInDrive = (googleDocId: string) => {
    window.open(`https://docs.google.com/document/d/${googleDocId}/edit`, '_blank');
  };

  const handleTogglePublishPage = async (e: React.MouseEvent, docId: string, currentState: boolean) => {
    e.stopPropagation();
    const newState = !currentState;
    
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

  const handleShareProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setAddProjectOpen(true)}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-4 h-4" />
              </Button>
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
            {filteredProjects.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {searchQuery ? "No matching projects" : "No projects yet"}
              </p>
            ) : (
              filteredProjects.map((project) => {
                const projectTopics = filteredTopics.filter(t => t.project_id === project.id);
                const isExpanded = expandedProjects.has(project.id) || !!searchQuery;
                
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all"
                          >
                            <MoreHorizontal className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleShareProject(e as unknown as React.MouseEvent, project);
                          }}>
                            <Share2 className="w-3 h-3 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            window.open(`/docs/${project.id}`, '_blank');
                          }}>
                            <Eye className="w-3 h-3 mr-2" />
                            Preview Docs
                          </DropdownMenuItem>
                          {project.is_published && (
                            <DropdownMenuItem onClick={() => {
                              window.open(`/docs/${project.id}`, '_blank');
                            }}>
                              <BookOpen className="w-3 h-3 mr-2" />
                              Published Docs
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setSelectedProject(project);
                            setProjectSettingsOpen(true);
                          }}>
                            <Settings className="w-3 h-3 mr-2" />
                            Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleNormalizeStructure(project.id)}
                            disabled={isNormalizing}
                          >
                            <Layers className="w-3 h-3 mr-2" />
                            {isNormalizing ? "Normalizing..." : "Normalize Structure"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setItemToDelete({ type: 'project', id: project.id, name: project.name });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all"
                                >
                                  <MoreHorizontal className="w-3 h-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSettingsTopic(topic);
                                    setTopicSettingsOpen(true);
                                  }}
                                >
                                  <Settings className="w-3 h-3 mr-2" />
                                  Settings
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    setItemToDelete({ type: 'topic', id: topic.id, name: topic.name });
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
          <div className="flex items-center gap-2">
            {organizationSlug && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2" 
                onClick={() => window.open(`/docs/${organizationSlug}`, '_blank')}
              >
                <BookOpen className="w-4 h-4" />
                View Docs
              </Button>
            )}
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
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Stats */}
          {(() => {
            const publishedCount = filteredDocuments.filter(d => d.is_published).length;
            const draftCount = filteredDocuments.filter(d => !d.is_published && !d.published_content_html).length;
            const pendingRepublishCount = filteredDocuments.filter(d => 
              !d.is_published && d.published_content_html && d.content_html !== d.published_content_html
            ).length;
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const staleCount = filteredDocuments.filter(d => {
              if (!d.google_modified_at) return true;
              return new Date(d.google_modified_at) < thirtyDaysAgo;
            }).length;
            
            return (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="p-4 rounded-xl glass">
                  <p className="text-2xl font-bold text-foreground">{filteredDocuments.length}</p>
                  <p className="text-sm text-muted-foreground">Total Pages</p>
                </div>
                <div className="p-4 rounded-xl glass">
                  <p className="text-2xl font-bold text-state-active">{publishedCount}</p>
                  <p className="text-sm text-muted-foreground">Published</p>
                </div>
                <div className="p-4 rounded-xl glass">
                  <p className="text-2xl font-bold text-amber-500">{pendingRepublishCount}</p>
                  <p className="text-sm text-muted-foreground">Pending Republish</p>
                </div>
                <div className="p-4 rounded-xl glass">
                  <p className="text-2xl font-bold text-state-draft">{draftCount}</p>
                  <p className="text-sm text-muted-foreground">New Drafts</p>
                </div>
                <div className="p-4 rounded-xl glass">
                  <p className="text-2xl font-bold text-state-deprecated">{staleCount}</p>
                  <p className="text-sm text-muted-foreground" title="Pages not modified in 30+ days">Needs Attention</p>
                </div>
              </div>
            );
          })()}

          {/* Topics */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Topics</h2>
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
              <TopicsGrid
                topics={(() => {
                  const projectTopics = topics.filter(t => t.project_id === selectedProject.id);
                  if (!selectedTopic) {
                    // Show only root-level topics when nothing selected
                    return projectTopics.filter(t => !t.parent_id);
                  }
                  // Show selected topic and all its descendants
                  const getDescendants = (parentId: string): Topic[] => {
                    const children = projectTopics.filter(t => t.parent_id === parentId);
                    return children.flatMap(c => [c, ...getDescendants(c.id)]);
                  };
                  return [selectedTopic, ...getDescendants(selectedTopic.id)];
                })()}
                allTopics={topics.filter(t => t.project_id === selectedProject.id)}
                selectedTopic={selectedTopic}
                onSelectTopic={(topic) => setSelectedTopic(topic)}
                documents={documents}
                onTopicsReordered={fetchData}
              />
            )}
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
                      Published
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      Owner
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                      Last Modified
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
                    filteredDocuments.map((doc) => {
                      const VisIcon = visibilityConfig[doc.visibility || 'internal'].icon;
                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                          onClick={() => navigate(`/page/${doc.id}`)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <div className="flex-1">
                                <span className="text-sm font-medium text-foreground">
                                  {doc.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mr-3">
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
            </div>
          </div>
        </div>
      </main>

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
        onOpenChange={setAddProjectOpen}
        rootFolderId={rootFolderId}
        organizationId={organizationId || undefined}
        onCreated={(folder) => {
          fetchData(); // Refetch to get full project data with all fields
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
        onUpdate={() => fetchData()}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemToDelete?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? 
              {itemToDelete?.type === 'project' && " This will also delete all topics and pages within it."}
              {itemToDelete?.type === 'topic' && " This will also delete all pages within it."}
              {" The corresponding files will be moved to Google Drive trash (recoverable for 30 days)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
