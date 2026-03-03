import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, FileText, PanelLeftClose } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { VersionSwitcher } from "@/components/docs/VersionSwitcher";
import { cn } from "@/lib/utils";
import type { Document, Project, ProjectVersion, Topic } from "@/components/docs/types";

interface DocsSidebarProps {
  loading: boolean;
  selectedProject: Project | null;
  selectedDocument: Document | null;
  showVersionSwitcher: boolean;
  visibleVersion: ProjectVersion | null;
  projects: Project[];
  topics: Topic[];
  documents: Document[];
  searchQuery: string;
  expandedTopics: Set<string>;
  setExpandedTopics: Dispatch<SetStateAction<Set<string>>>;
  onSelectDocument: (doc: Document) => void;
  onSelectProjectVersion: (version: ProjectVersion) => void;
  getProjectVersions: (projectId: string) => ProjectVersion[];
  isOrgUser: boolean;
  onCollapse: () => void;
  showDashboardLink: boolean;
}

export function DocsSidebar({
  loading,
  selectedProject,
  selectedDocument,
  showVersionSwitcher,
  visibleVersion,
  projects,
  topics,
  documents,
  searchQuery,
  expandedTopics,
  setExpandedTopics,
  onSelectDocument,
  onSelectProjectVersion,
  getProjectVersions,
  isOrgUser,
  onCollapse,
  showDashboardLink,
}: DocsSidebarProps) {
  const searchLower = searchQuery.toLowerCase();

  const projectTopics = selectedProject
    ? topics.filter(
        (t) => t.project_id === selectedProject.id && (!visibleVersion || t.project_version_id === visibleVersion.id)
      )
    : [];

  const projectDocuments = selectedProject
    ? documents.filter(
        (d) => d.project_id === selectedProject.id && (!visibleVersion || d.project_version_id === visibleVersion.id)
      )
    : [];

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

  const isInvisibleTopic = (topic: Topic) => {
    if (!selectedProject) return false;
    if (topic.parent_id) return false;
    const rootTopics = projectTopics.filter((t) => !t.parent_id);
    const nameMatch = topic.name.toLowerCase().trim() === selectedProject.name.toLowerCase().trim();
    return nameMatch && rootTopics.length === 1;
  };

  const getInvisibleTopicDocuments = () => {
    const invisibleTopics = projectTopics.filter(isInvisibleTopic);
    if (invisibleTopics.length === 0) return [];
    return filteredDocuments
      .filter((d) => invisibleTopics.some((t) => t.id === d.topic_id))
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

  const rootTopics = useMemo(
    () => getRootTopics().filter((t) => !isInvisibleTopic(t)).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [filteredTopics, selectedProject?.id, visibleVersion?.id, searchQuery]
  );

  const invisibleTopicDocs = useMemo(() => getInvisibleTopicDocuments(), [filteredDocuments, selectedProject?.id, visibleVersion?.id]);
  const projectLevelDocs = useMemo(() => getProjectLevelDocuments(), [filteredDocuments, selectedProject?.id, visibleVersion?.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-medium text-muted-foreground truncate">
            {selectedProject?.name || "Documentation"}
          </span>
          {showVersionSwitcher && selectedProject && (
            <VersionSwitcher
              currentVersion={visibleVersion}
              versions={getProjectVersions(selectedProject.id)}
              onVersionSelect={onSelectProjectVersion}
              className="justify-start -ml-2"
            />
          )}
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
        ) : rootTopics.length === 0 && projectLevelDocs.length === 0 && invisibleTopicDocs.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">No pages found</div>
        ) : (
          <nav className="py-2 pr-3">
            {rootTopics.map((topic) => renderTopic(topic, 0))}
            {invisibleTopicDocs.map((doc) => (
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
