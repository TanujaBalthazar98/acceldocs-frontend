import { useState, useCallback, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FolderPlus, Plus, MoreHorizontal, Settings, Trash2, GripVertical } from "lucide-react";
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

interface Topic {
  id: string;
  name: string;
  drive_folder_id: string;
  project_id: string;
  parent_id: string | null;
  display_order: number;
}

interface SidebarTopicsTreeProps {
  topics: Topic[];
  selectedTopic: Topic | null;
  onSelectTopic: (topic: Topic) => void;
  onAddPage: (topic: Topic) => void;
  onAddSubtopic: (parentTopic: Topic) => void;
  onOpenSettings: (topic: Topic) => void;
  onDeleteTopic: (topic: Topic) => void;
  onTopicsReordered?: () => void;
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

export function SidebarTopicsTree({
  topics,
  selectedTopic,
  onSelectTopic,
  onAddPage,
  onAddSubtopic,
  onOpenSettings,
  onDeleteTopic,
  onTopicsReordered,
}: SidebarTopicsTreeProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    dragOverId: null,
    dropPosition: null,
  });
  const { toast } = useToast();

  // Build tree structure
  const topicTree = useMemo(() => {
    const nodeMap = new Map<string, TopicTreeNode>();
    const rootNodes: TopicTreeNode[] = [];

    for (const topic of topics) {
      nodeMap.set(topic.id, { topic, children: [] });
    }

    for (const topic of topics) {
      const node = nodeMap.get(topic.id)!;
      if (topic.parent_id && nodeMap.has(topic.parent_id)) {
        nodeMap.get(topic.parent_id)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    const sortChildren = (nodes: TopicTreeNode[]) => {
      nodes.sort((a, b) => (a.topic.display_order || 0) - (b.topic.display_order || 0));
      for (const node of nodes) {
        sortChildren(node.children);
      }
    };
    sortChildren(rootNodes);

    return rootNodes;
  }, [topics]);

  const toggleExpand = (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  // Drag handlers
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

    const draggedTopic = topics.find(t => t.id === draggedId);
    const targetTopic = topics.find(t => t.id === targetTopicId);
    
    if (!draggedTopic || !targetTopic) return;

    // Prevent dropping a parent into its own child
    const isDescendant = (parentId: string, childId: string): boolean => {
      const children = topics.filter(t => t.parent_id === parentId);
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
        newParentId = targetTopicId;
        const siblings = topics.filter(t => t.parent_id === targetTopicId);
        newOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.display_order || 0)) + 1 : 0;
        setExpandedTopics(prev => new Set([...prev, targetTopicId]));
      } else {
        newParentId = targetTopic.parent_id;
        const siblings = topics.filter(t => t.parent_id === newParentId && t.id !== draggedId);
        const targetIndex = siblings.findIndex(s => s.id === targetTopicId);
        
        if (dropPosition === 'before') {
          newOrder = targetIndex > 0 ? (siblings[targetIndex - 1].display_order + targetTopic.display_order) / 2 : targetTopic.display_order - 1;
        } else {
          newOrder = targetIndex < siblings.length - 1 ? (targetTopic.display_order + siblings[targetIndex + 1].display_order) / 2 : targetTopic.display_order + 1;
        }
      }

      const { error } = await supabase
        .from('topics')
        .update({ parent_id: newParentId, display_order: newOrder })
        .eq('id', draggedId);

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

    setDragState({ draggedId: null, dragOverId: null, dropPosition: null });
  }, [dragState.draggedId, dragState.dropPosition, topics, toast, onTopicsReordered]);

  const renderTopicNode = (node: TopicTreeNode, depth: number = 0): JSX.Element => {
    const { topic, children } = node;
    const isExpanded = expandedTopics.has(topic.id);
    const isSelected = selectedTopic?.id === topic.id;
    const hasChildren = children.length > 0;
    const isDragging = dragState.draggedId === topic.id;
    const isDragOver = dragState.dragOverId === topic.id;
    const dropPosition = isDragOver ? dragState.dropPosition : null;

    return (
      <div key={topic.id}>
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
            "group flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
            isSelected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            isDragging && "opacity-50",
            isDragOver && dropPosition === 'inside' && "bg-primary/20 ring-1 ring-primary/50"
          )}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => onSelectTopic(topic)}
        >
          {/* Drag handle */}
          <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>

          {/* Expand/collapse */}
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-muted rounded shrink-0"
              onClick={(e) => toggleExpand(topic.id, e)}
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

          {/* Folder icon */}
          {isExpanded && hasChildren ? (
            <FolderOpen className="w-3.5 h-3.5 text-primary/70 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 shrink-0" />
          )}

          {/* Name */}
          <span className="flex-1 text-left truncate">{topic.name}</span>

          {/* Actions */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddPage(topic);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all shrink-0"
            title="Add page"
          >
            <Plus className="w-3 h-3" />
          </button>
          
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
              <DropdownMenuItem onClick={() => onAddPage(topic)}>
                <Plus className="w-3 h-3 mr-2" />
                Add Page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddSubtopic(topic)}>
                <FolderPlus className="w-3 h-3 mr-2" />
                Add Subtopic
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpenSettings(topic)}>
                <Settings className="w-3 h-3 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteTopic(topic)}
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isDragOver && dropPosition === 'after' && !hasChildren && (
          <div className="h-0.5 bg-primary mx-2 rounded-full" />
        )}

        {hasChildren && isExpanded && (
          <div className="border-l border-border/30 ml-4">
            {children.map(child => renderTopicNode(child, depth + 1))}
          </div>
        )}
        
        {isDragOver && dropPosition === 'after' && hasChildren && !isExpanded && (
          <div className="h-0.5 bg-primary mx-2 rounded-full" />
        )}
      </div>
    );
  };

  if (topicTree.length === 0) {
    return <p className="text-xs text-muted-foreground py-1 px-3 italic">No topics yet</p>;
  }

  return (
    <div className="space-y-0.5">
      {topicTree.map(node => renderTopicNode(node))}
    </div>
  );
}
