import { Folder, FileText, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Topic {
  id: string;
  name: string;
  drive_folder_id: string;
  project_id: string;
  parent_id: string | null;
  display_order: number;
}

interface SubtopicsViewProps {
  topics: Topic[];
  allTopics: Topic[];
  selectedTopic: Topic | null;
  onSelectTopic: (topic: Topic) => void;
  onAddSubtopic?: (parentTopic: Topic | null) => void;
  documents?: { topic_id: string | null }[];
}

export function SubtopicsView({ 
  topics, 
  allTopics,
  selectedTopic, 
  onSelectTopic,
  onAddSubtopic,
  documents = [] 
}: SubtopicsViewProps) {
  // Get immediate children only (one level deep)
  const immediateSubtopics = topics
    .filter(t => t.parent_id === (selectedTopic?.id || null))
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  const getTopicDocCount = (topicId: string): number => {
    // Count docs in this topic and all descendants
    let count = documents.filter(d => d.topic_id === topicId).length;
    const children = allTopics.filter(t => t.parent_id === topicId);
    for (const child of children) {
      count += getTopicDocCount(child.id);
    }
    return count;
  };

  const getSubtopicCount = (topicId: string): number => {
    return allTopics.filter(t => t.parent_id === topicId).length;
  };

  if (immediateSubtopics.length === 0) {
    return (
      <div className="py-4">
        <p className="text-sm text-muted-foreground mb-3">
          {selectedTopic 
            ? "No subtopics in this topic."
            : "No topics yet. Create one to organize pages."}
        </p>
        {onAddSubtopic && (
          <button
            onClick={() => onAddSubtopic(selectedTopic)}
            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            {selectedTopic ? "Add Subtopic" : "Add Topic"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
        {immediateSubtopics.map(topic => {
          const docCount = getTopicDocCount(topic.id);
          const subtopicCount = getSubtopicCount(topic.id);
          
          return (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic)}
              className={cn(
                "flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border border-border bg-card",
                "hover:bg-muted/50 hover:border-primary/30 transition-all text-left",
                "focus:outline-none focus:ring-2 focus:ring-primary/20"
              )}
            >
              <div className="p-1.5 sm:p-2 rounded-md bg-primary/10 shrink-0">
                <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-xs sm:text-sm truncate">{topic.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {subtopicCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Folder className="w-3 h-3" />
                      {subtopicCount}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {docCount}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Add subtopic button */}
      {onAddSubtopic && (
        <button
          onClick={() => onAddSubtopic(selectedTopic)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          {selectedTopic ? "Add Subtopic" : "Add Topic"}
        </button>
      )}
    </div>
  );
}
