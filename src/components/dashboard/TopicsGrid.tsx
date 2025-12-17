import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Topic {
  id: string;
  name: string;
  drive_folder_id: string;
  project_id: string;
}

interface TopicsGridProps {
  topics: Topic[];
  selectedTopic: Topic | null;
  onSelectTopic: (topic: Topic) => void;
  documents?: { topic_id: string | null }[];
}

interface TopicGroup {
  name: string;
  topics: Topic[];
  children: Map<string, TopicGroup>;
}

export function TopicsGrid({ topics, selectedTopic, onSelectTopic, documents = [] }: TopicsGridProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group topics by their hierarchy (split by " / ")
  const groupedTopics = useMemo(() => {
    const root: TopicGroup = { name: "", topics: [], children: new Map() };

    for (const topic of topics) {
      const parts = topic.name.split(" / ").map(p => p.trim());
      
      if (parts.length === 1) {
        // Root-level topic
        root.topics.push(topic);
      } else {
        // Nested topic - group by first part
        const parentName = parts[0];
        if (!root.children.has(parentName)) {
          root.children.set(parentName, { name: parentName, topics: [], children: new Map() });
        }
        root.children.get(parentName)!.topics.push(topic);
      }
    }

    return root;
  }, [topics]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const getTopicDocCount = (topicId: string) => {
    return documents.filter(d => d.topic_id === topicId).length;
  };

  // Get short display name (last part after " / ")
  const getDisplayName = (fullName: string) => {
    const parts = fullName.split(" / ");
    return parts[parts.length - 1];
  };

  if (topics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No topics yet. Create one to organize pages.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Root-level topics */}
      {groupedTopics.topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {groupedTopics.topics.map(topic => (
            <TopicButton
              key={topic.id}
              topic={topic}
              displayName={topic.name}
              isSelected={selectedTopic?.id === topic.id}
              docCount={getTopicDocCount(topic.id)}
              onClick={() => onSelectTopic(topic)}
            />
          ))}
        </div>
      )}

      {/* Grouped topics */}
      {Array.from(groupedTopics.children.entries()).map(([groupName, group]) => {
        const isExpanded = expandedGroups.has(groupName);
        const totalDocs = group.topics.reduce((sum, t) => sum + getTopicDocCount(t.id), 0);
        const hasSelectedChild = group.topics.some(t => t.id === selectedTopic?.id);
        
        return (
          <div key={groupName} className="rounded-lg border border-border/50 overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => toggleGroup(groupName)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors",
                "hover:bg-muted/50",
                hasSelectedChild && "bg-primary/5"
              )}
            >
              <span className="text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
              <span className="text-primary/70">
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4" />
                ) : (
                  <Folder className="w-4 h-4" />
                )}
              </span>
              <span className="font-medium text-sm flex-1">{groupName}</span>
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                {group.topics.length} topics
              </span>
              {totalDocs > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {totalDocs}
                </span>
              )}
            </button>
            
            {/* Group content */}
            {isExpanded && (
              <div className="px-3 pb-3 pt-1 bg-muted/20">
                <div className="flex flex-wrap gap-2">
                  {group.topics.map(topic => (
                    <TopicButton
                      key={topic.id}
                      topic={topic}
                      displayName={getDisplayName(topic.name)}
                      isSelected={selectedTopic?.id === topic.id}
                      docCount={getTopicDocCount(topic.id)}
                      onClick={() => onSelectTopic(topic)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface TopicButtonProps {
  topic: Topic;
  displayName: string;
  isSelected: boolean;
  docCount: number;
  onClick: () => void;
}

function TopicButton({ topic, displayName, isSelected, docCount, onClick }: TopicButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all",
        "border",
        isSelected
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card text-foreground border-border hover:border-primary/50 hover:bg-primary/5"
      )}
    >
      <Folder className="w-3.5 h-3.5 opacity-70" />
      <span className="font-medium">{displayName}</span>
      {docCount > 0 && (
        <span className={cn(
          "text-xs px-1.5 py-0.5 rounded-full",
          isSelected 
            ? "bg-primary-foreground/20 text-primary-foreground" 
            : "bg-muted text-muted-foreground"
        )}>
          {docCount}
        </span>
      )}
    </button>
  );
}
