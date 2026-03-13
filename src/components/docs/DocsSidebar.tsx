import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, FileText, PanelLeftClose } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Document, Project, ProjectVersion, Topic } from "@/components/docs/types";

interface DocsSidebarProps {
  loading: boolean;
  selectedProject: Project | null;
  selectedDocument: Document | null;
  visibleVersion: ProjectVersion | null;
  projects: Project[];
  topics: Topic[];
  documents: Document[];
  searchQuery: string;
  expandedTopics: Set<string>;
  setExpandedTopics: Dispatch<SetStateAction<Set<string>>>;
  onSelectDocument: (doc: Document) => void;
  getProjectVersions: (projectId: string) => ProjectVersion[];
  isOrgUser: boolean;
  onCollapse: () => void;
  showDashboardLink: boolean;
}

export function DocsSidebar({
  loading,
  selectedProject,
  selectedDocument,
  visibleVersion,
  projects,
  topics,
  documents,
  searchQuery,
  expandedTopics,
  setExpandedTopics,
  onSelectDocument,
  getProjectVersions,
  isOrgUser,
  onCollapse,
  showDashboardLink,
}: DocsSidebarProps) {
  const searchLower = searchQuery.toLowerCase();
  const visibilityBadgeConfig: Record<"internal" | "external", string> = {
    internal: "text-[9px] px-1.5 py-0 h-4 text-violet-700 border-violet-300 bg-violet-50 dark:bg-violet-950 dark:border-violet-800 dark:text-violet-300",
    external: "text-[9px] px-1.5 py-0 h-4 text-sky-700 border-sky-300 bg-sky-50 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-300",
  };

  const renderVisibilityBadge = (doc: Document) => {
    if (!isOrgUser) return null;
    if (doc.visibility === "public") return null;
    const label = doc.visibility === "internal" ? "Internal" : "External";
    const badgeClass = visibilityBadgeConfig[doc.visibility];
    return (
      <Badge variant="outline" className={badgeClass}>
        {label}
      </Badge>
    );
  };

  const versionIdentity = (version: {
    id?: string;
    slug?: string;
    name?: string;
    semver_major?: number;
    semver_minor?: number;
    semver_patch?: number;
  } | null | undefined): string => {
    if (!version) return "";
    const major = Number(version.semver_major ?? 0);
    const minor = Number(version.semver_minor ?? 0);
    const patch = Number(version.semver_patch ?? 0);
    if (major || minor || patch) return `semver:${major}.${minor}.${patch}`;
    if (version.slug) return `slug:${version.slug.toLowerCase()}`;
    if (version.name) return `name:${version.name.toLowerCase()}`;
    return version.id ? `id:${version.id}` : "";
  };

  const visibleVersionIdentity = useMemo(() => versionIdentity(visibleVersion), [visibleVersion]);
  const versionIdentityById = useMemo(() => {
    const map = new Map<string, string>();
    if (!selectedProject) return map;
    const versions = getProjectVersions(selectedProject.id);
    for (const version of versions) {
      map.set(version.id, versionIdentity(version));
    }
    return map;
  }, [selectedProject, getProjectVersions]);

  const matchesVisibleVersion = (entityVersionId?: string | null): boolean => {
    if (!visibleVersion) return true;
    if (!entityVersionId) return true;
    if (entityVersionId === visibleVersion.id) return true;
    if (!visibleVersionIdentity) return false;
    const entityIdentity = versionIdentityById.get(entityVersionId);
    // Fail open when version metadata is missing/stale to avoid hiding pages.
    if (!entityIdentity) return true;
    return entityIdentity === visibleVersionIdentity;
  };

  const projectTopicsPrimary = selectedProject
    ? topics.filter(
        (t) => t.project_id === selectedProject.id && matchesVisibleVersion(t.project_version_id)
      )
    : [];

  const projectTopicsFallback = selectedProject
    ? topics.filter((t) => t.project_id === selectedProject.id)
    : [];

  const projectTopics =
    visibleVersion && projectTopicsPrimary.length === 0 && projectTopicsFallback.length > 0
      ? projectTopicsFallback
      : projectTopicsPrimary;

  const projectDocumentsPrimary = selectedProject
    ? documents.filter(
        (d) => d.project_id === selectedProject.id && matchesVisibleVersion(d.project_version_id)
      )
    : [];

  const projectDocumentsFallback = selectedProject
    ? documents.filter((d) => d.project_id === selectedProject.id)
    : [];

  const projectDocuments =
    visibleVersion && projectDocumentsPrimary.length === 0 && projectDocumentsFallback.length > 0
      ? projectDocumentsFallback
      : projectDocumentsPrimary;

  const filteredDocuments = projectDocuments.filter((d) => !searchQuery || d.title.toLowerCase().includes(searchLower));

  const filteredTopics = projectTopics.filter(
    (t) =>
      !searchQuery ||
      t.name.toLowerCase().includes(searchLower) ||
      filteredDocuments.some((d) => d.topic_id === t.id)
  );

  const getRootTopics = () => filteredTopics.filter((t) => !t.parent_id);
  const getChildTopics = (parentId: string) =>
    filteredTopics.filter((t) => t.parent_id === parentId).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const getTopicDocuments = (topicId: string) =>
    filteredDocuments
      .filter((d) => d.topic_id === topicId)
      .sort((a, b) => ((a as any).display_order ?? 0) - ((b as any).display_order ?? 0));
  const getProjectLevelDocuments = () =>
    filteredDocuments
      .filter((d) => !d.topic_id)
      .sort((a, b) => ((a as any).display_order ?? 0) - ((b as any).display_order ?? 0));

  const isRootWrapperTopic = (topic: Topic) => {
    if (!selectedProject) return false;
    if (topic.parent_id) return false;
    return topic.name.toLowerCase().trim() === selectedProject.name.toLowerCase().trim();
  };

  const rootWrapperTopicIds = new Set(projectTopics.filter(isRootWrapperTopic).map((t) => t.id));

  const getWrapperTopicDocuments = () => {
    if (rootWrapperTopicIds.size === 0) return [];
    return filteredDocuments
      .filter((d) => !!d.topic_id && rootWrapperTopicIds.has(d.topic_id))
      .sort((a, b) => ((a as any).display_order ?? 0) - ((b as any).display_order ?? 0));
  };

  const twoLineClampClass =
    "min-w-0 flex-1 text-left overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] leading-snug";

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const renderTopic = (topic: Topic, depth: number = 0) => {
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

        {isTopicExpanded && hasChildren && (
          <div className="mt-1 space-y-0.5">
            {childTopics.map((childTopic) => renderTopic(childTopic, depth + 1))}
            {topicDocs.map((doc) => (
              <div key={doc.id} className="min-w-0" style={{ paddingLeft: "12px" }}>
                <button
                  onClick={() => onSelectDocument(doc)}
                  className={cn(
                    "flex min-w-0 items-start gap-2 w-full px-3 py-1.5 text-sm rounded-md transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    selectedDocument?.id === doc.id && "sidebar-item-selected font-medium"
                  )}
                >
                  <span className={twoLineClampClass}>{doc.title}</span>
                  {renderVisibilityBadge(doc)}
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

  const rootTopics = getRootTopics()
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .flatMap((topic) => {
      if (!rootWrapperTopicIds.has(topic.id)) return [topic];
      return getChildTopics(topic.id);
    });

  const wrapperTopicDocs = getWrapperTopicDocuments();
  const projectLevelDocs = getProjectLevelDocuments();

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-medium text-muted-foreground truncate">
            {selectedProject?.name || "Documentation"}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 hidden lg:flex" onClick={onCollapse}>
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !selectedProject ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Select a project above</div>
        ) : rootTopics.length === 0 && projectLevelDocs.length === 0 && wrapperTopicDocs.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">No pages found</div>
        ) : (
          <nav className="py-2 pr-3">
            {rootTopics.map((topic) => renderTopic(topic, 0))}
            {wrapperTopicDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => onSelectDocument(doc)}
                className={cn(
                  "flex min-w-0 items-start gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedDocument?.id === doc.id && "sidebar-item-selected font-medium"
                )}
              >
                <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                <span className={twoLineClampClass}>{doc.title}</span>
                {renderVisibilityBadge(doc)}
              </button>
            ))}
            {projectLevelDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => onSelectDocument(doc)}
                className={cn(
                  "flex min-w-0 items-start gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedDocument?.id === doc.id && "sidebar-item-selected font-medium"
                )}
              >
                <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                <span className={twoLineClampClass}>{doc.title}</span>
                {renderVisibilityBadge(doc)}
              </button>
            ))}
          </nav>
        )}
      </ScrollArea>

      {showDashboardLink && (
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
}
