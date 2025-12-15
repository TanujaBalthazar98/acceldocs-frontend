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
  RefreshCw,
  Sparkles,
  PanelLeftClose,
  User
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
import { useBrandingLoader, useBrandingStyles } from "@/hooks/useBrandingLoader";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AskAIDialog } from "@/components/docs/AskAIDialog";
import { DocsLanding } from "@/components/docs/DocsLanding";

type VisibilityLevel = "internal" | "external" | "public";

interface Project {
  id: string;
  name: string;
  slug: string | null;
  visibility: VisibilityLevel;
  is_published: boolean;
  organization_id: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  domain: string;
  logo_url: string | null;
  tagline: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  custom_css: string | null;
  hero_title: string | null;
  hero_description: string | null;
  show_search_on_landing: boolean;
  show_featured_projects: boolean;
}

interface Topic {
  id: string;
  name: string;
  slug: string | null;
  project_id: string;
}

interface Document {
  id: string;
  title: string;
  slug: string | null;
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
  const params = useParams<{ 
    orgSlug?: string; 
    projectSlug?: string; 
    topicSlug?: string;
    pageSlug?: string;
  }>();
  
  const orgSlug = params.orgSlug;
  const projectSlug = params.projectSlug;
  const topicSlug = params.pageSlug ? params.topicSlug : undefined;
  const pageSlug = params.pageSlug || params.topicSlug;
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const { syncDocument, syncing } = useSyncContent();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [documentHtml, setDocumentHtml] = useState<string | null>(null);
  const [isOrgUser, setIsOrgUser] = useState(false);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [askAIOpen, setAskAIOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !hasFetched) {
      setHasFetched(true);
      fetchContent();
    }
  }, [authLoading, hasFetched]);

  const autoSyncContent = async (doc: Document) => {
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

  const buildDocUrl = (doc: Document, project: Project, org: Organization) => {
    const orgIdentifier = org.slug || org.domain;
    const topic = doc.topic_id ? topics.find(t => t.id === doc.topic_id) : null;
    
    if (topic?.slug) {
      return `/docs/${orgIdentifier}/${project.slug}/${topic.slug}/${doc.slug}`;
    }
    return `/docs/${orgIdentifier}/${project.slug}/${doc.slug}`;
  };

  // Handle URL-based project and document selection
  useEffect(() => {
    if (projects.length === 0) return;

    // Select project from URL
    if (projectSlug) {
      const project = projects.find(p => p.slug === projectSlug);
      if (project && project.id !== selectedProject?.id) {
        setSelectedProject(project);
      }
    } else if (!selectedProject && projects.length > 0) {
      setSelectedProject(projects[0]);
    }
  }, [projectSlug, projects]);

  // Handle document selection from URL
  useEffect(() => {
    if (documents.length === 0 || !selectedProject) return;

    if (pageSlug) {
      let doc: Document | undefined;
      
      if (topicSlug) {
        const topic = topics.find(t => t.slug === topicSlug && t.project_id === selectedProject.id);
        if (topic) {
          doc = documents.find(d => d.slug === pageSlug && d.topic_id === topic.id);
        }
      } else {
        doc = documents.find(d => d.slug === pageSlug && d.project_id === selectedProject.id && !d.topic_id);
        
        if (!doc) {
          doc = documents.find(d => d.slug === pageSlug && d.project_id === selectedProject.id);
          if (doc?.topic_id && currentOrg) {
            navigate(buildDocUrl(doc, selectedProject, currentOrg), { replace: true });
            return;
          }
        }
      }
      
      if (doc) {
        setSelectedDocument(doc);
        autoSyncContent(doc);
        if (doc.topic_id) {
          setExpandedTopics(prev => new Set([...prev, doc.topic_id!]));
        }
      }
    }
  }, [pageSlug, topicSlug, selectedProject, documents, topics, currentOrg]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;
      
      let userOrgId: string | null = null;
      
      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", currentUser.id)
          .single();
        
        userOrgId = profile?.organization_id || null;
        setIsOrgUser(!!userOrgId);
        
        if (userOrgId) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("id, name, slug, domain, logo_url, tagline, primary_color, secondary_color, accent_color, font_heading, font_body, custom_css, hero_title, hero_description, show_search_on_landing, show_featured_projects")
            .eq("id", userOrgId)
            .single();
          if (orgData) {
            setCurrentOrg(orgData as Organization);
          }
        }
      } else {
        setIsOrgUser(false);
      }
      
      if (orgSlug && !currentOrg) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("id, name, slug, domain, logo_url, tagline, primary_color, secondary_color, accent_color, font_heading, font_body, custom_css, hero_title, hero_description, show_search_on_landing, show_featured_projects")
          .or(`slug.eq.${orgSlug},domain.eq.${orgSlug}`)
          .maybeSingle();
        if (orgData) {
          setCurrentOrg(orgData as Organization);
        }
      }

      let projectsQuery = supabase
        .from("projects")
        .select("id, name, slug, visibility, is_published, organization_id")
        .order("name");

      if (userOrgId) {
        const { data: projectsData, error: projectsError } = await projectsQuery;
        
        if (projectsError) {
          console.error("Error fetching projects:", projectsError);
        } else if (projectsData) {
          setProjects(projectsData);
          await fetchTopicsAndDocuments(projectsData.map(p => p.id), userOrgId);
        }
      } else {
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

    const { data: topicsData } = await supabase
      .from("topics")
      .select("id, name, slug, project_id")
      .in("project_id", projectIds)
      .order("name");
    
    if (topicsData) {
      setTopics(topicsData);
    }

    let docsQuery = supabase
      .from("documents")
      .select("id, title, slug, google_doc_id, project_id, topic_id, visibility, is_published, content_html, created_at, updated_at, owner_id")
      .in("project_id", projectIds)
      .order("title");

    if (!userOrgId) {
      docsQuery = docsQuery.eq("is_published", true);
    }

    const { data: docsData, error: docsError } = await docsQuery;

    if (docsError) {
      console.error("Error fetching documents:", docsError);
    } else if (docsData) {
      setDocuments(docsData);
    }
  };

  const selectProject = (project: Project) => {
    setSelectedProject(project);
    setSelectedDocument(null);
    setDocumentHtml(null);
    if (currentOrg) {
      navigate(`/docs/${currentOrg.slug || currentOrg.domain}/${project.slug}`);
    }
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
    autoSyncContent(doc);
    if (selectedProject && currentOrg) {
      navigate(buildDocUrl(doc, selectedProject, currentOrg));
    }
    setMobileMenuOpen(false);
  };

  // Filter content by search
  const searchLower = searchQuery.toLowerCase();
  
  const projectTopics = selectedProject 
    ? topics.filter(t => t.project_id === selectedProject.id)
    : [];

  const projectDocuments = selectedProject
    ? documents.filter(d => d.project_id === selectedProject.id)
    : [];
  
  const filteredDocuments = projectDocuments.filter(d =>
    !searchQuery || d.title.toLowerCase().includes(searchLower)
  );
  
  const filteredTopics = projectTopics.filter(t =>
    !searchQuery || 
    t.name.toLowerCase().includes(searchLower) ||
    filteredDocuments.some(d => d.topic_id === t.id)
  );

  const getTopicDocuments = (topicId: string) =>
    filteredDocuments.filter(d => d.topic_id === topicId);

  const getProjectLevelDocuments = () =>
    filteredDocuments.filter(d => !d.topic_id);

  // Sidebar content for topics and pages
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Sidebar Header with collapse button */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {selectedProject?.name || "Documentation"}
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 hidden lg:flex"
          onClick={() => setSidebarCollapsed(true)}
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation Tree */}
      <ScrollArea className="flex-1 p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !selectedProject ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Select a project above
          </div>
        ) : filteredTopics.length === 0 && getProjectLevelDocuments().length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No pages found
          </div>
        ) : (
          <nav className="space-y-1">
            {/* Topics */}
            {filteredTopics.map(topic => {
              const topicDocs = getTopicDocuments(topic.id);
              const isTopicExpanded = expandedTopics.has(topic.id);

              return (
                <div key={topic.id}>
                  <button
                    onClick={() => topicDocs.length > 0 && toggleTopic(topic.id)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                      "hover:bg-accent/50 hover:text-accent-foreground",
                      isTopicExpanded && "sidebar-item-selected"
                    )}
                  >
                    {topicDocs.length > 0 ? (
                      isTopicExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )
                    ) : (
                      <div className="w-4" />
                    )}
                    <span className="truncate font-medium">{topic.name}</span>
                  </button>

                  {/* Topic documents */}
                  {isTopicExpanded && topicDocs.length > 0 && (
                    <div className="ml-4 border-l border-border pl-2 mt-1 space-y-0.5">
                      {topicDocs.map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => selectDocument(doc)}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-md transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            selectedDocument?.id === doc.id && "sidebar-item-selected font-medium"
                          )}
                        >
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
            {getProjectLevelDocuments().map(doc => (
              <button
                key={doc.id}
                onClick={() => selectDocument(doc)}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedDocument?.id === doc.id && "sidebar-item-selected font-medium"
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
          </nav>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        {user ? (
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
              Go to Dashboard
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );

  // Show landing page when no project or page is selected
  const showLandingPage = !selectedDocument && !selectedProject && currentOrg && !loading;

  // Load Google Fonts for branding
  useBrandingLoader([currentOrg?.font_heading || "", currentOrg?.font_body || ""]);
  
  // Apply branding styles (CSS variables and custom CSS)
  useBrandingStyles(currentOrg ? {
    primary_color: currentOrg.primary_color,
    secondary_color: currentOrg.secondary_color,
    accent_color: currentOrg.accent_color,
    font_heading: currentOrg.font_heading,
    font_body: currentOrg.font_body,
    custom_css: currentOrg.custom_css,
  } : null);

  // If showing landing page
  if (showLandingPage) {
    return (
      <div className="min-h-screen bg-background flex flex-col docs-branded">
        {/* Minimal Header */}
        <header className="border-b border-border bg-card">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14">
            <div className="flex items-center gap-3">
              {currentOrg.logo_url ? (
                <img src={currentOrg.logo_url} alt={currentOrg.name} className="h-8 w-auto" />
              ) : (
                <FolderTree className="h-6 w-6 brand-primary-text" />
              )}
              <span className="font-bold text-lg text-foreground brand-heading">{currentOrg.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
                  <Link to="/auth"><Button size="sm" className="brand-primary-bg text-white">Create account</Button></Link>
                </>
              )}
            </div>
          </div>
        </header>

        <DocsLanding
          organization={currentOrg}
          projects={projects.map(p => ({ ...p, description: null }))}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onProjectSelect={selectProject}
          isAuthenticated={!!user}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col docs-branded">
      {/* Top Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          {/* Left: Organization Logo/Name */}
          <div className="flex items-center gap-3">
            <Link to={currentOrg ? `/docs/${currentOrg.slug || currentOrg.domain}` : "/"} className="flex items-center gap-2">
              {currentOrg?.logo_url ? (
                <img src={currentOrg.logo_url} alt={currentOrg.name} className="h-8 w-auto" />
              ) : (
                <FolderTree className="h-6 w-6 brand-primary-text" />
              )}
              <span className="font-bold text-lg text-foreground brand-heading">
                {currentOrg?.name || "Documentation"}
              </span>
              {currentOrg?.tagline && (
                <span className="text-muted-foreground font-normal hidden md:inline brand-body">{currentOrg.tagline}</span>
              )}
            </Link>
          </div>

          {/* Center: Search + Ask AI */}
          <div className="hidden md:flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 h-9 bg-muted/50"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                /
              </kbd>
            </div>
            {selectedProject?.visibility === "public" && (
              <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setAskAIOpen(true)}>
              <Sparkles className="h-4 w-4" />
              Ask AI
              </Button>
            )}
          </div>

          {/* Right: Auth buttons */}
          <div className="flex items-center gap-2">
            {authLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : user ? (
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="hidden sm:inline-flex" style={{ backgroundColor: currentOrg?.primary_color }}>
                    Create account
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile menu trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                {sidebarContent}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Project Tabs Bar */}
      <div className="border-b border-border bg-card">
        <div className="flex items-center gap-1 px-4 lg:px-6 overflow-x-auto">
          {loading ? (
            <div className="flex gap-2 py-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-8 w-24" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="py-3 text-sm text-muted-foreground">No projects available</div>
          ) : (
            projects.map(project => (
              <button
                key={project.id}
                onClick={() => selectProject(project)}
                className={cn(
                  "px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                  selectedProject?.id === project.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {project.name}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        {!sidebarCollapsed && (
          <aside className="hidden lg:flex w-64 border-r border-border flex-col bg-card">
            {sidebarContent}
          </aside>
        )}

        {/* Collapsed sidebar trigger */}
        {sidebarCollapsed && (
          <div className="hidden lg:flex items-start pt-4 pl-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setSidebarCollapsed(false)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
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
                <span>{selectedProject?.name}</span>
                {selectedDocument.topic_id && (
                  <>
                    <span>/</span>
                    <span>{topics.find(t => t.id === selectedDocument.topic_id)?.name}</span>
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
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {selectedProject ? `Welcome to ${selectedProject.name}` : "Welcome to Documentation"}
                </h2>
                <p className="text-muted-foreground">
                  {projectDocuments.length === 0 
                    ? "No pages available in this project yet."
                    : "Select a page from the sidebar to get started."}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Ask AI Dialog */}
      <AskAIDialog
        open={askAIOpen}
        onOpenChange={setAskAIOpen}
        documentContent={documentHtml ? documentHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : undefined}
        documentTitle={selectedDocument?.title}
      />
    </div>
  );
}
