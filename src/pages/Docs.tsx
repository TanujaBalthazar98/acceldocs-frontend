import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  FolderTree, 
  Menu, 
  Search,
  Lock,
  Eye,
  Globe,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSyncContent } from "@/hooks/useSyncContent";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type VisibilityLevel = "internal" | "external" | "public";

interface Project {
  id: string;
  name: string;
  visibility: VisibilityLevel;
  is_published: boolean;
}

interface Topic {
  id: string;
  name: string;
  project_id: string;
}

interface Document {
  id: string;
  title: string;
  google_doc_id: string;
  project_id: string;
  topic_id: string | null;
  visibility: VisibilityLevel;
  is_published: boolean;
  content_html: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
}

const visibilityConfig: Record<VisibilityLevel, { icon: typeof Lock; label: string }> = {
  internal: { icon: Lock, label: "Internal" },
  external: { icon: Eye, label: "External" },
  public: { icon: Globe, label: "Public" },
};

// Helper function to clean Google Docs exported HTML
function cleanGoogleDocsHtml(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1];
  }
  return html;
}

export default function Docs() {
  const { projectId, pageId } = useParams<{ projectId?: string; pageId?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const { syncDocument, syncing } = useSyncContent();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [documentHtml, setDocumentHtml] = useState<string | null>(null);
  const [isOrgUser, setIsOrgUser] = useState(false);

  // Fetch accessible projects, topics, and documents
  useEffect(() => {
    // Wait for auth to finish loading before fetching content
    if (!authLoading) {
      fetchContent();
    }
  }, [user, authLoading]);

  // Auto-sync content when document is selected
  const autoSyncContent = async (doc: Document) => {
    // Only sync if content_html is empty or missing
    if (!doc.content_html) {
      const html = await syncDocument(doc.id, doc.google_doc_id);
      if (html) {
        setDocumentHtml(html);
        setDocuments(prev => 
          prev.map(d => d.id === doc.id ? { ...d, content_html: html } : d)
        );
      }
    } else {
      setDocumentHtml(doc.content_html);
    }
  };

  useEffect(() => {
    if (pageId && documents.length > 0) {
      const doc = documents.find(d => d.id === pageId);
      if (doc) {
        setSelectedDocument(doc);
        autoSyncContent(doc);
        // Auto-expand the project and topic
        setExpandedProjects(prev => new Set([...prev, doc.project_id]));
        if (doc.topic_id) {
          setExpandedTopics(prev => new Set([...prev, doc.topic_id!]));
        }
      }
    } else if (!pageId && documents.length > 0) {
      // Select first document by default
      const firstDoc = documents[0];
      if (firstDoc) {
        navigate(`/docs/${firstDoc.project_id}/${firstDoc.id}`, { replace: true });
      }
    }
  }, [pageId, documents, navigate]);


  const fetchContent = async () => {
    setLoading(true);
    try {
      // Check if user is authenticated and has organization access
      let userOrgId: string | null = null;
      
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();
        
        userOrgId = profile?.organization_id || null;
        setIsOrgUser(!!userOrgId);
      } else {
        setIsOrgUser(false);
      }

      // For authenticated users with org access, show all org projects (published or not)
      // For public/unauthenticated users, only show published projects
      let projectsQuery = supabase
        .from("projects")
        .select("id, name, visibility, is_published, organization_id")
        .order("name");

      // If user has org, fetch all their org's projects; otherwise only published ones
      if (userOrgId) {
        // User is authenticated with org - show all projects they have access to
        // RLS will handle permissions
        const { data: projectsData, error: projectsError } = await projectsQuery;
        
        if (projectsError) {
          console.error("Error fetching projects:", projectsError);
        } else if (projectsData) {
          setProjects(projectsData);
          await fetchTopicsAndDocuments(projectsData.map(p => p.id), userOrgId);
        }
      } else {
        // Unauthenticated or no org - only show published projects
        const { data: projectsData, error: projectsError } = await projectsQuery
          .eq("is_published", true);
        
        if (projectsError) {
          console.error("Error fetching projects:", projectsError);
        } else if (projectsData) {
          setProjects(projectsData);
          await fetchTopicsAndDocuments(projectsData.map(p => p.id), null);
        }
      }
    } catch (error) {
      console.error("Error fetching content:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicsAndDocuments = async (projectIds: string[], userOrgId: string | null) => {
    if (projectIds.length === 0) return;

    // Fetch topics for accessible projects
    const { data: topicsData } = await supabase
      .from("topics")
      .select("id, name, project_id")
      .in("project_id", projectIds)
      .order("name");
    
    if (topicsData) {
      setTopics(topicsData);
    }

    // For authenticated users with org, show all documents
    // For public users, only show published documents
    let docsQuery = supabase
      .from("documents")
      .select("id, title, google_doc_id, project_id, topic_id, visibility, is_published, content_html, created_at, updated_at, owner_id")
      .in("project_id", projectIds)
      .order("title");

    if (!userOrgId) {
      // Only published docs for public/unauthenticated users
      docsQuery = docsQuery.eq("is_published", true);
    }

    const { data: docsData, error: docsError } = await docsQuery;

    if (docsError) {
      console.error("Error fetching documents:", docsError);
    } else if (docsData) {
      setDocuments(docsData);
    }
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const selectDocument = (doc: Document) => {
    setSelectedDocument(doc);
    navigate(`/docs/${doc.project_id}/${doc.id}`);
    setMobileMenuOpen(false);
  };

  // Filter content by search
  const filteredProjects = projects.filter(p => 
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProjectTopics = (projectId: string) => 
    topics.filter(t => t.project_id === projectId);

  const getTopicDocuments = (topicId: string) =>
    documents.filter(d => d.topic_id === topicId);

  const getProjectDocuments = (projectId: string) =>
    documents.filter(d => d.project_id === projectId && !d.topic_id);

  // Sidebar content (reused for mobile and desktop)
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo/Brand */}
      <div className="p-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <FolderTree className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg text-foreground">Documentation</span>
        </Link>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50"
          />
        </div>
      </div>

      {/* Navigation Tree */}
      <ScrollArea className="flex-1 p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No documentation available
          </div>
        ) : (
          <nav className="space-y-1">
            {filteredProjects.map(project => {
              const projectTopics = getProjectTopics(project.id);
              const projectDocs = getProjectDocuments(project.id);
              const isExpanded = expandedProjects.has(project.id);
              const hasChildren = projectTopics.length > 0 || projectDocs.length > 0;

              return (
                <div key={project.id}>
                  {/* Project */}
                  <button
                    onClick={() => hasChildren && toggleProject(project.id)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isExpanded && "bg-accent/50"
                    )}
                  >
                    {hasChildren ? (
                      isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )
                    ) : (
                      <div className="w-4" />
                    )}
                    <FolderTree className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate font-medium">{project.name}</span>
                  </button>

                  {/* Project children */}
                  {isExpanded && (
                    <div className="ml-4 border-l border-border pl-2 mt-1 space-y-1">
                      {/* Topics */}
                      {projectTopics.map(topic => {
                        const topicDocs = getTopicDocuments(topic.id);
                        const isTopicExpanded = expandedTopics.has(topic.id);

                        return (
                          <div key={topic.id}>
                            <button
                              onClick={() => topicDocs.length > 0 && toggleTopic(topic.id)}
                              className={cn(
                                "flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-md transition-colors",
                                "hover:bg-accent hover:text-accent-foreground",
                                isTopicExpanded && "bg-accent/30"
                              )}
                            >
                              {topicDocs.length > 0 ? (
                                isTopicExpanded ? (
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 shrink-0" />
                                )
                              ) : (
                                <div className="w-3" />
                              )}
                              <span className="truncate text-muted-foreground">{topic.name}</span>
                            </button>

                            {/* Topic documents */}
                            {isTopicExpanded && topicDocs.length > 0 && (
                              <div className="ml-4 border-l border-border/50 pl-2 mt-1 space-y-0.5">
                                {topicDocs.map(doc => (
                                  <button
                                    key={doc.id}
                                    onClick={() => selectDocument(doc)}
                                    className={cn(
                                      "flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-md transition-colors",
                                      "hover:bg-accent hover:text-accent-foreground",
                                      selectedDocument?.id === doc.id && "bg-primary/10 text-primary font-medium"
                                    )}
                                  >
                                    <FileText className="h-3 w-3 shrink-0" />
                                    <span className="truncate flex-1 text-left">{doc.title}</span>
                                    {isOrgUser && !doc.is_published && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400">
                                        Draft
                                      </Badge>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Project-level documents (no topic) */}
                      {projectDocs.map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => selectDocument(doc)}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-md transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            selectedDocument?.id === doc.id && "bg-primary/10 text-primary font-medium"
                          )}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate flex-1 text-left">{doc.title}</span>
                          {isOrgUser && !doc.is_published && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400">
                              Draft
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        {authLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : user ? (
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
        ) : (
          <Link to="/auth">
            <Button variant="outline" size="sm" className="w-full">
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 border-r border-border flex-col bg-card">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Docs</span>
          </Link>
          
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:pt-0 pt-14">
        {loading ? (
          <div className="max-w-4xl mx-auto p-8 space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : selectedDocument ? (
          <article className="max-w-4xl mx-auto p-6 lg:p-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              {projects.find(p => p.id === selectedDocument.project_id)?.name}
              {selectedDocument.topic_id && (
                <>
                  <ChevronRight className="h-4 w-4" />
                  {topics.find(t => t.id === selectedDocument.topic_id)?.name}
                </>
              )}
            </nav>

            {/* Title */}
            <div className="flex items-start gap-3 mb-4">
              <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
                {selectedDocument.title}
              </h1>
              {isOrgUser && !selectedDocument.is_published && (
                <Badge className="mt-2 text-xs bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                  Draft
                </Badge>
              )}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-8 pb-6 border-b border-border">
              <span>Last updated: {format(new Date(selectedDocument.updated_at), "MMM d, yyyy")}</span>
              <Badge variant="outline" className="text-xs">
                {visibilityConfig[selectedDocument.visibility].label}
              </Badge>
              {isOrgUser && selectedDocument.is_published && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800 dark:text-green-400">
                  Published
                </Badge>
              )}
              {syncing && (
                <div className="flex items-center gap-2 ml-auto text-primary">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Syncing...</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="bg-card border border-border rounded-lg p-6 lg:p-8">
              {documentHtml ? (
                <div 
                  className="prose prose-neutral dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: cleanGoogleDocsHtml(documentHtml) }}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                  <p className="font-medium">Loading content...</p>
                  <p className="text-sm mt-2">Syncing document from Google Docs</p>
                </div>
              )}
            </div>
          </article>
        ) : (
          <div className="flex items-center justify-center h-full text-center p-8">
            <div>
              <FolderTree className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to Documentation</h2>
              <p className="text-muted-foreground">
                {projects.length === 0 
                  ? "No documentation is available yet."
                  : "Select a page from the sidebar to get started."}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
