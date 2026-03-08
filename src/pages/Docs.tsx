import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  ChevronRight,
  FolderTree,
  Menu,
  Lock,
  Eye,
  Globe,
  Sparkles,
  PanelRightClose,
  Code,
  Maximize2,
  Minimize2,
  WifiOff,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { auth } from "@/lib/api/auth";
import { strapiFetch } from "@/lib/api/client";
import { invokeFunction } from "@/lib/api/functions";
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
import { VideoEmbed } from "@/components/docs/VideoEmbed";
import { ThemeToggle } from "@/components/docs/ThemeToggle";
import { VersionSwitcher } from "@/components/docs/VersionSwitcher";
import { SmartSearch } from "@/components/SmartSearch";
import { normalizeHtml } from "@/lib/htmlNormalizer";
import { isLikelyMarkdown, renderMarkdownToHtml, stripFirstMarkdownHeading, stripFrontmatter } from "@/lib/markdown";
import { captureDocView } from "@/lib/analytics/posthog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import type { Document, Project, ProjectVersion, Topic, VisibilityLevel } from "@/components/docs/types";


interface Organization {
  id: string;
  name: string;
  slug: string | null;
  domain: string;
  custom_docs_domain: string | null;
  drive_folder_id?: string | null;
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

const normalizeHostname = (value?: string | null) =>
  (value || "").replace(/^www\./i, "").toLowerCase();

const orgCacheById = new Map<string, Organization>();
const orgCacheBySlug = new Map<string, Organization>();
const orgCacheByDomain = new Map<string, Organization>();

const cacheOrganization = (org: Organization) => {
  if (!org?.id) return;
  orgCacheById.set(org.id, org);
  if (org.slug) {
    orgCacheBySlug.set(org.slug.toLowerCase(), org);
  }
  if (org.domain) {
    orgCacheByDomain.set(normalizeHostname(org.domain), org);
  }
  if (org.custom_docs_domain) {
    orgCacheByDomain.set(normalizeHostname(org.custom_docs_domain), org);
  }
};

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

/**
 * Strip YAML/TOML frontmatter that has been rendered as HTML by Google Docs.
 * Matches a block starting with a "---" paragraph followed by "key: value"
 * paragraphs until a closing "---" paragraph.
 */
function stripHtmlFrontmatter(html: string): string {
  if (!html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLElement | null;
  if (!container) return html;

  const children = Array.from(container.children);
  if (children.length < 2) return html;

  // Check if the first element's text is "---"
  const firstText = (children[0].textContent || "").trim();
  if (firstText !== "---" && firstText !== "+++") return html;

  // Find the closing "---" or "+++" element
  const delimiter = firstText;
  let closingIndex = -1;
  for (let i = 1; i < children.length; i++) {
    const text = (children[i].textContent || "").trim();
    if (text === delimiter) {
      closingIndex = i;
      break;
    }
    // If we find something that doesn't look like frontmatter (key: value),
    // and it's not empty, stop searching
    if (text && !text.includes(":") && text !== delimiter) break;
  }

  if (closingIndex === -1) return html;

  // Also remove the "---published" line if it follows (common pattern)
  let removeUntil = closingIndex;
  if (removeUntil + 1 < children.length) {
    const nextText = (children[removeUntil + 1].textContent || "").trim();
    if (nextText.startsWith("---") || nextText.startsWith("+++")) {
      removeUntil++;
    }
  }

  // Remove frontmatter elements
  for (let i = removeUntil; i >= 0; i--) {
    children[i].remove();
  }

  return container.innerHTML;
}

function resolveDocumentHtml(html: string, title: string): string {
  // Strip raw YAML/TOML frontmatter (for markdown content)
  const withoutFrontmatter = stripFrontmatter(html);

  if (isLikelyMarkdown(withoutFrontmatter)) {
    const stripped = stripFirstMarkdownHeading(withoutFrontmatter, title);
    return normalizeHtml(renderMarkdownToHtml(stripped));
  }

  // For HTML content, strip frontmatter rendered as HTML elements
  const cleaned = stripHtmlFrontmatter(withoutFrontmatter);
  return removeFirstHeadingIfMatches(normalizeHtml(cleaned), title);
}

export default function Docs({ mode }: { mode?: "public" | "internal" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isInternalView = mode === "internal";
  const docsBasePath = isInternalView ? "/internal" : "/docs";

  const unwrapStrapiEntity = <T extends Record<string, any>>(entity: T | null | undefined): T | null => {
    if (!entity) return null;
    if ((entity as any).attributes) {
      return { id: (entity as any).id, ...(entity as any).attributes } as T;
    }
    return entity;
  };

  const mapOrganization = (row: any): Organization => {
    const attrs = row?.attributes || row || {};
    const mapped: Organization = {
      id: String(row?.id ?? attrs.id),
      name: attrs.name || "",
      slug: attrs.slug ?? null,
      domain: attrs.domain || "",
      custom_docs_domain: attrs.custom_docs_domain ?? null,
      drive_folder_id: attrs.drive_folder_id ?? null,
      logo_url: attrs.logo_url ?? null,
      tagline: attrs.tagline ?? null,
      primary_color: attrs.primary_color || "",
      secondary_color: attrs.secondary_color || "",
      accent_color: attrs.accent_color || "",
      font_heading: attrs.font_heading || "",
      font_body: attrs.font_body || "",
      custom_css: attrs.custom_css ?? null,
      hero_title: attrs.hero_title ?? null,
      hero_description: attrs.hero_description ?? null,
      show_search_on_landing: attrs.show_search_on_landing ?? true,
      show_featured_projects: attrs.show_featured_projects ?? true,
      mcp_enabled: attrs.mcp_enabled ?? null,
      openapi_spec_json: attrs.openapi_spec_json ?? null,
      openapi_spec_url: attrs.openapi_spec_url ?? null,
    };
    cacheOrganization(mapped);
    return mapped;
  };

  const mapProject = (row: any): Project => {
    const attrs = row?.attributes || row || {};
    const parentRaw =
      attrs.parent?.data?.id ??
      attrs.parent?.id ??
      attrs.parent_id ??
      attrs.parent ??
      null;
    const orgRaw =
      attrs.organization?.data?.id ??
      attrs.organization?.id ??
      attrs.organization_id ??
      attrs.organization ??
      "";
    return {
      id: String(row?.id ?? attrs.id),
      name: attrs.name || "",
      slug: attrs.slug ?? null,
      visibility: attrs.visibility ?? "internal",
      is_published: !!attrs.is_published,
      drive_folder_id: attrs.drive_folder_id ?? null,
      drive_parent_id: attrs.drive_parent_id ?? null,
      organization_id: orgRaw ? String(orgRaw) : "",
      parent_id:
        parentRaw && parentRaw !== "null" && parentRaw !== "undefined" ? String(parentRaw) : null,
      mcp_enabled: attrs.mcp_enabled ?? null,
      openapi_spec_json: attrs.openapi_spec_json ?? null,
      openapi_spec_url: attrs.openapi_spec_url ?? null,
      show_version_switcher: attrs.show_version_switcher ?? true,
    };
  };

  const dedupeProjects = (rows: Project[]) => {
    const normalizeName = (value: string) => value.trim().toLowerCase();
    const byDrive = new Map<string, Project>();
    const byNameParent = new Map<string, Project>();

    for (const project of rows) {
      if (project.drive_folder_id) {
        const existing = byDrive.get(project.drive_folder_id);
        if (!existing || (!existing.parent_id && project.parent_id)) {
          byDrive.set(project.drive_folder_id, project);
        }
        continue;
      }
      const key = `${project.parent_id || "root"}::${normalizeName(project.name)}`;
      if (!byNameParent.has(key)) {
        byNameParent.set(key, project);
      }
    }

    return [...byDrive.values(), ...byNameParent.values()].filter(
      (p, idx, arr) => arr.findIndex((other) => other.id === p.id) === idx
    );
  };

  const getDocumentDedupeKey = (doc: Document) => {
    const version = doc.project_version_id || "none";
    const project = doc.project_id || "none";
    if (doc.google_doc_id) {
      return `gdoc:${doc.google_doc_id}:v:${version}:p:${project}`;
    }
    return `id:${doc.id}:v:${version}:p:${project}`;
  };

  const mapVersion = (row: any): ProjectVersion => {
    const attrs = row?.attributes || row || {};
    const projectRaw =
      attrs.project?.data?.id ??
      attrs.project?.id ??
      attrs.project_id ??
      attrs.project ??
      "";
    return {
      id: String(row?.id ?? attrs.id),
      project_id: projectRaw ? String(projectRaw) : "",
      name: attrs.name || "",
      slug: attrs.slug || "",
      is_default: !!attrs.is_default,
      is_published: !!attrs.is_published,
      semver_major: Number(attrs.semver_major ?? 0),
      semver_minor: Number(attrs.semver_minor ?? 0),
      semver_patch: Number(attrs.semver_patch ?? 0),
    };
  };

  const mapTopic = (row: any): Topic => {
    const attrs = row?.attributes || row || {};
    const projectRaw =
      attrs.project?.data?.id ??
      attrs.project?.id ??
      attrs.project_id ??
      attrs.project ??
      null;
    const versionRaw =
      attrs.project_version?.data?.id ??
      attrs.project_version?.id ??
      attrs.project_version_id ??
      attrs.project_version ??
      null;
    const parentRaw =
      attrs.parent?.data?.id ??
      attrs.parent?.id ??
      attrs.parent_id ??
      attrs.parent ??
      null;
    return {
      id: String(row?.id ?? attrs.id),
      name: attrs.name || "",
      slug: attrs.slug ?? null,
      project_id: projectRaw ? String(projectRaw) : "",
      project_version_id: versionRaw ? String(versionRaw) : null,
      parent_id: parentRaw ? String(parentRaw) : null,
      display_order: attrs.display_order ?? null,
    };
  };

  const mapDocument = (row: any): Document => {
    const attrs = row?.attributes || row || {};
    const contentHtml = attrs.content_html ?? attrs.contentHtml ?? null;
    const publishedContentHtml = attrs.published_content_html ?? attrs.publishedContentHtml ?? null;
    const contentId = attrs.content_id ?? attrs.contentId ?? null;
    const publishedContentId = attrs.published_content_id ?? attrs.publishedContentId ?? null;
    const projectRaw =
      attrs.project?.data?.id ??
      attrs.project?.id ??
      attrs.project_id ??
      attrs.project ??
      null;
    const versionRaw =
      attrs.project_version?.data?.id ??
      attrs.project_version?.id ??
      attrs.project_version_id ??
      attrs.project_version ??
      null;
    const topicRaw =
      attrs.topic?.data?.id ??
      attrs.topic?.id ??
      attrs.topic_id ??
      attrs.topic ??
      null;
    const ownerRaw =
      attrs.owner?.data?.id ??
      attrs.owner?.id ??
      attrs.owner_id ??
      attrs.owner ??
      null;
    return {
      id: String(row?.id ?? attrs.id),
      title: attrs.title || "",
      slug: attrs.slug ?? null,
      google_doc_id: attrs.google_doc_id || "",
      project_id: projectRaw ? String(projectRaw) : "",
      project_version_id: versionRaw ? String(versionRaw) : null,
      topic_id: topicRaw ? String(topicRaw) : null,
      visibility: attrs.visibility ?? "internal",
      is_published: !!attrs.is_published,
      content_html: contentHtml,
      published_content_html: publishedContentHtml,
      content_id: contentId,
      published_content_id: publishedContentId,
      video_url: attrs.video_url ?? null,
      video_title: attrs.video_title ?? null,
      created_at: attrs.createdAt || attrs.created_at || "",
      updated_at: attrs.updatedAt || attrs.updated_at || "",
      owner_id: ownerRaw ? String(ownerRaw) : null,
    };
  };
  
  // Track custom domain state early for URL interpretation
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [isImplicitOrgPath, setIsImplicitOrgPath] = useState(false);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [githubPagesUrl, setGithubPagesUrl] = useState<string | null>(null);
  const [githubSettingsChecked, setGithubSettingsChecked] = useState(false);

  // Fetch GitHub Pages URL and redirect unauthenticated visitors to the public Zensical site.
  // Authenticated users (internal team) stay on the AccelDocs viewer but get the pagesUrl
  // stored in state so the header can show an "External Site" link.
  useEffect(() => {
    const checkGitHubRedirect = async () => {
      if (!currentOrg?.id) return;
      try {
        const { apiFetch } = await import("@/lib/api/client");
        const { data } = await apiFetch<{ ok: boolean; connected: boolean; pagesUrl?: string }>(
          `/api/github/settings/${currentOrg.id}`
        );
        if (data?.ok && data.connected && data.pagesUrl) {
          setGithubPagesUrl(data.pagesUrl);
          // Only redirect unauthenticated visitors on the public docs route.
          if (!user && !isInternalView) {
            window.location.href = data.pagesUrl;
          }
        }
      } catch {
        // Silently fail — stay on AccelDocs viewer
      } finally {
        setGithubSettingsChecked(true);
      }
    };

    if (currentOrg?.id && !isCustomDomain && !authLoading) {
      checkGitHubRedirect();
    }
  }, [currentOrg?.id, isCustomDomain, user, authLoading, isInternalView]);
  
  // On custom domains, URL structure shifts: org is implicit from domain
  // Standard: /docs/:orgSlug/:projectSlug/:versionSlug/:topicSlug/:pageSlug
  // Internal: /internal/:orgSlug/:projectSlug/:versionSlug/:topicSlug/:pageSlug
  // Custom domain: /docs/:projectSlug/:versionSlug/:topicSlug/:pageSlug (or /internal for internal view)
  const pathSegments = useMemo(() => {
    const normalized = location.pathname.replace(/\/+$/, "");
    const base = docsBasePath === "/" ? "" : docsBasePath;
    if (normalized.startsWith(base)) {
      return normalized.slice(base.length).split("/").filter(Boolean);
    }
    return normalized.split("/").filter(Boolean);
  }, [location.pathname, docsBasePath]);

  const orgSegmentMatchesCurrent = !!(
    !isCustomDomain &&
    currentOrg &&
    pathSegments[0] &&
    (pathSegments[0] === currentOrg.slug ||
      normalizeHostname(pathSegments[0]) === normalizeHostname(currentOrg.domain))
  );
  const orgPathOffset = isCustomDomain ? 0 : (isImplicitOrgPath && !orgSegmentMatchesCurrent ? 0 : 1);
  const orgSlug = orgPathOffset === 1 ? pathSegments[0] : undefined;
  const projectSlug = pathSegments[orgPathOffset];
  const remainingSegments = pathSegments.slice(orgPathOffset + 1);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([]);

  const versionSlug = useMemo(() => {
    if (!projectSlug || remainingSegments.length === 0) return undefined;
    const project = projects.find(p => p.slug === projectSlug);
    if (!project) return undefined;
    const candidate = remainingSegments[0];
    
    // Check project and its ancestors for versions that match the slug
    let currentId: string | null = project.id;
    while (currentId) {
      const versions = projectVersions.filter(v => v.project_id === currentId);
      if (versions.some(v => v.slug === candidate)) return candidate;
      const p = projects.find(proj => proj.id === currentId);
      currentId = p?.parent_id || null;
    }
    
    return undefined;
  }, [projectSlug, remainingSegments, projects, projectVersions]);

  const contentSegments = useMemo(
    () => (versionSlug ? remainingSegments.slice(1) : remainingSegments),
    [versionSlug, remainingSegments]
  );

  const topicSlug = contentSegments.length > 1 ? contentSegments[0] : undefined;
  const pageSlug = contentSegments.length > 0 ? contentSegments[contentSegments.length - 1] : undefined;
  const { theme } = useTheme();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ProjectVersion | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [documentHtml, setDocumentHtml] = useState<string | null>(null);
  const resolvedDocumentHtml = useMemo(() => {
    if (!documentHtml || !selectedDocument?.title) return null;
    return resolveDocumentHtml(documentHtml, selectedDocument.title);
  }, [documentHtml, selectedDocument?.title]);
  const [isOrgUser, setIsOrgUser] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [askAIOpen, setAskAIOpen] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [internalAccessDenied, setInternalAccessDenied] = useState(false);
  const [internalAccessReason, setInternalAccessReason] = useState<"signed_out" | "not_member" | null>(null);
  const [useClientSideFilters, setUseClientSideFilters] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOffline(!navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const selectedRootProject = useMemo(() => {
    if (!selectedProject) return null;
    return selectedProject.parent_id
      ? projects.find((p) => p.id === selectedProject.parent_id) ?? selectedProject
      : selectedProject;
  }, [selectedProject, projects]);

  const subProjects = useMemo(() => {
    if (!selectedRootProject) return [];
    return projects.filter((p) => p.parent_id === selectedRootProject.id);
  }, [projects, selectedRootProject]);

  const hasSubProjects = subProjects.length > 0;

  const getProjectVersions = (projectId: string) => {
    let currentId: string | null = projectId;
    let versions: ProjectVersion[] = [];
    
    // Find closest project in hierarchy that HAS versions
    while (currentId) {
      const v = projectVersions.filter(pv => pv.project_id === currentId);
      if (v.length > 0) {
        versions = v;
        break;
      }
      const p = projects.find(proj => proj.id === currentId);
      currentId = p?.parent_id || null;
    }

    return isInternalView ? versions : versions.filter(v => v.is_published);
  };

  const getHighestSemverVersion = (versions: ProjectVersion[]) =>
    versions
      .slice()
      .sort((a, b) => {
        if (a.semver_major !== b.semver_major) return b.semver_major - a.semver_major;
        if (a.semver_minor !== b.semver_minor) return b.semver_minor - a.semver_minor;
        return b.semver_patch - a.semver_patch;
      })[0] ?? null;

  const resolveDefaultVersion = (projectId: string, versionSlugOverride?: string) => {
    const versions = getProjectVersions(projectId);
    if (versions.length === 0) return null;

    if (versionSlugOverride) {
      const match = versions.find(v => v.slug === versionSlugOverride);
      if (match) return match;
    }

    const defaultVersion = versions.find(v => v.is_default);
    if (defaultVersion) return defaultVersion;

    const publishedVersions = versions.filter(v => v.is_published);
    return getHighestSemverVersion(publishedVersions) ?? getHighestSemverVersion(versions);
  };

  const getVersionById = (versionId?: string | null) =>
    versionId ? projectVersions.find(v => v.id === versionId) ?? null : null;

  // Check for custom domain on mount
  useEffect(() => {
    const checkCustomDomain = async () => {
      const hostname = window.location.hostname;
      const standardHosts = new Set(["localhost", "127.0.0.1", "docspeare.com", "www.docspeare.com"]);

      // Skip custom domain check for standard domains
      if (standardHosts.has(hostname) || hostname.endsWith(".vercel.app")) {
        return;
      }
      
      // Check if this hostname matches any organization's custom_docs_domain
      const { data, error } = await strapiFetch<{ data: any[] }>(
        `/api/organizations?filters[custom_docs_domain][$eq]=${encodeURIComponent(hostname)}&pagination[limit]=1`
      );
      if (!error && data?.data?.[0]) {
        const org = mapOrganization(data.data[0]);
        setCurrentOrg(org);
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
    isInternalView
      ? (doc.content_html ?? doc.published_content_html)
      : (doc.published_content_html ?? doc.content_html);

  const setDocumentContent = async (doc: Document) => {
    setDocumentHtml(getDocumentHtml(doc) ?? null);
  };

  useEffect(() => {
    if (!selectedDocument || !selectedProject) return;

    captureDocView({
      documentId: selectedDocument.id,
      documentTitle: selectedDocument.title,
      documentSlug: selectedDocument.slug,
      projectId: selectedProject.id,
      projectSlug: selectedProject.slug,
      organizationId: currentOrg?.id ?? null,
      organizationSlug: currentOrg?.slug ?? currentOrg?.domain ?? null,
      visibility: selectedProject.visibility,
      isInternalView,
    });
  }, [
    selectedDocument?.id,
    selectedDocument?.slug,
    selectedDocument?.title,
    selectedProject?.id,
    selectedProject?.slug,
    selectedProject?.visibility,
    currentOrg?.id,
    currentOrg?.slug,
    currentOrg?.domain,
    isInternalView,
  ]);

  const getOrgPathPrefixForBase = (basePath: string, org?: Organization | null) => {
    if (isCustomDomain || isImplicitOrgPath || !org) return basePath;
    const orgIdentifier = org.slug || org.domain;
    return orgIdentifier ? `${basePath}/${orgIdentifier}` : basePath;
  };

  const getOrgPathPrefix = (org?: Organization | null) =>
    getOrgPathPrefixForBase(docsBasePath, org);

  const buildDocUrl = (doc: Document, project: Project, org: Organization) => {
    const orgPrefix = getOrgPathPrefix(org);
    const topic = doc.topic_id ? topics.find(t => t.id === doc.topic_id) : null;
    const version = getVersionById(doc.project_version_id) || selectedVersion;
    // Only include version slug in URL when there are multiple published versions,
    // otherwise it causes unnecessary version filtering that can hide documents.
    const publishedVersions = getProjectVersions(project.id);
    const versionSegment = version?.slug && publishedVersions.length > 1 ? `/${version.slug}` : "";
    
    // For custom domains, use simplified URLs without org prefix
    if (isCustomDomain || isImplicitOrgPath) {
      if (topic?.slug) {
        return `${orgPrefix}/${project.slug}${versionSegment}/${topic.slug}/${doc.slug}`;
      }
      return `${orgPrefix}/${project.slug}${versionSegment}/${doc.slug}`;
    }
    
    if (topic?.slug) {
      return `${orgPrefix}/${project.slug}${versionSegment}/${topic.slug}/${doc.slug}`;
    }
    return `${orgPrefix}/${project.slug}${versionSegment}/${doc.slug}`;
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

  useEffect(() => {
    if (!selectedProject) {
      setSelectedVersion(null);
      return;
    }
    const resolved = resolveDefaultVersion(selectedProject.id, versionSlug);
    if (!resolved) {
      setSelectedVersion(null);
      return;
    }
    if (resolved.id !== selectedVersion?.id) {
      setSelectedVersion(resolved);
    }
  }, [selectedProject, versionSlug, projectVersions, isInternalView]);

  const shouldUseVersion = useMemo(() => {
    if (!selectedProject || !selectedVersion) return false;
    if (versionSlug) return true;
    if (!isInternalView) return false;
    
    // Internal view: check project and its ancestors for documents/topics in this version
    let currentId: string | null = selectedProject.id;
    while (currentId) {
      const hasDocs = documents.some(
        (doc) => doc.project_id === currentId && doc.project_version_id === selectedVersion.id
      );
      const hasTopics = topics.some(
        (topic) => topic.project_id === currentId && topic.project_version_id === selectedVersion.id
      );
      if (hasDocs || hasTopics) return true;
      
      const p = projects.find(proj => proj.id === currentId);
      currentId = p?.parent_id || null;
    }
    
    return false;
  }, [selectedProject, selectedVersion, versionSlug, documents, topics, projects, isInternalView]);

  const showVersionSwitcher = useMemo(() => {
    if (!selectedProject) return false;
    let currentId: string | null = selectedProject.id;
    while (currentId) {
      const p = projects.find(proj => proj.id === currentId);
      if (p?.show_version_switcher) return true;
      currentId = p?.parent_id || null;
    }
    return false;
  }, [selectedProject, projects]);

  const visibleVersion = shouldUseVersion ? selectedVersion : null;

  // Helper to get the first available document for a project (considering display order)
  const getFirstDocumentForProject = (projectId: string) => {
    const projectDocs = documents.filter(
      d => d.project_id === projectId && (!visibleVersion || d.project_version_id === visibleVersion.id)
    );
    if (projectDocs.length === 0) return null;
    
    // Sort by display_order, then by title
    return projectDocs.sort((a, b) => {
      const orderA = (a as any).display_order ?? Infinity;
      const orderB = (b as any).display_order ?? Infinity;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    })[0];
  };

  const findDocumentFromUrl = (
    project: Project,
    pageSlugValue?: string,
    topicSlugValue?: string
  ): { doc: Document | undefined; topicDocNeedsRedirect: boolean } => {
    if (!pageSlugValue) {
      return { doc: undefined, topicDocNeedsRedirect: false };
    }

    if (topicSlugValue) {
      const topic = topics.find(
        (t) =>
          t.slug === topicSlugValue &&
          t.project_id === project.id &&
          (!visibleVersion || t.project_version_id === visibleVersion.id)
      );
      if (!topic) {
        return { doc: undefined, topicDocNeedsRedirect: false };
      }
      const doc = documents.find(
        (d) =>
          d.slug === pageSlugValue &&
          d.topic_id === topic.id &&
          (!visibleVersion || d.project_version_id === visibleVersion.id)
      );
      return { doc, topicDocNeedsRedirect: false };
    }

    const projectLevelDoc = documents.find(
      (d) =>
        d.slug === pageSlugValue &&
        d.project_id === project.id &&
        (!visibleVersion || d.project_version_id === visibleVersion.id) &&
        !d.topic_id
    );
    if (projectLevelDoc) {
      return { doc: projectLevelDoc, topicDocNeedsRedirect: false };
    }

    const topicDoc = documents.find(
      (d) =>
        d.slug === pageSlugValue &&
        d.project_id === project.id &&
        (!visibleVersion || d.project_version_id === visibleVersion.id)
    );
    return { doc: topicDoc, topicDocNeedsRedirect: !!topicDoc?.topic_id };
  };

  // Handle document selection from URL
  useEffect(() => {
    if (!selectedProject) return;

    if (documents.length === 0) return;
    if (shouldUseVersion && !visibleVersion) return;

    if (pageSlug) {
      const { doc, topicDocNeedsRedirect } = findDocumentFromUrl(selectedProject, pageSlug, topicSlug);
      if (topicDocNeedsRedirect && doc && currentOrg) {
        navigate(buildDocUrl(doc, selectedProject, currentOrg), { replace: true });
        return;
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
  }, [pageSlug, topicSlug, selectedProject, documents, topics, currentOrg, selectedVersion]);

  useEffect(() => {
    if (!selectedProject || !visibleVersion) return;
    if (versionSlug === visibleVersion.slug) return;
    if (!isCustomDomain && !currentOrg) return;

    if (selectedDocument && currentOrg) {
      navigate(buildDocUrl(selectedDocument, selectedProject, currentOrg), { replace: true });
      return;
    }

    navigate(buildProjectUrl(selectedProject, visibleVersion), { replace: true });
  }, [selectedProject, visibleVersion, versionSlug, selectedDocument, currentOrg, isCustomDomain]);

  const fetchContent = async () => {
    setLoading(true);
    setInternalAccessDenied(false);
    setInternalAccessReason(null);
    setContentError(null);
    try {
      const session = await auth.getSession();
      const currentUser = session?.user;
      
      let userOrgId: string | null = null;
      let userProjectMemberships: string[] = [];
      
      if (currentUser) {
        const { data, error } = await invokeFunction<{
          organizationId?: string | number;
          organization?: { id?: string | number };
          id?: string | number;
        }>("ensure-workspace", { body: {} });
        const resolvedOrgId =
          data?.organizationId ??
          data?.organization?.id ??
          data?.id ??
          null;
        if (!error && resolvedOrgId) {
          userOrgId = String(resolvedOrgId);
        }

        const { data: membershipData } = await strapiFetch<{ data: any[] }>(
          `/api/project-members?filters[user][id][$eq]=${currentUser.id}&populate[project][fields][0]=id&pagination[limit]=1000`
        );
        userProjectMemberships =
          membershipData?.data
            ?.map((row) => row?.attributes?.project?.data?.id)
            .filter(Boolean)
            .map((id) => String(id)) || [];
      }
      
      const hostDomain = normalizeHostname(window.location.hostname);
      
      // Determine the target organization - from URL slug, custom domain, or user's org
      let targetOrgId: string | null = null;
      let targetOrg: Organization | null = currentOrg;
      const normalizedOrgSlug = orgSlug ? orgSlug.toLowerCase() : null;
      
      // Load org from URL slug if not already loaded from custom domain
      if (orgSlug && !currentOrg && !isCustomDomain) {
        const cached = normalizedOrgSlug ? orgCacheBySlug.get(normalizedOrgSlug) : null;
        if (cached) {
          targetOrg = cached;
          setCurrentOrg(cached);
          setIsImplicitOrgPath(!!hostDomain && normalizeHostname(cached.domain) === hostDomain);
        } else {
          const { data, error } = await strapiFetch<{ data: any[] }>(
            `/api/organizations?filters[$or][0][slug][$eq]=${encodeURIComponent(orgSlug)}&filters[$or][1][domain][$eq]=${encodeURIComponent(orgSlug)}&pagination[limit]=1`
          );
          if (!error && data?.data?.[0]) {
            const org = mapOrganization(data.data[0]);
            targetOrg = org;
            setCurrentOrg(org);
            setIsImplicitOrgPath(!!hostDomain && normalizeHostname(org.domain) === hostDomain);
          }
        }
      }
      
      if (!targetOrg && !isCustomDomain && hostDomain) {
        const cached = orgCacheByDomain.get(hostDomain);
        if (cached) {
          targetOrg = cached;
          setCurrentOrg(cached);
          setIsImplicitOrgPath(true);
        } else {
          const { data, error } = await strapiFetch<{ data: any[] }>(
            `/api/organizations?filters[domain][$eq]=${encodeURIComponent(hostDomain)}&pagination[limit]=1`
          );
          if (!error && data?.data?.[0]) {
            const org = mapOrganization(data.data[0]);
            targetOrg = org;
            setCurrentOrg(org);
            setIsImplicitOrgPath(true);
          }
        }
      }

      if (!targetOrg && !isCustomDomain && projectSlug && !isInternalView) {
        const visibilityFilter = !currentUser ? "&filters[visibility][$eq]=public" : "";
        const { data, error } = await strapiFetch<{ data: any[] }>(
          `/api/projects?filters[slug][$eq]=${encodeURIComponent(projectSlug)}&filters[is_published][$eq]=true${visibilityFilter}&populate[organization][fields][0]=id&pagination[limit]=2`
        );
        const rows = data?.data || [];
        if (!error && rows.length === 1) {
          const orgId = rows[0]?.attributes?.organization?.data?.id;
          if (orgId) {
            const { data: orgData } = await strapiFetch<{ data: any }>(
              `/api/organizations/${orgId}`
            );
            if (orgData?.data) {
              targetOrg = mapOrganization(orgData.data);
              setCurrentOrg(targetOrg);
              setIsImplicitOrgPath(true);
            }
          }
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
          const cached = orgCacheById.get(userOrgId);
          if (cached) {
            targetOrg = cached;
            setCurrentOrg(cached);
          } else {
            const { data: orgData } = await strapiFetch<{ data: any }>(`/api/organizations/${userOrgId}`);
            if (orgData?.data) {
              targetOrg = mapOrganization(orgData.data);
              setCurrentOrg(targetOrg);
            }
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
        setContentError("We couldn’t determine which workspace to load for this URL.");
        setLoading(false);
        return;
      }

      // Public view: use server-side public endpoint to avoid relation filter validation.
      if (!isInternalView) {
        const { data: publicContent, error: publicError } = await strapiFetch<{
          ok?: boolean;
          projects?: any[];
          versions?: any[];
          topics?: any[];
          documents?: any[];
        }>(`/api/public-content?organizationId=${encodeURIComponent(targetOrgId)}`);
        if (publicError || !publicContent?.ok) {
          console.error("Error fetching public content:", publicError || publicContent);
          setContentError("We couldn’t load the public docs. Please try again.");
          setProjects([]);
          setTopics([]);
          setDocuments([]);
          setProjectVersions([]);
          setLoading(false);
          return;
        }

        const publicProjects = dedupeProjects((publicContent.projects || []).map(mapProject));
        setProjects(publicProjects);
        setProjectVersions((publicContent.versions || []).map(mapVersion));
        setTopics((publicContent.topics || []).map(mapTopic));
        const docs = (publicContent.documents || []).map(mapDocument);
        const docByKey = new Map<string, Document>();
        for (const doc of docs) {
          const key = getDocumentDedupeKey(doc);
          const existing = docByKey.get(key);
          if (!existing) {
            docByKey.set(key, doc);
            continue;
          }
          if (!existing.is_published && doc.is_published) {
            docByKey.set(key, doc);
            continue;
          }
          const existingUpdated = Date.parse(existing.updated_at || "") || 0;
          const currentUpdated = Date.parse(doc.updated_at || "") || 0;
          if (currentUpdated > existingUpdated) {
            docByKey.set(key, doc);
          }
        }
        setDocuments(Array.from(docByKey.values()));
        setLoading(false);
        return;
      }

      // Build project query scoped to the target organization (internal view)
      // No is_published filter — internal viewers see all projects including drafts.
      let projectsData: Project[] = [];
      const publishedFilter = "";
      const fetchProjects = async () => {
        const urls = [
          `/api/projects?filters[organization][id][$eq]=${encodeURIComponent(targetOrgId)}${publishedFilter}&populate[parent][fields][0]=id&populate[organization][fields][0]=id&pagination[limit]=1000&sort=name:asc`,
          `/api/projects?filters[organization][$eq]=${encodeURIComponent(targetOrgId)}${publishedFilter}&populate[parent][fields][0]=id&populate[organization][fields][0]=id&pagination[limit]=1000&sort=name:asc`,
        ];

        let lastError: any = null;
        for (const url of urls) {
          const result = await strapiFetch<{ data: any[] }>(url);
          if (!result.error) {
            return result.data;
          }
          lastError = result.error;
        }

        // Final fallback: fetch all projects (public) and filter client-side.
        const fallback = await strapiFetch<{ data: any[] }>(
          `/api/projects?populate[parent][fields][0]=id&populate[organization][fields][0]=id&pagination[limit]=1000&sort=name:asc`
        );
        if (!fallback.error) return fallback.data;
        throw lastError || fallback.error;
      };

      try {
        const data = await fetchProjects();
        projectsData = dedupeProjects(
          (data?.data || [])
            .map(mapProject)
            .filter((project) => !project.organization_id || project.organization_id === targetOrgId)
        );
      } catch (error) {
        console.error("Error fetching projects:", error);
        setContentError("We couldn’t load projects for this workspace. Please try again.");
      }

      if (projectsData.length > 0) {
        // Filter projects based on visibility and user authentication
        const filteredProjects = dedupeProjects(projectsData.filter(project => {
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
        }));
        
        setProjects(filteredProjects);
        const projectIds = filteredProjects.map(p => p.id);
        await fetchProjectVersions(projectIds);
        await fetchTopicsAndDocuments(projectIds, userOrgId, currentUser?.id || null);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Error fetching content:", error);
      setContentError("Something went wrong while loading docs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isInvalidKeyError = (error: ApiError | null) =>
    !!error && error.status === 400 && typeof error.message === "string" && error.message.includes("Invalid key");

  const fetchProjectVersions = async (projectIds: string[]) => {
    if (projectIds.length === 0) return;

    if (useClientSideFilters) {
      const { data: fallbackData } = await strapiFetch<{ data: any[] }>(
        `/api/project-versions?populate[project][fields][0]=id&pagination[limit]=1000`
      );
      const fallbackRows = (fallbackData?.data || [])
        .map(mapVersion)
        .filter((row) => projectIds.includes(row.project_id));
      if (fallbackRows.length > 0) {
        setProjectVersions(fallbackRows);
      }
      return;
    }

    const inParams = `filters[project][id][$in]=${encodeURIComponent(projectIds.join(","))}`;
    const publishedFilter = !isInternalView ? "&filters[is_published][$eq]=true" : "";
    const { data, error } = await strapiFetch<{ data: any[] }>(
      `/api/project-versions?${inParams}${publishedFilter}&populate[project][fields][0]=id&pagination[limit]=1000`
    );
    if (error) {
      if (!isInvalidKeyError(error)) {
        console.error("Error fetching project versions:", error);
        return;
      }
      setUseClientSideFilters(true);
    }
    const rows = (data?.data || []).map(mapVersion);
    if (rows.length > 0) {
      setProjectVersions(rows);
      return;
    }

    // Fallback: if no published versions exist, use all versions so docs remain visible.
    if (!isInternalView) {
      const { data: fallbackData } = await strapiFetch<{ data: any[] }>(
        `/api/project-versions?populate[project][fields][0]=id&pagination[limit]=1000`
      );
      const fallbackRows = (fallbackData?.data || [])
        .map(mapVersion)
        .filter((row) => projectIds.includes(row.project_id));
      if (fallbackRows.length > 0) {
        setProjectVersions(fallbackRows);
      }
    }
  };

  const fetchTopicsAndDocuments = async (projectIds: string[], userOrgId: string | null, userId: string | null) => {
    if (projectIds.length === 0) return;

    if (useClientSideFilters) {
      const { data: fallbackTopics } = await strapiFetch<{ data: any[] }>(
        `/api/topics?populate[project][fields][0]=id&populate[project_version][fields][0]=id&populate[parent][fields][0]=id&pagination[limit]=1000&sort=display_order:asc`
      );
      const topicsRows = (fallbackTopics?.data || []).map(mapTopic).filter(t => projectIds.includes(t.project_id));
      const topics = topicsRows.sort((a, b) => {
        const orderA = a.display_order ?? 0;
        const orderB = b.display_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      setTopics(topics);

      const { data: fallbackDocs } = await strapiFetch<{ data: any[] }>(
        `/api/documents?populate[project][fields][0]=id&populate[project_version][fields][0]=id&populate[topic][fields][0]=id&populate[owner][fields][0]=id&pagination[limit]=1000&sort=display_order:asc`
      );
      let docs = (fallbackDocs?.data || [])
        .map(mapDocument)
        .filter((doc) => projectIds.includes(doc.project_id));

      if (!isInternalView) {
        docs = docs.filter(
          (doc) => doc.is_published || !!doc.published_content_html || !!doc.content_html
        );
      }

      if (docs.length > 0) {
        const docByKey = new Map<string, Document>();
        for (const doc of docs) {
          const key = doc.google_doc_id ? `gdoc:${doc.google_doc_id}` : `id:${doc.id}`;
          const existing = docByKey.get(key);
          if (!existing) {
            docByKey.set(key, doc);
            continue;
          }
          if (!existing.is_published && doc.is_published) {
            docByKey.set(key, doc);
            continue;
          }
          const existingUpdated = Date.parse(existing.updated_at || "") || 0;
          const currentUpdated = Date.parse(doc.updated_at || "") || 0;
          if (currentUpdated > existingUpdated) {
            docByKey.set(key, doc);
          }
        }
        const dedupedDocs = Array.from(docByKey.values()).sort((a, b) => {
          const orderA = a.display_order ?? 0;
          const orderB = b.display_order ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          return a.title.localeCompare(b.title);
        });
        setDocuments(dedupedDocs);
      } else {
        setDocuments([]);
      }
      return;
    }

    const inParams = `filters[project][id][$in]=${encodeURIComponent(projectIds.join(","))}`;
    const { data: topicsData, error: topicsError } = await strapiFetch<{ data: any[] }>(
      `/api/topics?${inParams}&populate[project][fields][0]=id&populate[project_version][fields][0]=id&populate[parent][fields][0]=id&pagination[limit]=1000&sort=display_order:asc`
    );
    let topicsRows = (topicsData?.data || []).map(mapTopic);
    if (topicsError) {
      if (!isInvalidKeyError(topicsError)) {
        console.error("Error fetching topics:", topicsError);
      } else {
        setUseClientSideFilters(true);
      }
      const { data: fallbackTopics } = await strapiFetch<{ data: any[] }>(
        `/api/topics?populate[project][fields][0]=id&populate[project_version][fields][0]=id&populate[parent][fields][0]=id&pagination[limit]=1000&sort=display_order:asc`
      );
      topicsRows = (fallbackTopics?.data || []).map(mapTopic).filter(t => projectIds.includes(t.project_id));
    }
    const topics = topicsRows.sort((a, b) => {
      const orderA = a.display_order ?? 0;
      const orderB = b.display_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
    setTopics(topics);

    const publishedFilter = !isInternalView
      ? "&filters[$or][0][is_published][$eq]=true&filters[$or][1][published_content_html][$notNull]=true"
      : "";
    const { data: docsData, error: docsError } = await strapiFetch<{ data: any[] }>(
      `/api/documents?${inParams}${publishedFilter}&populate[project][fields][0]=id&populate[project_version][fields][0]=id&populate[topic][fields][0]=id&populate[owner][fields][0]=id&pagination[limit]=1000&sort=display_order:asc`
    );

    let docs = (docsData?.data || []).map(mapDocument);
    if (docsError) {
      if (!isInvalidKeyError(docsError)) {
        console.error("Error fetching documents:", docsError);
      } else {
        setUseClientSideFilters(true);
      }
      const { data: fallbackDocs } = await strapiFetch<{ data: any[] }>(
        `/api/documents?populate[project][fields][0]=id&populate[project_version][fields][0]=id&populate[topic][fields][0]=id&populate[owner][fields][0]=id&pagination[limit]=1000&sort=display_order:asc`
      );
      docs = (fallbackDocs?.data || [])
        .map(mapDocument)
        .filter((doc) => projectIds.includes(doc.project_id));
    }
    if (!isInternalView && docs.length === 0) {
      const { data: fallbackDocs } = await strapiFetch<{ data: any[] }>(
        `/api/documents?${inParams}&populate[project][fields][0]=id&populate[project_version][fields][0]=id&populate[topic][fields][0]=id&populate[owner][fields][0]=id&pagination[limit]=1000&sort=display_order:asc`
      );
      const fallbackRows = (fallbackDocs?.data || []).map(mapDocument);
      docs = fallbackRows.filter(
        (doc) => doc.is_published || !!doc.published_content_html || !!doc.content_html
      );
    }
    if (docs.length > 0) {
      const docByKey = new Map<string, Document>();
      for (const doc of docs) {
        const key = getDocumentDedupeKey(doc);
        const existing = docByKey.get(key);
        if (!existing) {
          docByKey.set(key, doc);
          continue;
        }
        if (!existing.is_published && doc.is_published) {
          docByKey.set(key, doc);
          continue;
        }
        const existingUpdated = Date.parse(existing.updated_at || "") || 0;
        const currentUpdated = Date.parse(doc.updated_at || "") || 0;
        if (currentUpdated > existingUpdated) {
          docByKey.set(key, doc);
        }
      }
      const dedupedDocs = Array.from(docByKey.values()).sort((a, b) => {
        const orderA = a.display_order ?? 0;
        const orderB = b.display_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
      });
      setDocuments(dedupedDocs);
    }
  };

  const buildProjectUrl = (project: Project, version?: ProjectVersion | null) => {
    const versionSegment = version?.slug ? `/${version.slug}` : "";
    const base = getOrgPathPrefix(currentOrg);
    return `${base}/${project.slug}${versionSegment}`;
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
    const targetVersion = resolveDefaultVersion(target.id);

    setSelectedProject(target);
    setSelectedDocument(null);
    setDocumentHtml(null);

    if (target.slug) {
      navigate(buildProjectUrl(target, targetVersion), opts?.replace ? { replace: true } : undefined);
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
    return getOrgPathPrefix(currentOrg);
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
    if (target.slug) {
      const targetVersion = resolveDefaultVersion(target.id);
      navigate(buildProjectUrl(target, targetVersion), { replace: true });
    }
  }, [selectedProject, projects, documents, loading, pageSlug, isCustomDomain, currentOrg]);

  const projectDocuments = useMemo(
    () =>
      selectedProject
        ? documents.filter(
            (d) => d.project_id === selectedProject.id && (!visibleVersion || d.project_version_id === visibleVersion.id)
          )
        : [],
    [selectedProject, documents, visibleVersion]
  );

  const sidebarContent = (
    <DocsSidebar
      loading={loading}
      selectedProject={selectedProject}
      selectedDocument={selectedDocument}
      showVersionSwitcher={showVersionSwitcher}
      visibleVersion={visibleVersion}
      projects={projects}
      topics={topics}
      documents={documents}
      searchQuery={searchQuery}
      expandedTopics={expandedTopics}
      setExpandedTopics={setExpandedTopics}
      onSelectDocument={selectDocument}
      onSelectProjectVersion={(v) => {
        if (selectedProject && currentOrg) {
          navigate(buildProjectUrl(selectedProject, v));
          setMobileMenuOpen(false);
        }
      }}
      getProjectVersions={getProjectVersions}
      isOrgUser={isOrgUser}
      onCollapse={() => setSidebarCollapsed(true)}
      showDashboardLink={!!user && isOrgUser && selectedProject?.visibility !== "public"}
    />
  );

  // Show landing page when no project or page is selected
  const showLandingPage = !selectedDocument && !selectedProject && currentOrg && !loading;
  const landingDocuments = useMemo(() => {
    if (documents.length === 0) return [];
    return documents.filter((doc) => {
      const version = resolveDefaultVersion(doc.project_id);
      if (!version) return true;
      return doc.project_version_id === version.id || !doc.project_version_id;
    });
  }, [documents, projectVersions, isInternalView]);

  const landingTopics = useMemo(() => {
    if (topics.length === 0) return [];
    return topics.filter((topic) => {
      const version = resolveDefaultVersion(topic.project_id);
      if (!version) return true;
      return topic.project_version_id === version.id || !topic.project_version_id;
    });
  }, [topics, projectVersions, isInternalView]);

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
    const publicDocsPath = getOrgPathPrefixForBase("/docs", currentOrg);

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

  if (contentError && !loading && !selectedProject && !selectedDocument) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 docs-branded">
        <div className="max-w-lg w-full rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Unable to load docs</h1>
          </div>
          <p className="text-sm text-muted-foreground">{contentError}</p>
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" onClick={fetchContent}>
              Retry
            </Button>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const landingProjects = (() => {
    const driveIdToProjectId = new Map<string, string>();
    for (const project of projects) {
      if (project.drive_folder_id) {
        driveIdToProjectId.set(project.drive_folder_id, project.id);
      }
    }
    const getEffectiveParentId = (project: Project): string | null => {
      if (project.parent_id) return project.parent_id;
      if (project.drive_parent_id) {
        return driveIdToProjectId.get(project.drive_parent_id) ?? null;
      }
      return null;
    };

    const driveRoots = dedupeProjects(
      projects.filter((p) => {
        if (!currentOrg?.drive_folder_id) return false;
        return p.drive_parent_id === currentOrg.drive_folder_id;
      })
    );
    if (driveRoots.length > 0) return driveRoots;
    return dedupeProjects(projects.filter((p) => !getEffectiveParentId(p)));
  })();

  if (showLandingPage) {
    return (
      <div className="min-h-screen bg-background flex flex-col docs-branded">
        {/* Minimal Header */}
        <header className="border-b border-border bg-card">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14">
            <Link
              to={getOrgPathPrefix(currentOrg)}
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
                    if (githubPagesUrl) {
                      window.open(githubPagesUrl, "_blank");
                    } else {
                      navigate(getOrgPathPrefixForBase("/docs", currentOrg));
                    }
                  }}
                >
                  {githubPagesUrl ? "External Site" : "Public Docs"}
                </Button>
              ) : !isInternalView && user && isOrgUser && projects.some(p => p.visibility !== "public") ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (currentOrg) {
                        navigate(getOrgPathPrefixForBase("/internal", currentOrg));
                      }
                    }}
                  >
                    Internal Docs
                  </Button>
                  {githubPagesUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => window.open(githubPagesUrl, "_blank")}
                    >
                      External Site
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </Button>
                  )}
                </>
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

        {contentError && (
          <div className="border-b border-border bg-amber-50/60 dark:bg-amber-950/40">
            <div className="max-w-5xl mx-auto px-4 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>{contentError}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchContent}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {isOffline && (
          <div className="border-b border-border bg-muted/40">
            <div className="max-w-5xl mx-auto px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <WifiOff className="h-3.5 w-3.5" />
              You’re offline. Showing the most recent content available.
            </div>
          </div>
        )}

        {/* Nudge org members to set up GitHub Pages when not yet configured */}
        {!isInternalView && user && isOrgUser && githubSettingsChecked && !githubPagesUrl && (
          <div className="border-b border-border bg-blue-50/60 dark:bg-blue-950/30">
            <div className="max-w-5xl mx-auto px-4 py-2 text-sm text-blue-800 dark:text-blue-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 shrink-0" />
                <span>
                  External visitors can’t reach this page yet.{" "}
                  <Link to="/dashboard" className="font-medium underline underline-offset-2 hover:no-underline">
                    Connect GitHub in Settings
                  </Link>{" "}
                  to publish your docs to a public site via Zensical.
                </span>
              </div>
            </div>
          </div>
        )}

        <DocsLanding
          organization={currentOrg}
          projects={landingProjects.map(p => ({ ...p, description: null }))}
          featuredProjects={landingProjects.map(p => ({ ...p, description: null }))}
          searchProjects={projects.map(p => ({ ...p, description: null }))}
          documents={landingDocuments.map(d => ({
            id: d.id,
            title: d.title,
            project_id: d.project_id,
            topic_id: d.topic_id,
            content_html: getDocumentHtml(d) ?? undefined,
          }))}
          topics={landingTopics.map(t => ({
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
    <ErrorBoundary>
      <div className="min-h-screen bg-background flex flex-col docs-branded">
      {/* Sticky Navigation Container */}
      <div className="sticky top-0 z-50">
        {/* Top Header */}
        <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 h-14 gap-2">
          {/* Left: Organization Logo/Name + Root Project */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to={currentOrg ? getOrgPathPrefix(currentOrg) : "/"}
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

          {/* Version Switcher (Desktop) */}
          {showVersionSwitcher && (
            <div className="hidden md:flex items-center px-1">
              <VersionSwitcher 
                currentVersion={visibleVersion}
                versions={getProjectVersions(selectedProject!.id)}
                onVersionSelect={(v) => {
                  if (currentOrg) {
                    navigate(buildProjectUrl(selectedProject, v));
                  }
                }}
              />
            </div>
          )}

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
            {isOffline && (
              <Badge variant="outline" className="hidden sm:inline-flex gap-1 text-xs text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
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
                  if (githubPagesUrl) {
                    window.open(githubPagesUrl, "_blank");
                  } else {
                    navigate(getOrgPathPrefixForBase("/docs", currentOrg));
                  }
                }}
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{githubPagesUrl ? "External Site" : "Public Docs"}</span>
                {githubPagesUrl && <ExternalLink className="h-3 w-3 opacity-60" />}
              </Button>
            ) : !isInternalView && user && isOrgUser && projects.some(p => p.visibility !== "public") ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 sm:px-3 text-xs sm:text-sm gap-1.5"
                  onClick={() => {
                    if (currentOrg) {
                      navigate(getOrgPathPrefixForBase("/internal", currentOrg));
                    }
                  }}
                >
                  <Lock className="h-4 w-4" />
                  <span className="hidden sm:inline">Internal Docs</span>
                </Button>
                {githubPagesUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 sm:px-3 text-xs sm:text-sm gap-1.5"
                    onClick={() => window.open(githubPagesUrl, "_blank")}
                  >
                    <Globe className="h-4 w-4" />
                    <span className="hidden sm:inline">External Site</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Button>
                )}
              </>
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
        {hasSubProjects ? (
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
        ) : null}
      </div>

      {contentError && !loading && (
        <div className="border-b border-border bg-amber-50/60 dark:bg-amber-950/40">
          <div className="max-w-5xl mx-auto px-4 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{contentError}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchContent}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {isOffline && (
        <div className="border-b border-border bg-muted/40">
          <div className="max-w-5xl mx-auto px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5" />
            You’re offline. Showing the most recent content available.
          </div>
        </div>
      )}

      {/* Nudge org members to set up GitHub Pages when not yet configured */}
      {!isInternalView && user && isOrgUser && githubSettingsChecked && !githubPagesUrl && (
        <div className="border-b border-border bg-blue-50/60 dark:bg-blue-950/30">
          <div className="max-w-5xl mx-auto px-4 py-2 text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0" />
            <span>
              External visitors can’t reach this page yet.{" "}
              <Link to="/dashboard" className="font-medium underline underline-offset-2 hover:no-underline">
                Connect GitHub in Settings
              </Link>{" "}
              to publish your docs to a public site via Zensical.
            </span>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar - Sticky */}
        {!sidebarCollapsed && (
          <aside
            className={cn(
              "hidden lg:flex w-64 border-r border-border flex-col bg-card sticky overflow-hidden",
              hasSubProjects ? "top-[104px] h-[calc(100vh-104px)]" : "top-[56px] h-[calc(100vh-56px)]"
            )}
          >
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
                      if (topic) {
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
                    {selectedDocument.title || "Untitled Page"}
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

                {selectedDocument.video_url && (
                  <div className="mb-6">
                    <VideoEmbed
                      url={selectedDocument.video_url}
                      title={selectedDocument.video_title || selectedDocument.title}
                    />
                  </div>
                )}

                {/* Content - clean rendering */}
                {resolvedDocumentHtml ? (
                  <div 
                    className="prose prose-sm sm:prose-base lg:prose-lg prose-neutral dark:prose-invert max-w-none docs-content overflow-x-hidden"
                    dangerouslySetInnerHTML={{ __html: resolvedDocumentHtml }}
                  />
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="font-medium">
                      {isInternalView
                        ? "This page doesn't have content yet."
                        : (selectedDocument.is_published || !!selectedDocument.published_content_html)
                          ? "This page has no published content yet."
                          : "This page hasn't been published yet."}
                    </p>
                  </div>
                )}

                {/* Page Feedback */}
                {(() => {
                  const allowPublicFeedback =
                    !isInternalView &&
                    selectedProject?.visibility === "public" &&
                    !!selectedDocument.published_content_html;
                  const allowInternalFeedback = isInternalView && isOrgUser;
                  const showFeedback = allowPublicFeedback || allowInternalFeedback;

                  return showFeedback ? (
                    <PageFeedback
                      documentId={selectedDocument.id}
                      isOrgUser={isOrgUser}
                      isPublic={allowPublicFeedback}
                    />
                  ) : null;
                })()}
              </article>

              {/* Right sidebar - Table of Contents (hide in full width mode) */}
              {!isFullWidth && (
                <aside className="hidden lg:block w-64 shrink-0 sticky top-28 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto p-4">
                  <TableOfContents html={resolvedDocumentHtml} />
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
    </ErrorBoundary>
  );
}
