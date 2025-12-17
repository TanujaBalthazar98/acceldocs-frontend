import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface Topic {
  id: string;
  name: string;
  drive_folder_id: string;
  project_id: string;
  parent_id: string | null;
  display_order: number;
}

interface TopicsGridProps {
  topics: Topic[];
  selectedTopic: Topic | null;
  onSelectTopic: (topic: Topic | null) => void;
  documents?: { topic_id: string | null }[];
}

interface TopicTreeNode {
  topic: Topic;
  children: TopicTreeNode[];
}

export function TopicsGrid({ topics, selectedTopic, onSelectTopic, documents = [] }: TopicsGridProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // Build a proper tree structure from topics with parent_id
  const topicTree = useMemo(() => {
    const nodeMap = new Map<string, TopicTreeNode>();
    const rootNodes: TopicTreeNode[] = [];

    // Create nodes for all topics
    for (const topic of topics) {
      nodeMap.set(topic.id, { topic, children: [] });
    }

    // Build tree by linking parents to children
    for (const topic of topics) {
      const node = nodeMap.get(topic.id)!;
      if (topic.parent_id && nodeMap.has(topic.parent_id)) {
        nodeMap.get(topic.parent_id)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    // Sort children by display_order
    const sortChildren = (nodes: TopicTreeNode[]) => {
      nodes.sort((a, b) => (a.topic.display_order || 0) - (b.topic.display_order || 0));
      for (const node of nodes) {
        sortChildren(node.children);
      }
    };
    sortChildren(rootNodes);

    return rootNodes;
  }, [topics]);

  const toggleExpand = (topicId: string) => {
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

  const getTopicDocCount = (topicId: string): number => {
    // Count docs in this topic and all descendants
    let count = documents.filter(d => d.topic_id === topicId).length;
    const topic = topics.find(t => t.id === topicId);
    if (topic) {
      const children = topics.filter(t => t.parent_id === topicId);
      for (const child of children) {
        count += getTopicDocCount(child.id);
      }
    }
    return count;
  };

  if (topics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No topics yet. Create one to organize pages.
      </p>
    );
  }

  const renderTopicNode = (node: TopicTreeNode, depth: number = 0): JSX.Element => {
    const { topic, children } = node;
    const isExpanded = expandedTopics.has(topic.id);
    const isSelected = selectedTopic?.id === topic.id;
    const hasChildren = children.length > 0;
    const docCount = getTopicDocCount(topic.id);

    return (
      <div key={topic.id} className="select-none">
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group",
            "hover:bg-muted/50",
            isSelected && "bg-primary/10 text-primary"
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => onSelectTopic(topic)}
        >
          {/* Expand/collapse button */}
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-muted rounded"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(topic.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {/* Folder icon */}
          {isExpanded && hasChildren ? (
            <FolderOpen className="w-4 h-4 text-primary/70 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
          )}

          {/* Topic name */}
          <span className={cn(
            "flex-1 text-sm truncate",
            isSelected && "font-medium"
          )}>
            {topic.name}
          </span>

          {/* Doc count */}
          {docCount > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
              <FileText className="w-3 h-3" />
              {docCount}
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l border-border/50 ml-4">
            {children.map(child => renderTopicNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      {/* "All Pages" option */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/50",
          selectedTopic === null && "bg-primary/10 text-primary"
        )}
        onClick={() => onSelectTopic(null)}
      >
        <div className="w-4" />
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className={cn("text-sm", selectedTopic === null && "font-medium")}>
          All Pages
        </span>
      </div>

      {/* Topic tree */}
      {topicTree.map(node => renderTopicNode(node))}
    </div>
  );
}
