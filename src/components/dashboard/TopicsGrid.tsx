import { useState, useMemo, useCallback } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  onTopicsReordered?: () => void;
  allTopics?: Topic[]; // Full list for drag-drop validation
}

interface TopicTreeNode {
  topic: Topic;
  children: TopicTreeNode[];
}

interface DragState {
  draggedId: string | null;
  dragOverId: string | null;
  dropPosition: 'before' | 'inside' | 'after' | null;
}

export function TopicsGrid({ 
  topics, 
  selectedTopic, 
  onSelectTopic, 
  documents = [],
  onTopicsReordered,
  allTopics
}: TopicsGridProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    dragOverId: null,
    dropPosition: null,
  });
  const { toast } = useToast();

  // Use allTopics for validation if provided, otherwise use topics
  const topicsForValidation = allTopics || topics;

  // Build a proper tree structure from topics with parent_id
  // When viewing a subtopic, treat it as the root
  const topicTree = useMemo(() => {
    const nodeMap = new Map<string, TopicTreeNode>();
    const rootNodes: TopicTreeNode[] = [];

    // Create nodes for all topics
    for (const topic of topics) {
      nodeMap.set(topic.id, { topic, children: [] });
    }

    // Build tree by linking parents to children
    // When we have a selectedTopic and it's in the list, treat topics that:
    // 1. Are the selectedTopic itself (no parent in our subset)
    // 2. Have a parent that's NOT in our current list
    // as root nodes
    const topicIds = new Set(topics.map(t => t.id));
    
    for (const topic of topics) {
      const node = nodeMap.get(topic.id)!;
      
      // If this topic's parent is in our list, link to parent
      if (topic.parent_id && topicIds.has(topic.parent_id)) {
        nodeMap.get(topic.parent_id)!.children.push(node);
      } else {
        // Otherwise it's a root in our current view
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
    const children = topicsForValidation.filter(t => t.parent_id === topicId);
    for (const child of children) {
      count += getTopicDocCount(child.id);
    }
    return count;
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, topicId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', topicId);
    setDragState(prev => ({ ...prev, draggedId: topicId }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({ draggedId: null, dragOverId: null, dropPosition: null });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, topicId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const rect = (e.target as HTMLElement).closest('[data-topic-id]')?.getBoundingClientRect();
    if (!rect) return;
    
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    let dropPosition: 'before' | 'inside' | 'after';
    if (y < height * 0.25) {
      dropPosition = 'before';
    } else if (y > height * 0.75) {
      dropPosition = 'after';
    } else {
      dropPosition = 'inside';
    }
    
    setDragState(prev => ({
      ...prev,
      dragOverId: topicId,
      dropPosition,
    }));
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragState(prev => ({ ...prev, dragOverId: null, dropPosition: null }));
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetTopicId: string) => {
    e.preventDefault();
    
    const draggedId = dragState.draggedId;
    const dropPosition = dragState.dropPosition;
    
    if (!draggedId || draggedId === targetTopicId || !dropPosition) {
      setDragState({ draggedId: null, dragOverId: null, dropPosition: null });
      return;
    }

    const draggedTopic = topicsForValidation.find(t => t.id === draggedId);
    const targetTopic = topicsForValidation.find(t => t.id === targetTopicId);
    
    if (!draggedTopic || !targetTopic) return;

    // Prevent dropping a parent into its own child
    const isDescendant = (parentId: string, childId: string): boolean => {
      const children = topicsForValidation.filter(t => t.parent_id === parentId);
      for (const child of children) {
        if (child.id === childId || isDescendant(child.id, childId)) {
          return true;
        }
      }
      return false;
    };

    if (isDescendant(draggedId, targetTopicId)) {
      toast({
        title: "Invalid move",
        description: "Cannot move a topic into its own subtopic.",
        variant: "destructive",
      });
      setDragState({ draggedId: null, dragOverId: null, dropPosition: null });
      return;
    }

    try {
      let newParentId: string | null;
      let newOrder: number;
      
      if (dropPosition === 'inside') {
        // Move inside target (make it a child)
        newParentId = targetTopicId;
        const siblings = topicsForValidation.filter(t => t.parent_id === targetTopicId);
        newOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.display_order || 0)) + 1 : 0;
        
        // Expand the target to show the moved item
        setExpandedTopics(prev => new Set([...prev, targetTopicId]));
      } else {
        // Move before or after target (same parent)
        newParentId = targetTopic.parent_id;
        const siblings = topicsForValidation.filter(t => t.parent_id === newParentId && t.id !== draggedId);
        const targetIndex = siblings.findIndex(s => s.id === targetTopicId);
        
        if (dropPosition === 'before') {
          newOrder = targetIndex > 0 ? (siblings[targetIndex - 1].display_order + targetTopic.display_order) / 2 : targetTopic.display_order - 1;
        } else {
          newOrder = targetIndex < siblings.length - 1 ? (targetTopic.display_order + siblings[targetIndex + 1].display_order) / 2 : targetTopic.display_order + 1;
        }
      }

      // Update the database
      const { error } = await supabase
        .from('topics')
        .update({ 
          parent_id: newParentId,
          display_order: newOrder 
        })
        .eq('id', draggedId);

      if (error) throw error;

      toast({
        title: "Topic moved",
        description: `"${draggedTopic.name}" has been moved.`,
      });

      // Refresh the topics list
      onTopicsReordered?.();
    } catch (error: any) {
      console.error("Failed to move topic:", error);
      toast({
        title: "Failed to move topic",
        description: error.message || "An error occurred while moving the topic.",
        variant: "destructive",
      });
    }

    setDragState({ draggedId: null, dragOverId: null, dropPosition: null });
  }, [dragState.draggedId, dragState.dropPosition, topicsForValidation, toast, onTopicsReordered]);

  if (topics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No topics yet. Create one to organize pages.
      </p>
    );
  }

  const renderTopicNode = (node: TopicTreeNode, depth: number = 0): JSX.Element => {
    const { topic, children } = node;
    const isExpanded = expandedTopics.has(topic.id) || depth === 0; // Auto-expand first level
    const isSelected = selectedTopic?.id === topic.id;
    const hasChildren = children.length > 0;
    const docCount = getTopicDocCount(topic.id);
    const isDragging = dragState.draggedId === topic.id;
    const isDragOver = dragState.dragOverId === topic.id;
    const dropPosition = isDragOver ? dragState.dropPosition : null;

    return (
      <div key={topic.id} className="select-none">
        {/* Drop indicator - before */}
        {isDragOver && dropPosition === 'before' && (
          <div className="h-0.5 bg-primary mx-2 rounded-full" />
        )}
        
        <div
          data-topic-id={topic.id}
          draggable
          onDragStart={(e) => handleDragStart(e, topic.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, topic.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, topic.id)}
          className={cn(
            "flex items-center gap-1 px-2 py-2 rounded-md cursor-pointer transition-colors group",
            "hover:bg-muted/50",
            isSelected && "bg-primary/10 text-primary",
            isDragging && "opacity-50",
            isDragOver && dropPosition === 'inside' && "bg-primary/20 ring-2 ring-primary/50"
          )}
          style={{ paddingLeft: `${8 + depth * 20}px` }}
          onClick={() => onSelectTopic(topic)}
        >
          {/* Drag handle */}
          <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5 -ml-1 hover:bg-muted rounded shrink-0">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </div>

          {/* Expand/collapse button */}
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-muted rounded shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(topic.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-5 shrink-0" />
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

        {/* Drop indicator - after */}
        {isDragOver && dropPosition === 'after' && !hasChildren && (
          <div className="h-0.5 bg-primary mx-2 rounded-full" />
        )}

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l border-border/50 ml-5">
            {children.map(child => renderTopicNode(child, depth + 1))}
          </div>
        )}
        
        {/* Drop indicator - after (when has children) */}
        {isDragOver && dropPosition === 'after' && hasChildren && !isExpanded && (
          <div className="h-0.5 bg-primary mx-2 rounded-full" />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-0.5 rounded-lg border border-border bg-card p-2">
      {/* Topic tree */}
      {topicTree.map(node => renderTopicNode(node))}
    </div>
  );
}
