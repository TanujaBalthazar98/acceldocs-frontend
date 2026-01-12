import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  MoreHorizontal,
  Settings,
  Trash2,
  GripVertical,
  FileText,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============ Types ============

interface Topic {
  id: string;
  name: string;
  drive_folder_id: string;
  project_id: string;
  parent_id: string | null;
  display_order: number;
}

interface Document {
  id: string;
  title: string;
  google_doc_id: string;
  project_id: string;
  topic_id: string | null;
  display_order?: number | null;
}

interface UnifiedContentTreeProps {
  topics: Topic[];
  documents: Document[];
  selectedTopicId: string | null;
  selectedDocumentId: string | null;
  /** Depth at which to auto-collapse (e.g. 3 means depth 3+ is collapsed by default) */
  autoCollapseDepth?: number;
  onSelectTopic: (topic: Topic) => void;
  onSelectDocument: (document: Document) => void;
  onAddPage: (topic: Topic) => void;
  onAddSubtopic: (parentTopic: Topic) => void;
  onOpenTopicSettings: (topic: Topic) => void;
  onDeleteTopic: (topic: Topic) => void;
  onOpenDocumentSettings?: (document: Document) => void;
  onDeleteDocument?: (document: Document) => void;
  onTopicsReordered?: () => void;
  onDocumentsReordered?: () => void;
}

// Unified tree node can be a topic (folder) or a document (page)
type TreeNodeType = "topic" | "document";

interface TreeNode {
  type: TreeNodeType;
  id: string;
  name: string;
  parentId: string | null; // For topics this is topic.parent_id, for docs it's the topic_id
  displayOrder: number;
  data: Topic | Document;
  children: TreeNode[];
}

interface DragState {
  draggedId: string | null;
  draggedType: TreeNodeType | null;
  dragOverId: string | null;
  dropPosition: "before" | "inside" | "after" | null;
}

// ============ Component ============

export function UnifiedContentTree({
  topics,
  documents,
  selectedTopicId,
  selectedDocumentId,
  autoCollapseDepth = 3,
  onSelectTopic,
  onSelectDocument,
  onAddPage,
  onAddSubtopic,
  onOpenTopicSettings,
  onDeleteTopic,
  onOpenDocumentSettings,
  onDeleteDocument,
  onTopicsReordered,
  onDocumentsReordered,
}: UnifiedContentTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    draggedType: null,
    dragOverId: null,
    dropPosition: null,
  });
  const { toast } = useToast();

  // Build unified tree: topics with their documents as children
  const tree = useMemo(() => {
    // Create topic nodes
    const topicNodeMap = new Map<string, TreeNode>();

    for (const topic of topics) {
      topicNodeMap.set(topic.id, {
        type: "topic",
        id: topic.id,
        name: topic.name,
        parentId: topic.parent_id,
        displayOrder: topic.display_order ?? 0,
        data: topic,
        children: [],
      });
    }

    // Create document nodes and attach to their topics
    for (const doc of documents) {
      const docNode: TreeNode = {
        type: "document",
        id: doc.id,
        name: doc.title,
        parentId: doc.topic_id,
        displayOrder: doc.display_order ?? 999,
        data: doc,
        children: [], // Documents have no children
      };

      if (doc.topic_id && topicNodeMap.has(doc.topic_id)) {
        topicNodeMap.get(doc.topic_id)!.children.push(docNode);
      }
      // Note: root-level documents (topic_id = null) handled separately below
    }

    // Build hierarchy for topics
    const rootNodes: TreeNode[] = [];
    for (const topic of topics) {
      const node = topicNodeMap.get(topic.id)!;
      if (topic.parent_id && topicNodeMap.has(topic.parent_id)) {
        topicNodeMap.get(topic.parent_id)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    // Add root-level documents (no topic)
    for (const doc of documents) {
      if (!doc.topic_id) {
        rootNodes.push({
          type: "document",
          id: doc.id,
          name: doc.title,
          parentId: null,
          displayOrder: doc.display_order ?? 999,
          data: doc,
          children: [],
        });
      }
    }

    // Sort all children recursively
    const sortNodes = (nodes: TreeNode[]) => {
      // Topics first, then documents; then by displayOrder, then by name
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "topic" ? -1 : 1;
        }
        const orderDiff = a.displayOrder - b.displayOrder;
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name);
      });
      for (const node of nodes) {
        if (node.children.length > 0) {
          sortNodes(node.children);
        }
      }
    };
    sortNodes(rootNodes);

    return rootNodes;
  }, [topics, documents]);

  // Auto-expand path to selected item
  useEffect(() => {
    const targetId = selectedDocumentId || selectedTopicId;
    if (!targetId) return;

    // Find path to target
    const findPath = (
      nodes: TreeNode[],
      target: string,
      path: string[]
    ): string[] | null => {
      for (const node of nodes) {
        if (node.id === target) {
          return path;
        }
        if (node.children.length > 0) {
          const found = findPath(node.children, target, [...path, node.id]);
          if (found) return found;
        }
      }
      return null;
    };

    const path = findPath(tree, targetId, []);
    if (path && path.length > 0) {
      setExpandedNodes((prev) => new Set([...prev, ...path]));
    }
  }, [selectedDocumentId, selectedTopicId, tree]);

  // Auto-collapse nodes beyond autoCollapseDepth on initial render
  useEffect(() => {
    // Collect nodes at depth < autoCollapseDepth to expand
    const nodesToExpand: string[] = [];

    const collectShallowNodes = (nodes: TreeNode[], depth: number) => {
      if (depth >= autoCollapseDepth) return;
      for (const node of nodes) {
        if (node.type === "topic" && node.children.length > 0) {
          nodesToExpand.push(node.id);
          collectShallowNodes(node.children, depth + 1);
        }
      }
    };
    collectShallowNodes(tree, 0);

    // Only run once on mount
    if (expandedNodes.size === 0 && nodesToExpand.length > 0) {
      setExpandedNodes(new Set(nodesToExpand));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, autoCollapseDepth]);

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // ============ Drag & Drop (topics only for now) ============

  const handleDragStart = useCallback(
    (e: React.DragEvent, nodeId: string, nodeType: TreeNodeType) => {
      // Allow dragging both topics and documents
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", nodeId);
      setDragState((prev) => ({
        ...prev,
        draggedId: nodeId,
        draggedType: nodeType,
      }));
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragState({
      draggedId: null,
      draggedType: null,
      dragOverId: null,
      dropPosition: null,
    });
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, nodeId: string, nodeType: TreeNodeType) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const rect = (e.target as HTMLElement)
        .closest("[data-node-id]")
        ?.getBoundingClientRect();
      if (!rect) return;

      const y = e.clientY - rect.top;
      const height = rect.height;

      // Mobile/trackpad UX: when dragging a *page* over a *topic*, treat the whole row as
      // an "inside" drop target to avoid accidental "before/after" drops.
      const draggingDocOverTopic =
        nodeType === "topic" && dragState.draggedType === "document";

      let dropPosition: "before" | "inside" | "after";

      if (draggingDocOverTopic) {
        dropPosition = "inside";
      } else if (nodeType === "topic") {
        if (y < height * 0.25) {
          dropPosition = "before";
        } else if (y > height * 0.75) {
          dropPosition = "after";
        } else {
          dropPosition = "inside";
        }
      } else {
        // Documents only support before/after
        dropPosition = y < height * 0.5 ? "before" : "after";
      }

      setDragState((prev) => ({
        ...prev,
        dragOverId: nodeId,
        dropPosition,
      }));
    },
    [dragState.draggedType]
  );

  const handleDragLeave = useCallback(() => {
    setDragState((prev) => ({
      ...prev,
      dragOverId: null,
      dropPosition: null,
    }));
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetNodeId: string, targetNodeType: TreeNodeType) => {
      e.preventDefault();

      const { draggedId, draggedType, dropPosition } = dragState;

      if (
        !draggedId ||
        !draggedType ||
        draggedId === targetNodeId ||
        !dropPosition
      ) {
        setDragState({
          draggedId: null,
          draggedType: null,
          dragOverId: null,
          dropPosition: null,
        });
        return;
      }

      // Handle topic drop
      if (draggedType === "topic") {
        const draggedTopic = topics.find((t) => t.id === draggedId);
        const targetTopic = topics.find((t) => t.id === targetNodeId);

        if (!draggedTopic || !targetTopic) {
          handleDragEnd();
          return;
        }

        // Prevent dropping parent into child
        const isDescendant = (parentId: string, childId: string): boolean => {
          const children = topics.filter((t) => t.parent_id === parentId);
          for (const child of children) {
            if (child.id === childId || isDescendant(child.id, childId)) {
              return true;
            }
          }
          return false;
        };

        if (isDescendant(draggedId, targetNodeId)) {
          toast({
            title: "Invalid move",
            description: "Cannot move a topic into its own subtopic.",
            variant: "destructive",
          });
          handleDragEnd();
          return;
        }

        try {
          let newParentId: string | null;
          let newOrder: number;

          if (dropPosition === "inside") {
            newParentId = targetNodeId;
            const siblings = topics.filter((t) => t.parent_id === targetNodeId);
            newOrder =
              siblings.length > 0
                ? Math.max(...siblings.map((s) => s.display_order || 0)) + 1
                : 0;
            setExpandedNodes((prev) => new Set([...prev, targetNodeId]));
          } else {
            newParentId = targetTopic.parent_id;
            const siblings = topics.filter(
              (t) => t.parent_id === newParentId && t.id !== draggedId
            );
            const targetIndex = siblings.findIndex((s) => s.id === targetNodeId);

            if (dropPosition === "before") {
              newOrder =
                targetIndex > 0
                  ? Math.floor(
                      (siblings[targetIndex - 1].display_order +
                        targetTopic.display_order) /
                        2
                    )
                  : targetTopic.display_order - 1;
            } else {
              newOrder =
                targetIndex < siblings.length - 1
                  ? Math.floor(
                      (targetTopic.display_order +
                        siblings[targetIndex + 1].display_order) /
                        2
                    )
                  : targetTopic.display_order + 1;
            }
          }

          const { error } = await supabase
            .from("topics")
            .update({ parent_id: newParentId, display_order: newOrder })
            .eq("id", draggedId);

          if (error) throw error;

          toast({
            title: "Topic moved",
            description: `"${draggedTopic.name}" has been moved.`,
          });

          onTopicsReordered?.();
        } catch (error: any) {
          toast({
            title: "Failed to move topic",
            description: error.message || "An error occurred.",
            variant: "destructive",
          });
        }
      }

      // Handle document drop
      if (draggedType === "document") {
        const draggedDoc = documents.find((d) => d.id === draggedId);
        if (!draggedDoc) {
          handleDragEnd();
          return;
        }

          // Ensure we have an authenticated session before attempting writes.
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) {
            toast({
              title: "Session expired",
              description: "Please sign in again and retry the move.",
              variant: "destructive",
            });
            handleDragEnd();
            return;
          }

          // Proactively refresh to avoid race conditions where requests go out as anon.
          // (Those can look like "0 rows affected" due to missing auth context.)
          await supabase.auth.refreshSession();

          // Some views pass a lightweight doc object that may not include project_id.
          // Resolve the true project_id from the database when missing.
          let sourceProjectId: string | null = (draggedDoc as any).project_id ?? null;
          if (!sourceProjectId) {
            const { data: docRow, error: docRowError } = await supabase
              .from("documents")
              .select("project_id")
              .eq("id", draggedId)
              .maybeSingle();

            if (!docRowError && docRow?.project_id) {
              sourceProjectId = docRow.project_id;
            }
          }

          try {
            // Determine destination "container" (topic_id) and insertion index
            let destinationTopicId: string | null = draggedDoc.topic_id ?? null;
            let destinationProjectId: string | null = sourceProjectId;
            let insertIndex: number | null = null;

            if (targetNodeType === "topic") {
              const targetTopic = topics.find((t) => t.id === targetNodeId);
              if (!targetTopic) {
                handleDragEnd();
                return;
              }

              destinationProjectId = targetTopic.project_id;

              // Dropping *inside* a topic → move into that topic.
              // Dropping *before/after* a topic → move to the topic's parent level (i.e., sibling of that topic).
              destinationTopicId =
                dropPosition === "inside" ? targetTopic.id : targetTopic.parent_id ?? null;

              if (dropPosition === "inside") {
                setExpandedNodes((prev) => new Set([...prev, targetTopic.id]));
              }

              // Since topics and pages don't interleave in ordering (topics render first),
              // treat before/after as "top" / "bottom" within that level's pages.
              insertIndex = dropPosition === "before" ? 0 : null; // null means append
            } else {
              // Dropping before/after another document
              const targetDoc = documents.find((d) => d.id === targetNodeId);
              if (!targetDoc) {
                handleDragEnd();
                return;
              }

              destinationProjectId = (targetDoc as any).project_id ?? destinationProjectId;
              destinationTopicId = targetDoc.topic_id ?? null;

              const sorted = documents
                .filter(
                  (d) =>
                    d.topic_id === destinationTopicId &&
                    d.id !== draggedId &&
                    (!destinationProjectId || d.project_id === destinationProjectId)
                )
                .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));

              const targetIndex = sorted.findIndex((d) => d.id === targetDoc.id);
              if (targetIndex === -1) {
                insertIndex = null;
              } else {
                insertIndex = dropPosition === "before" ? targetIndex : targetIndex + 1;
              }
            }

            // Prevent cross-project moves (these should be done via project switcher)
            if (sourceProjectId && destinationProjectId && sourceProjectId !== destinationProjectId) {
              toast({
                title: "Invalid move",
                description:
                  "Pages can’t be moved between projects. Switch to that project and try again.",
                variant: "destructive",
              });
              handleDragEnd();
              return;
            }

            // Best-effort permission precheck (do NOT hard-block, RLS below is the source of truth).
            if (destinationProjectId) {
              const { data: canEdit, error: canEditError } = await supabase.rpc(
                "can_edit_project",
                {
                  _project_id: destinationProjectId,
                  _user_id: sessionData.session.user.id,
                }
              );

              if (canEditError) {
                console.warn("Permission precheck failed:", canEditError);
              } else if (!canEdit) {
                console.warn("Permission precheck returned false", {
                  destinationProjectId,
                  userId: sessionData.session.user.id,
                });
              }
            }

            // Build the destination ordering and reindex deterministically (avoids integer midpoint collisions)
            const destinationDocs = documents
              .filter(
                (d) =>
                  d.topic_id === destinationTopicId &&
                  d.id !== draggedId &&
                  (!destinationProjectId || d.project_id === destinationProjectId)
              )
              .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));

            const orderedIds = destinationDocs.map((d) => d.id);
            const finalIndex =
              insertIndex === null
                ? orderedIds.length
                : Math.max(0, Math.min(insertIndex, orderedIds.length));
            orderedIds.splice(finalIndex, 0, draggedId);

            const updates = orderedIds.map((id, idx) => ({
              id,
              topic_id: destinationTopicId,
              display_order: idx * 10,
            }));

            const applyUpdates = async () => {
              for (const u of updates) {
                const res = await supabase
                  .from("documents")
                  .update({ topic_id: u.topic_id, display_order: u.display_order })
                  .eq("id", u.id)
                  // request returning rows so we can detect RLS "0 rows affected" cases
                  .select("id");

                if (res.error) throw res.error;

                if (!res.data || res.data.length === 0) {
                  const { data: authData } = await supabase.auth.getUser();
                  const signedInAs = authData.user?.email
                    ? `Signed in as ${authData.user.email}. `
                    : "";
                  throw new Error(
                    `${signedInAs}Move was blocked (no changes applied). This usually means your current account doesn’t have edit permissions for this project.`
                  );
                }
              }
            };

            // Retry once after a refresh (helps when access tokens are mid-refresh).
            try {
              await applyUpdates();
            } catch (e) {
              await supabase.auth.refreshSession();
              await applyUpdates();
            }

            toast({
              title: "Page moved",
              description: `"${draggedDoc.title}" has been moved.`,
            });

            onDocumentsReordered?.();
          } catch (error: any) {
            toast({
              title: "Failed to move page",
              description: error.message || "An error occurred.",
              variant: "destructive",
            });
          }
      }

      handleDragEnd();
    },
    [dragState, topics, documents, toast, onTopicsReordered, onDocumentsReordered, handleDragEnd]
  );

  // ============ Render ============

  const renderNode = (node: TreeNode, depth: number = 0): JSX.Element => {
    const isExpanded = expandedNodes.has(node.id);
    const isTopic = node.type === "topic";
    const hasChildren = node.children.length > 0;
    const isSelected = isTopic
      ? selectedTopicId === node.id
      : selectedDocumentId === node.id;
    const isDragging = dragState.draggedId === node.id;
    const isDragOver = dragState.dragOverId === node.id;
    const dropPosition = isDragOver ? dragState.dropPosition : null;

    return (
      <div key={`${node.type}-${node.id}`}>
        {/* Drop indicator before */}
        {isDragOver && dropPosition === "before" && (
          <div className="h-0.5 bg-primary mx-2 rounded-full" />
        )}

        <div
          data-node-id={node.id}
          draggable={true}
          onDragStart={(e) => handleDragStart(e, node.id, node.type)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, node.id, node.type)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.id, node.type)}
          className={cn(
            "group flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
            isSelected
              ? isTopic
                ? "bg-primary/10 text-foreground font-medium"
                : "bg-accent/50 text-foreground font-medium"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            isDragging && "opacity-50",
            isDragOver &&
              dropPosition === "inside" &&
              "bg-primary/20 ring-1 ring-primary/50"
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => {
            if (isTopic) {
              onSelectTopic(node.data as Topic);
            } else {
              onSelectDocument(node.data as Document);
            }
          }}
        >
          {/* Drag handle for both topics and documents */}
          <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>

          {/* Expand/collapse chevron */}
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-muted rounded shrink-0"
              onClick={(e) => toggleExpand(node.id, e)}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-4 shrink-0" />
          )}

          {/* Icon */}
          {isTopic ? (
            isExpanded && hasChildren ? (
              <FolderOpen className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
            )
          ) : (
            <FileText className="w-3.5 h-3.5 text-blue-500/70 shrink-0" />
          )}

          {/* Name */}
          <span className="flex-1 text-left truncate">{node.name}</span>

          {/* Quick actions */}
          {isTopic && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddPage(node.data as Topic);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all shrink-0"
              title="Add page"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}

          {/* Dropdown menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all shrink-0"
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {isTopic ? (
                <>
                  <DropdownMenuItem
                    onClick={() => onAddPage(node.data as Topic)}
                  >
                    <Plus className="w-3 h-3 mr-2" />
                    Add Page
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onAddSubtopic(node.data as Topic)}
                  >
                    <FolderPlus className="w-3 h-3 mr-2" />
                    Add Subtopic
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onOpenTopicSettings(node.data as Topic)}
                  >
                    <Settings className="w-3 h-3 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeleteTopic(node.data as Topic)}
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem
                    onClick={() =>
                      window.open(
                        `https://docs.google.com/document/d/${(node.data as Document).google_doc_id}/edit`,
                        "_blank"
                      )
                    }
                  >
                    <ExternalLink className="w-3 h-3 mr-2" />
                    Open in Drive
                  </DropdownMenuItem>
                  {onOpenDocumentSettings && (
                    <DropdownMenuItem
                      onClick={() =>
                        onOpenDocumentSettings(node.data as Document)
                      }
                    >
                      <Settings className="w-3 h-3 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  )}
                  {onDeleteDocument && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          onDeleteDocument(node.data as Document)
                        }
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Drop indicator after (for leaf or collapsed nodes) */}
        {isDragOver && dropPosition === "after" && !hasChildren && (
          <div className="h-0.5 bg-primary mx-2 rounded-full" />
        )}

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="relative ml-3 pl-3 border-l border-border/40">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}

        {/* Drop indicator after expanded node with children */}
        {isDragOver && dropPosition === "after" && hasChildren && !isExpanded && (
          <div className="h-0.5 bg-primary mx-2 rounded-full" />
        )}
      </div>
    );
  };

  if (tree.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-1 px-3 italic">
        No content yet
      </p>
    );
  }

  return <div className="space-y-0.5">{tree.map((node) => renderNode(node))}</div>;
}
