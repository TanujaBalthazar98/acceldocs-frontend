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
  PanelRightClose,
  Code,
  Maximize2,
  Minimize2,
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
  parent_id: string | null;
  mcp_enabled?: boolean | null;
  openapi_spec_json?: any;
  openapi_spec_url?: string | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  domain: string;
  custom_docs_domain: string | null;
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

export default function Docs({ mode }: { mode?: "public" | "internal" }) {
  const params = useParams<{ 
    orgSlug?: string; 
    projectSlug?: string; 
    topicSlug?: string;
    pageSlug?: string;
  }>();
  
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isInternalView = mode === "internal";
  const docsBasePath = isInternalView ? "/internal" : "/docs";
  
  // Track custom domain state early for URL interpretation
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  
  // On custom domains, URL structure shifts: org is implicit from domain
  // Standard: /docs/:orgSlug/:projectSlug/:topicSlug/:pageSlug
  // Internal: /internal/:orgSlug/:projectSlug/:topicSlug/:pageSlug
  // Custom domain: /docs/:projectSlug/:topicSlug/:pageSlug (or /internal for internal view)
  const orgSlug = isCustomDomain ? undefined : params.orgSlug;
  const projectSlug = isCustomDomain ? params.orgSlug : params.projectSlug;
  const topicSlug = isCustomDomain 
    ? (params.topicSlug ? params.projectSlug : undefined)
    : (params.pageSlug ? params.topicSlug : undefined);
  const pageSlug = isCustomDomain
    ? (params.topicSlug || params.projectSlug)
    : (params.pageSlug || params.topicSlug);
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
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [internalAccessDenied, setInternalAccessDenied] = useState(false);
  const [internalAccessReason, setInternalAccessReason] = useState<"signed_out" | "not_member" | null>(null);

  // Check for custom domain on mount
  useEffect(() => {
    const checkCustomDomain = async () => {
      const hostname = window.location.hostname;
      
      // Skip custom domain check for standard domains
      if (hostname === 'localhost' || hostname.includes('lovable.app') || hostname.includes('lovable.dev')) {
        return;
      }
      
      // Check if this hostname matches any organization's custom_docs_domain
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, name, slug, domain, custom_docs_domain, logo_url, tagline, primary_color, secondary_color, accent_color, font_heading, font_body, custom_css, hero_title, hero_description, show_search_on_landing, show_featured_projects, mcp_enabled, openapi_spec_json, openapi_spec_url")
        .eq("custom_docs_domain", hostname)
        .maybeSingle();
      
      if (orgData) {
        setCurrentOrg(orgData as Organization);
        setIsCustomDomain(true);
      }
    };
    
    checkCustomDomain();
  }, []);

  useEffect(() => {
    if (!authLoading && !hasFetched) {
      setHasFetched(true);
      fetchContent();
    }
  }, [authLoading, hasFetched]);

  const getDocumentHtml = (doc: Document) =>
    isInternalView ? (doc.content_html ?? doc.published_content_html) : doc.published_content_html;

  const setDocumentContent = async (doc: Document) => {
    setDocumentHtml(getDocumentHtml(doc) ?? null);
  };

  const buildDocUrl = (doc: Document, project: Project, org: Organization) => {
    const orgIdentifier = org.slug || org.domain;
    const topic = doc.topic_id ? topics.find(t => t.id === doc.topic_id) : null;
    
    // For custom domains, use simplified URLs without org prefix
    if (isCustomDomain) {
      if (topic?.slug) {
        return `${docsBasePath}/${project.slug}/${topic.slug}/${doc.slug}`;
      }
      return `${docsBasePath}/${project.slug}/${doc.slug}`;
    }
    
    if (topic?.slug) {
      return `${docsBasePath}/${orgIdentifier}/${project.slug}/${topic.slug}/${doc.slug}`;
    }
    return `${docsBasePath}/${orgIdentifier}/${project.slug}/${doc.slug}`;
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
  }, [projectSlug, projects, isCustomDomain]);

  // Helper to get the first available document for a project (considering display order)
  const getFirstDocumentForProject = (projectId: string) => {
    const projectDocs = documents.filter(d => d.project_id === projectId);
    if (projectDocs.length === 0) return null;
    
    // Sort by display_order, then by title
    return projectDocs.sort((a, b) => {
      const orderA = (a as any).display_order ?? Infinity;
      const orderB = (b as any).display_order ?? Infinity;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    })[0];
  };

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
        setDocumentContent(doc);
        if (doc.topic_id) {
          setExpandedTopics(prev => new Set([...prev, doc.topic_id!]));
        }
      }
    } else {
      // No page slug in URL - auto-select the first document
      const firstDoc = getFirstDocumentForProject(selectedProject.id);
      if (firstDoc && currentOrg) {
        navigate(buildDocUrl(firstDoc, selectedProject, currentOrg), { replace: true });
      }
    }
  }, [pageSlug, topicSlug, selectedProject, documents, topics, currentOrg]);

  const fetchContent = async () => {
    setLoading(true);
    setInternalAccessDenied(false);
    setInternalAccessReason(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;
      
      let userOrgId: string | null = null;
      let userProjectMemberships: string[] = [];
      
      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", currentUser.id)
          .single();
        
        userOrgId = profile?.organization_id || null;
        
        // Fetch projects the user has been invited to (for external access)
        const { data: memberships } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", currentUser.id);
        
        userProjectMemberships = memberships?.map(m => m.project_id) || [];
      }
      
      // Determine the target organization - from URL slug, custom domain, or user's org
      let targetOrgId: string | null = null;
      let targetOrg: Organization | null = currentOrg;
      
      // Load org from URL slug if not already loaded from custom domain
      if (orgSlug && !currentOrg && !isCustomDomain) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("id, name, slug, domain, custom_docs_domain, logo_url, tagline, primary_color, secondary_color, accent_color, font_heading, font_body, custom_css, hero_title, hero_description, show_search_on_landing, show_featured_projects, mcp_enabled, openapi_spec_json, openapi_spec_url")
          .or(`slug.eq.${orgSlug},domain.eq.${orgSlug}`)
          .maybeSingle();
        if (orgData) {
          targetOrg = orgData as Organization;
          setCurrentOrg(targetOrg);
        }
      }
      
      // Determine the organization to scope projects to
      if (targetOrg) {
        targetOrgId = targetOrg.id;
      } else if (currentOrg) {
        targetOrgId = currentOrg.id;
      } else if (userOrgId) {
        // Fallback to user's organization if no URL context
        targetOrgId = userOrgId;
        // Load org data if not already loaded
        if (!targetOrg) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("id, name, slug, domain, custom_docs_domain, logo_url, tagline, primary_color, secondary_color, accent_color, font_heading, font_body, custom_css, hero_title, hero_description, show_search_on_landing, show_featured_projects, mcp_enabled, openapi_spec_json, openapi_spec_url")
            .eq("id", userOrgId)
            .single();
          if (orgData) {
            targetOrg = orgData as Organization;
            setCurrentOrg(targetOrg);
          }
        }
      }
      
      // Set isOrgUser based on whether user belongs to the target organization
      const userBelongsToTargetOrg = currentUser && userOrgId && targetOrgId && userOrgId === targetOrgId;
      setIsOrgUser(!!userBelongsToTargetOrg);

      if (isInternalView && !userBelongsToTargetOrg) {
        setInternalAccessDenied(true);
        setInternalAccessReason(currentUser ? "not_member" : "signed_out");
        setProjects([]);
        setTopics([]);
        setDocuments([]);
        setSelectedProject(null);
        setSelectedDocument(null);
        setDocumentHtml(null);
        setLoading(false);
        return;
      }
      
      // If no organization context at all, show nothing (don't leak cross-org data)
      if (!targetOrgId) {
        setProjects([]);
        setLoading(false);
        return;
      }

      // Build project query scoped to the target organization
      let projectsQuery = supabase
        .from("projects")
        .select("id, name, slug, visibility, is_published, organization_id, parent_id, mcp_enabled, openapi_spec_json, openapi_spec_url")
        .eq("organization_id", targetOrgId);

      if (!isInternalView) {
        projectsQuery = projectsQuery.eq("is_published", true);
      }

      const { data: projectsData, error: projectsError } = await projectsQuery.order("name");

      if (projectsError) {
        console.error("Error fetching projects:", projectsError);
      } else if (projectsData) {
        // Filter projects based on visibility and user authentication
        const filteredProjects = projectsData.filter(project => {
          // PUBLIC projects: visible to everyone (no auth required)
          if (project.visibility === "public") return true;
          
          // For internal/external, user must be authenticated
          if (!currentUser) return false;
          
          // INTERNAL projects: only visible to org members
          if (project.visibility === "internal") {
            return userBelongsToTargetOrg;
          }
          
          // EXTERNAL projects: visible to org members OR users invited to this specific project
          if (project.visibility === "external") {
            return userBelongsToTargetOrg || userProjectMemberships.includes(project.id);
          }
          
          return false;
        });
        
        setProjects(filteredProjects);
        await fetchTopicsAndDocuments(filteredProjects.map(p => p.id), userOrgId, currentUser?.id || null);
      }
    } catch (error) {
      console.error("Error fetching content:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicsAndDocuments = async (projectIds: string[], userOrgId: string | null, userId: string | null) => {
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

    let docsQuery = supabase
      .from("documents")
      .select(
        "id, title, slug, google_doc_id, project_id, topic_id, visibility, is_published, content_html, published_content_html, created_at, updated_at, owner_id, display_order"
      )
      .in("project_id", projectIds);

    if (!isInternalView) {
      docsQuery = docsQuery.not("published_content_html", "is", null);
    }

    const { data: docsData, error: docsError } = await docsQuery
      .order("display_order")
      .order("title");

    if (docsError) {
      console.error("Error fetching documents:", docsError);
    } else if (docsData) {
      // Documents inherit visibility from their parent project
      // No additional filtering needed here since projects are already filtered
      setDocuments(docsData);
    }
  };

  const buildProjectUrl = (project: Project) => {
    if (isCustomDomain) return `${docsBasePath}/${project.slug}`;
    if (currentOrg) return `${docsBasePath}/${currentOrg.slug || currentOrg.domain}/${project.slug}`;
    return docsBasePath;
  };

  const getChildProjects = (projectId: string) =>
    projects
      .filter((p) => p.parent_id === projectId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

  const resolveProjectForNavigation = (project: Project) => {
    const children = getChildProjects(project.id);
    if (children.length === 0) return project;

    const childWithDocs = children.find((p) => documents.some((d) => d.project_id === p.id));
    return childWithDocs ?? children[0];
  };

  const selectProject = (project: Project, opts?: { replace?: boolean }) => {
    const target = resolveProjectForNavigation(project);

    setSelectedProject(target);
    setSelectedDocument(null);
    setDocumentHtml(null);

    if (target.slug) {
      navigate(buildProjectUrl(target), opts?.replace ? { replace: true } : undefined);
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
    setDocumentContent(doc);
    if (selectedProject && currentOrg) {
      navigate(buildDocUrl(doc, selectedProject, currentOrg));
    }
    setMobileMenuOpen(false);
  };

  const getDocsLandingPath = () => {
    if (isCustomDomain) return docsBasePath;
    if (currentOrg) return `${docsBasePath}/${currentOrg.slug || currentOrg.domain}`;
    return docsBasePath;
  };

  const goToDocsLanding = () => {
    setSelectedProject(null);
    setSelectedDocument(null);
    setExpandedTopics(new Set());
    setDocumentHtml(null);
    setMobileMenuOpen(false);
    navigate(getDocsLandingPath());
  };

  // If a root project is selected but only its sub-projects contain pages,
  // automatically forward to the first sub-project with published pages.
  useEffect(() => {
    if (!selectedProject) return;
    if (loading) return;
    if (pageSlug) return;

    const hasDocs = documents.some((d) => d.project_id === selectedProject.id);
    if (hasDocs) return;

    const children = projects
      .filter((p) => p.parent_id === selectedProject.id)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    if (children.length === 0) return;

    const target = children.find((p) => documents.some((d) => d.project_id === p.id)) ?? children[0];

    if (target.id === selectedProject.id) return;

    setSelectedProject(target);
    setSelectedDocument(null);
    setDocumentHtml(null);
    if (target.slug) navigate(buildProjectUrl(target), { replace: true });
  }, [selectedProject, projects, documents, loading, pageSlug, isCustomDomain, currentOrg]);

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
    filteredDocuments
      .filter(d => d.topic_id === topicId)
      .sort((a, b) => ((a as any).display_order ?? 0) - ((b as any).display_order ?? 0));

  const getProjectLevelDocuments = () =>
    filteredDocuments
      .filter(d => !d.topic_id)
      .sort((a, b) => ((a as any).display_order ?? 0) - ((b as any).display_order ?? 0));

  // Check if a topic should be "invisible" (same name as project, only root topic)
  const isInvisibleTopic = (topic: Topic) => {
    if (!selectedProject) return false;
    if (topic.parent_id) return false; // Only check root topics
    
    // Root topic with same name as project AND it's the only root topic
    const rootTopics = projectTopics.filter(t => !t.parent_id);
    const nameMatch = topic.name.toLowerCase().trim() === selectedProject.name.toLowerCase().trim();
    
    return nameMatch && rootTopics.length === 1;
  };

  // Get documents from invisible topics (treat them as project-level)
  const getInvisibleTopicDocuments = () => {
    const invisibleTopics = projectTopics.filter(isInvisibleTopic);
    if (invisibleTopics.length === 0) return [];
    return filteredDocuments
      .filter(d => invisibleTopics.some(t => t.id === d.topic_id))
      .sort((a, b) => ((a as any).display_order ?? 0) - ((b as any).display_order ?? 0));
  };

  const twoLineClampClass =
    "min-w-0 flex-1 text-left overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] leading-snug";

  // Recursive topic renderer component
  const renderTopic = (topic: Topic, depth: number = 0) => {
    // Skip rendering invisible topics (handled separately)
    if (isInvisibleTopic(topic)) return null;

    const topicDocs = getTopicDocuments(topic.id);
    const childTopics = getChildTopics(topic.id);
    const isTopicExpanded = expandedTopics.has(topic.id);
    const hasChildren = topicDocs.length > 0 || childTopics.length > 0;

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
        ) : getRootTopics().filter(t => !isInvisibleTopic(t)).length === 0 && getProjectLevelDocuments().length === 0 && getInvisibleTopicDocuments().length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No pages found
          </div>
        ) : (
          <nav className="py-2 pr-3">
            {/* Root topics (hierarchical) - excluding invisible topics */}
            {getRootTopics()
              .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
              .map(topic => renderTopic(topic, 0))}

            {/* Documents from invisible topics (shown as if project-level) */}
            {getInvisibleTopicDocuments().map(doc => (
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
                <span className={twoLineClampClass}>
                  {doc.title}
                </span>
              </button>
            ))}

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
                <span className={twoLineClampClass}>
                  {doc.title}
                </span>
              </button>
            ))}
          </nav>
        )}
      </ScrollArea>

      {/* Footer - show Dashboard link ONLY for authenticated org members viewing non-public content */}
      {user && isOrgUser && selectedProject?.visibility !== "public" && (
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
  if (internalAccessDenied && isInternalView) {
    const orgDomain = currentOrg?.domain;
    const publicDocsPath = isCustomDomain
      ? "/docs"
      : currentOrg
        ? `/docs/${currentOrg.slug || currentOrg.domain}`
        : "/docs";

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 docs-branded">
        <div className="max-w-lg w-full rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Internal docs only</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {internalAccessReason === "signed_out"
              ? `Sign in${orgDomain ? ` with your @${orgDomain} account` : ""} to access internal docs.`
              : `This workspace is restricted to${orgDomain ? ` @${orgDomain}` : ""} accounts.`}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Link to="/auth">
              <Button size="sm">Sign in</Button>
            </Link>
            <Link to={publicDocsPath}>
              <Button variant="ghost" size="sm">View public docs</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (showLandingPage) {
    return (
      <div className="min-h-screen bg-background flex flex-col docs-branded">
        {/* Minimal Header */}
        <header className="border-b border-border bg-card">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14">
            <Link
              to={isCustomDomain ? docsBasePath : `${docsBasePath}/${currentOrg.slug || currentOrg.domain}`}
              onClick={(e) => {
                e.preventDefault();
                goToDocsLanding();
              }}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              {currentOrg.logo_url ? (
                <img src={currentOrg.logo_url} alt={currentOrg.name} className="h-8 w-auto" />
              ) : (
                <FolderTree className="h-6 w-6 brand-primary-text" />
              )}
              <span className="font-bold text-lg text-foreground brand-heading">{currentOrg.name}</span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {/* Hide Dashboard on landing when all visible projects are public */}
              {isInternalView && currentOrg ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigate(isCustomDomain ? "/docs" : `/docs/${currentOrg.slug || currentOrg.domain}`);
                  }}
                >
                  Public Docs
                </Button>
              ) : !isInternalView && user && isOrgUser && projects.some(p => p.visibility !== "public") ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (currentOrg) {
                      navigate(isCustomDomain ? "/internal" : `/internal/${currentOrg.slug || currentOrg.domain}`);
                    }
                  }}
                >
                  Internal Docs
                </Button>
              ) : null}
              {user && isOrgUser && projects.some(p => p.visibility !== "public") ? (
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
              ) : !user && projects.some(p => p.visibility !== "public") ? (
                /* Show Sign in for unauthenticated users viewing internal/external docs */
                <>
                  <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
                  <Link to="/auth"><Button size="sm" className="brand-primary-bg text-white">Create account</Button></Link>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <DocsLanding
          organization={currentOrg}
          projects={projects.filter(p => !p.parent_id).map(p => ({ ...p, description: null }))}
          documents={documents.map(d => ({
            id: d.id,
            title: d.title,
            project_id: d.project_id,
            topic_id: d.topic_id,
            content_html: getDocumentHtml(d) ?? undefined,
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
          isOrgMember={isOrgUser}
          hasNonPublicContent={projects.some(p => p.visibility !== "public")}
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
          {/* Left: Organization Logo/Name + Root Project */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to={currentOrg ? (isCustomDomain ? docsBasePath : `${docsBasePath}/${currentOrg.slug || currentOrg.domain}`) : "/"}
              onClick={(e) => {
                e.preventDefault();
                goToDocsLanding();
              }}
              className="flex items-center gap-2"
            >
              {currentOrg?.logo_url ? (
                <img src={currentOrg.logo_url} alt={currentOrg.name} className="h-7 sm:h-8 w-auto" />
              ) : (
                <FolderTree className="h-5 sm:h-6 w-5 sm:w-6 brand-primary-text" />
              )}
              <span className="font-bold text-base sm:text-lg text-foreground brand-heading truncate max-w-[120px] sm:max-w-none">
                {currentOrg?.name || "Documentation"}
              </span>
            </Link>
            {/* Root project name displayed near logo */}
            {(() => {
              const rootProject = projects.find(p => !p.parent_id);
              if (rootProject && selectedProject) {
                const displayProject = selectedProject.parent_id 
                  ? projects.find(p => p.id === selectedProject.parent_id) 
                  : selectedProject;
                if (displayProject) {
                  return (
                    <span className="text-muted-foreground font-medium text-sm sm:text-base hidden sm:inline">
                      / {displayProject.name}
                    </span>
                  );
                }
              }
              return null;
            })()}
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
                content_html: getDocumentHtml(d) ?? undefined,
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
            ) : user && isOrgUser && selectedProject?.visibility !== "public" ? (
              /* Only show Dashboard for authenticated org users on non-public content */
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-xs sm:text-sm">
                  <span className="hidden sm:inline">Dashboard</span>
                  <span className="sm:hidden">Dash</span>
                </Button>
              </Link>
            ) : !user && selectedProject?.visibility !== "public" ? (
              /* Only show auth options if current project is not public (requires login) */
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
            ) : null}

            {currentOrg && isInternalView ? (
              <Button
                variant="ghost"
                size="sm"
                className="px-2 sm:px-3 text-xs sm:text-sm gap-1.5"
                onClick={() => {
                  navigate(isCustomDomain ? "/docs" : `/docs/${currentOrg.slug || currentOrg.domain}`);
                }}
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Public Docs</span>
              </Button>
            ) : !isInternalView && user && isOrgUser && projects.some(p => p.visibility !== "public") ? (
              <Button
                variant="ghost"
                size="sm"
                className="px-2 sm:px-3 text-xs sm:text-sm gap-1.5"
                onClick={() => {
                  if (currentOrg) {
                    navigate(isCustomDomain ? "/internal" : `/internal/${currentOrg.slug || currentOrg.domain}`);
                  }
                }}
              >
                <Lock className="h-4 w-4" />
                <span className="hidden sm:inline">Internal Docs</span>
              </Button>
            ) : null}

            {/* Mobile menu trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 sm:h-9 sm:w-9">
                  <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 docs-branded">
                {sidebarContent}
              </SheetContent>
            </Sheet>
          </div>
        </div>
        </header>

        {/* Sub-Project Tabs Bar - Only show if there are sub-projects */}
        {(() => {
          const selectedRoot = selectedProject?.parent_id
            ? projects.find((p) => p.id === selectedProject.parent_id) ?? null
            : selectedProject;

          const subProjects = selectedRoot ? projects.filter((p) => p.parent_id === selectedRoot.id) : [];
          const hasSubProjects = subProjects.length > 0;

          return hasSubProjects ? (
            <div className="border-b border-border bg-card">
              <div className="flex items-center justify-between">
                {/* Left: Sub-project tabs */}
                <div className="flex items-center gap-0 overflow-x-auto pl-3">
                  {loading ? (
                    <div className="flex gap-2 py-2">
                      {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-8 w-24" />
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* Sub-project tabs only (root project is shown in header) */}
                      {subProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => selectProject(project)}
                          className={cn(
                            "px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                            selectedProject?.id === project.id
                              ? "text-foreground"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                          )}
                          style={selectedProject?.id === project.id ? {
                            borderColor: currentOrg?.primary_color || 'hsl(var(--primary))'
                          } : undefined}
                        >
                          {project.name}
                        </button>
                      ))}
                    </>
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
          ) : null;
        })()}
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
              <article className={cn(
                "flex-1 px-4 py-6 sm:px-6 lg:p-8 transition-all duration-300 min-w-0 overflow-x-hidden",
                isFullWidth ? "max-w-none lg:px-16" : "max-w-4xl mx-auto"
              )}>
                {/* Breadcrumb and controls */}
                <div className="flex items-center justify-between mb-6">
                  <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{selectedProject?.name}</span>
                    {selectedDocument.topic_id && (() => {
                      const topic = topics.find(t => t.id === selectedDocument.topic_id);
                      if (topic && !isInvisibleTopic(topic)) {
                        return (
                          <>
                            <ChevronRight className="h-3 w-3" />
                            <span>{topic.name}</span>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </nav>
                  
                  {/* Expand/Collapse button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFullWidth(!isFullWidth)}
                    className="hidden lg:flex gap-2 text-muted-foreground hover:text-foreground"
                  >
                    {isFullWidth ? (
                      <>
                        <Minimize2 className="h-4 w-4" />
                        <span className="text-xs">Compact</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-4 w-4" />
                        <span className="text-xs">Expand</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Title */}
                <div className="flex items-start gap-3 mb-4">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground brand-heading break-words">
                    {selectedDocument.title}
                  </h1>
                </div>

                {/* Meta - show different info based on project visibility */}
                {selectedProject?.visibility === "public" ? (
                  /* Public docs: minimal metadata, no internal info */
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-border">
                    <CopyLinkButton className="ml-auto" />
                  </div>
                ) : (
                  /* Internal/External docs: full metadata */
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-border">
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

                {/* Content - clean rendering */}
                {documentHtml ? (
                  <div 
                    className="prose prose-sm sm:prose-base lg:prose-lg prose-neutral dark:prose-invert max-w-none docs-content overflow-x-hidden"
                    dangerouslySetInnerHTML={{ __html: removeFirstHeadingIfMatches(normalizeHtml(documentHtml), selectedDocument.title) }}
                  />
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="font-medium">
                      {isInternalView ? "This page doesn't have content yet." : "This page hasn't been published yet."}
                    </p>
                  </div>
                )}

                {/* Page Feedback - only for public docs pages */}
                {!isInternalView && selectedDocument.published_content_html && selectedProject?.visibility === "public" && (
                  <PageFeedback documentId={selectedDocument.id} isOrgUser={isOrgUser} />
                )}
              </article>

              {/* Right sidebar - Table of Contents (hide in full width mode) */}
              {!isFullWidth && (
                <aside className="hidden lg:block w-64 shrink-0 sticky top-28 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto p-4">
                  <TableOfContents html={documentHtml} />
                </aside>
              )}
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
