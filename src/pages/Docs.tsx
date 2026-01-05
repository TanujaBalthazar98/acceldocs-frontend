import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderTree,
  Menu,
  Lock,
  Eye,
  Globe,
  Sparkles,
  PanelLeftClose,
  Code,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useBrandingLoader, useBrandingStyles } from "@/hooks/useBrandingLoader";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AskAIDialog } from "@/components/docs/AskAIDialog";
import { DocsLanding } from "@/components/docs/DocsLanding";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { CopyLinkButton } from "@/components/docs/CopyLinkButton";
import { PageFeedback } from "@/components/docs/PageFeedback";
import { ThemeToggle } from "@/components/docs/ThemeToggle";
import { SmartSearch } from "@/components/SmartSearch";
import { normalizeHtml } from "@/lib/htmlNormalizer";

type VisibilityLevel = "internal" | "external" | "public";

interface Project {
  id: string;
  name: string;
  slug: string | null;
  visibility: VisibilityLevel;
  is_published: boolean;
  organization_id: string;
  mcp_enabled?: boolean | null;
  openapi_spec_json?: any;
  openapi_spec_url?: string | null;
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
  mcp_enabled?: boolean | null;
  openapi_spec_json?: any;
  openapi_spec_url?: string | null;
}

interface Topic {
  id: string;
  name: string;
  slug: string | null;
  project_id: string;
  parent_id: string | null;
  display_order: number | null;
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
  published_content_html: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
}

const visibilityConfig: Record<VisibilityLevel, { icon: typeof Lock; label: string }> = {
  internal: { icon: Lock, label: "Internal" },
  external: { icon: Eye, label: "External" },
  public: { icon: Globe, label: "Public" },
};
// Helper to remove duplicate first "title" block inside the document body.
// Google Docs exports often repeat the doc title as the first paragraph.
function removeFirstHeadingIfMatches(html: string, title: string): string {
  if (!html || !title) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLElement | null;
  if (!container) return html;

  const normalizedTitle = title.trim().toLowerCase();

  // Find the first meaningful block element (often <p> or <h1>)
  const firstBlock = container.querySelector("h1, h2, h3, h4, h5, h6, p, div");
  if (!firstBlock) return container.innerHTML;

  const blockText = (firstBlock.textContent || "").trim().toLowerCase();
  if (!blockText) return container.innerHTML;

  // Remove if it matches the title (exact or very similar)
  if (
    blockText === normalizedTitle ||
    blockText.replace(/\s+/g, " ") === normalizedTitle.replace(/\s+/g, " ")
  ) {
    firstBlock.remove();
  }

  return container.innerHTML;
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

  const setPublishedContent = async (doc: Document) => {
    // Published docs view: NEVER show draft content.
    setDocumentHtml(doc.published_content_html ?? null);
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

    // Select project from URL - only if projectSlug is provided
    if (projectSlug) {
      const project = projects.find(p => p.slug === projectSlug);
      if (project && project.id !== selectedProject?.id) {
        setSelectedProject(project);
      }
    } else {
      // No project slug in URL - clear selection to show landing page
      setSelectedProject(null);
      setSelectedDocument(null);
      setDocumentHtml(null);
    }
  }, [projectSlug, projects]);

  // Handle document selection from URL
  useEffect(() => {
    if (!selectedProject) return;

    if (documents.length === 0) return;

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
        setPublishedContent(doc);
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
            .select("id, name, slug, domain, logo_url, tagline, primary_color, secondary_color, accent_color, font_heading, font_body, custom_css, hero_title, hero_description, show_search_on_landing, show_featured_projects, mcp_enabled, openapi_spec_json, openapi_spec_url")
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
          .select("id, name, slug, domain, logo_url, tagline, primary_color, secondary_color, accent_color, font_heading, font_body, custom_css, hero_title, hero_description, show_search_on_landing, show_featured_projects, mcp_enabled, openapi_spec_json, openapi_spec_url")
          .or(`slug.eq.${orgSlug},domain.eq.${orgSlug}`)
          .maybeSingle();
        if (orgData) {
          setCurrentOrg(orgData as Organization);
        }
      }

      let projectsQuery = supabase
        .from("projects")
        .select("id, name, slug, visibility, is_published, organization_id, mcp_enabled, openapi_spec_json, openapi_spec_url")
        .eq("is_published", true)
        .order("name");

      const { data: projectsData, error: projectsError } = await projectsQuery;

      if (projectsError) {
        console.error("Error fetching projects:", projectsError);
      } else if (projectsData) {
        setProjects(projectsData);
        await fetchTopicsAndDocuments(projectsData.map(p => p.id), userOrgId);
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
      .select("id, name, slug, project_id, parent_id, display_order")
      .in("project_id", projectIds)
      .order("display_order")
      .order("name");

    if (topicsData) {
      setTopics(topicsData);
    }

    // Published docs view: ONLY show pages with a published version.
    const { data: docsData, error: docsError } = await supabase
      .from("documents")
      .select(
        "id, title, slug, google_doc_id, project_id, topic_id, visibility, is_published, content_html, published_content_html, created_at, updated_at, owner_id"
      )
      .in("project_id", projectIds)
      .not("published_content_html", "is", null)
      .order("title");

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
    setPublishedContent(doc);
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

  // Get root topics (no parent) for hierarchical rendering
  const getRootTopics = () => filteredTopics.filter(t => !t.parent_id);
  
  // Get child topics for a given parent
  const getChildTopics = (parentId: string) => 
    filteredTopics.filter(t => t.parent_id === parentId)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const getTopicDocuments = (topicId: string) =>
    filteredDocuments.filter(d => d.topic_id === topicId);

  const getProjectLevelDocuments = () =>
    filteredDocuments.filter(d => !d.topic_id);

  // Recursive topic renderer component
  const renderTopic = (topic: Topic, depth: number = 0) => {
    const topicDocs = getTopicDocuments(topic.id);
    const childTopics = getChildTopics(topic.id);
    const isTopicExpanded = expandedTopics.has(topic.id);
    const hasChildren = topicDocs.length > 0 || childTopics.length > 0;

    const twoLineClampClass =
      "min-w-0 flex-1 text-left overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] leading-snug";

    return (
      <div key={topic.id} className="min-w-0" style={{ paddingLeft: `${depth * 12}px` }}>
        <button
          onClick={() => hasChildren && toggleTopic(topic.id)}
          className={cn(
            "flex min-w-0 items-start gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
            "hover:bg-accent/50 hover:text-accent-foreground",
            isTopicExpanded && "sidebar-item-selected"
          )}
        >
          {hasChildren ? (
            isTopicExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
            )
          ) : (
            <div className="w-4 shrink-0 mt-0.5" />
          )}
          <span className={cn(twoLineClampClass, "font-medium")}>{topic.name}</span>
        </button>

        {/* Expanded content: child topics and documents */}
        {isTopicExpanded && hasChildren && (
          <div className="mt-1 space-y-0.5">
            {/* Render child topics recursively */}
            {childTopics.map((childTopic) => renderTopic(childTopic, depth + 1))}

            {/* Render topic documents */}
            {topicDocs.map((doc) => (
              <div key={doc.id} className="min-w-0" style={{ paddingLeft: "12px" }}>
                <button
                  onClick={() => selectDocument(doc)}
                  className={cn(
                    "flex min-w-0 items-start gap-2 w-full px-3 py-1.5 text-sm rounded-md transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    selectedDocument?.id === doc.id && "sidebar-item-selected font-medium"
                  )}
                >
                  <span className={twoLineClampClass}>{doc.title}</span>
                  {isOrgUser && !doc.is_published && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 shrink-0 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400"
                    >
                      Draft
                    </Badge>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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
      <ScrollArea className="flex-1">
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
        ) : getRootTopics().length === 0 && getProjectLevelDocuments().length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No pages found
          </div>
        ) : (
          <nav className="py-2 pr-3">
            {/* Root topics (hierarchical) */}
            {getRootTopics()
              .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
              .map(topic => renderTopic(topic, 0))}

            {/* Project-level documents (no topic) */}
            {getProjectLevelDocuments().map(doc => (
              <button
                key={doc.id}
                onClick={() => selectDocument(doc)}
                className={cn(
                  "flex min-w-0 items-start gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedDocument?.id === doc.id && "sidebar-item-selected font-medium"
                )}
              >
                <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="min-w-0 flex-1 text-left overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] leading-snug">
                  {doc.title}
                </span>
              </button>
            ))}
          </nav>
        )}
      </ScrollArea>

      {/* Footer - only show for internal users viewing non-public projects */}
      {user && selectedProject?.visibility !== "public" && (
        <div className="p-3 border-t border-border">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      )}
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
          documents={documents.map(d => ({
            id: d.id,
            title: d.title,
            project_id: d.project_id,
            topic_id: d.topic_id,
            content_html: d.published_content_html,
          }))}
          topics={topics.map(t => ({
            id: t.id,
            name: t.name,
            project_id: t.project_id,
          }))}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onProjectSelect={selectProject}
          onDocumentSelect={(docId) => {
            const doc = documents.find(d => d.id === docId);
            if (doc) selectDocument(doc);
          }}
          onTopicSelect={(topicId) => {
            const topic = topics.find(t => t.id === topicId);
            if (topic) {
              const project = projects.find(p => p.id === topic.project_id);
              if (project) selectProject(project);
            }
          }}
          onAskAI={() => setAskAIOpen(true)}
          isAuthenticated={!!user}
        />

        {/* Ask AI Dialog (landing page) */}
        <AskAIDialog open={askAIOpen} onOpenChange={setAskAIOpen} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col docs-branded">
      {/* Sticky Navigation Container */}
      <div className="sticky top-0 z-50">
        {/* Top Header */}
        <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 h-14 gap-2">
          {/* Left: Organization Logo/Name */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link to={currentOrg ? `/docs/${currentOrg.slug || currentOrg.domain}` : "/"} className="flex items-center gap-2">
              {currentOrg?.logo_url ? (
                <img src={currentOrg.logo_url} alt={currentOrg.name} className="h-7 sm:h-8 w-auto" />
              ) : (
                <FolderTree className="h-5 sm:h-6 w-5 sm:w-6 brand-primary-text" />
              )}
              <span className="font-bold text-base sm:text-lg text-foreground brand-heading truncate max-w-[120px] sm:max-w-none">
                {currentOrg?.name || "Documentation"}
              </span>
              {currentOrg?.tagline && (
                <span className="text-muted-foreground font-normal hidden lg:inline brand-body">{currentOrg.tagline}</span>
              )}
            </Link>
          </div>

          {/* Center: Search + Ask AI */}
          <div className="hidden sm:flex items-center gap-2 flex-1 max-w-xs md:max-w-md mx-2 md:mx-4">
            <SmartSearch
              placeholder="Search..."
              documents={documents.map(d => ({
                id: d.id,
                title: d.title,
                project_id: d.project_id,
                topic_id: d.topic_id,
                content_html: d.published_content_html,
              }))}
              topics={topics.map(t => ({
                id: t.id,
                name: t.name,
                project_id: t.project_id,
              }))}
              projects={projects.map(p => ({
                id: p.id,
                name: p.name,
              }))}
              primaryColor={currentOrg?.primary_color}
              showAIButton={selectedProject?.visibility === "public"}
              onAskAI={() => setAskAIOpen(true)}
              onSelect={(result) => {
                if (result.type === "project") {
                  const project = projects.find(p => p.id === result.id);
                  if (project) selectProject(project);
                } else if (result.type === "topic") {
                  const topic = topics.find(t => t.id === result.id);
                  if (topic) {
                    const project = projects.find(p => p.id === topic.project_id);
                    if (project) selectProject(project);
                  }
                } else if (result.type === "page") {
                  const doc = documents.find(d => d.id === result.id);
                  if (doc) selectDocument(doc);
                }
              }}
            />
          </div>

          {/* Right: Theme toggle + Auth buttons */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <ThemeToggle className="h-8 w-8 sm:h-9 sm:w-9" />
            {authLoading ? (
              <Skeleton className="h-8 w-16 sm:h-9 sm:w-24" />
            ) : user ? (
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-xs sm:text-sm">
                  <span className="hidden sm:inline">Dashboard</span>
                  <span className="sm:hidden">Dash</span>
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-xs sm:text-sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="hidden md:inline-flex" style={{ backgroundColor: currentOrg?.primary_color }}>
                    Create account
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile menu trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 sm:h-9 sm:w-9">
                  <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
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
          <div className="flex items-center justify-between">
            {/* Left: Project tabs - aligned with sidebar */}
            <div className="flex items-center gap-0 overflow-x-auto pl-3">
              {loading ? (
                <div className="flex gap-2 py-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-8 w-24" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="py-3 text-sm text-muted-foreground">No projects available</div>
              ) : (
                projects.map((project, index) => (
                  <button
                    key={project.id}
                    onClick={() => selectProject(project)}
                    className={cn(
                      "px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                      index === 0 && "pl-0",
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
            
            {/* Right: Developer Dropdown */}
            {(currentOrg?.openapi_spec_json || currentOrg?.openapi_spec_url || currentOrg?.mcp_enabled) && (
              <div className="flex items-center pr-3 lg:pr-6 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 sm:gap-1.5 text-muted-foreground hover:text-foreground px-2 sm:px-3">
                      <Code className="h-4 w-4" />
                      <span className="hidden sm:inline">Developer</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 bg-popover z-50">
                    {(currentOrg?.openapi_spec_json || currentOrg?.openapi_spec_url) && (
                      <DropdownMenuItem asChild>
                        <Link to={`/api/${currentOrg?.slug || currentOrg?.domain}`} className="cursor-pointer">
                          API Reference
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {currentOrg?.mcp_enabled && (
                      <DropdownMenuItem asChild>
                        <Link to={`/mcp/${currentOrg?.slug || currentOrg?.domain}`} className="cursor-pointer">
                          MCP Protocol
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar - Sticky */}
        {!sidebarCollapsed && (
          <aside className="hidden lg:flex w-64 border-r border-border flex-col bg-card sticky top-[104px] h-[calc(100vh-104px)] overflow-hidden">
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
            <div className="flex">
              {/* Article content */}
              <article className="flex-1 max-w-4xl mx-auto p-6 lg:p-8">
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
                </div>

                {/* Meta - show different info based on project visibility */}
                {selectedProject?.visibility === "public" ? (
                  /* Public docs: minimal metadata, no internal info */
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-8 pb-6 border-b border-border">
                    <CopyLinkButton className="ml-auto" />
                  </div>
                ) : (
                  /* Internal/External docs: full metadata */
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-8 pb-6 border-b border-border">
                    <span>Last updated: {format(new Date(selectedDocument.updated_at), "MMM d, yyyy")}</span>
                    <Badge variant="outline" className="text-xs">
                      {visibilityConfig[selectedProject?.visibility || selectedDocument.visibility].label}
                    </Badge>
                    {isOrgUser && selectedDocument.is_published && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800 dark:text-green-400">
                        Published
                      </Badge>
                    )}
                    <CopyLinkButton className="ml-auto" />
                  </div>
                )}

                {/* Content */}
                <div className="bg-card border border-border rounded-lg p-6 lg:p-8">
                  {documentHtml ? (
                    <div 
                      className="prose prose-neutral dark:prose-invert max-w-none docs-content"
                      dangerouslySetInnerHTML={{ __html: removeFirstHeadingIfMatches(normalizeHtml(documentHtml), selectedDocument.title) }}
                    />
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <p className="font-medium">This page hasn’t been published yet.</p>
                    </div>
                  )}
                </div>

                {/* Page Feedback - only for public docs pages */}
                {selectedDocument.published_content_html && selectedProject?.visibility === "public" && (
                  <PageFeedback documentId={selectedDocument.id} isOrgUser={isOrgUser} />
                )}
              </article>

              {/* Right sidebar - Table of Contents */}
              <aside className="hidden lg:block w-64 shrink-0 sticky top-28 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto p-4">
                <TableOfContents html={documentHtml} />
              </aside>
            </div>
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
