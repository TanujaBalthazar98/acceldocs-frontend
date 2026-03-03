import { ChevronRight, Plus } from "lucide-react";
import type { Project, Topic, Document } from "@/types/dashboard";
import { SubtopicsView } from "@/components/dashboard/SubtopicsView";

interface TopicsSectionProps {
  selectedProject: Project | null;
  selectedTopic: Topic | null;
  scopedTopics: Topic[];
  scopedDocuments: Document[];
  onSelectTopic: (topic: Topic | null) => void;
  onAddTopic: () => void;
  onAddSubtopic: (parentTopic: Topic) => void;
  onDeleteTopic: (topic: Topic) => void;
}

export const TopicsSection = ({
  selectedProject,
  selectedTopic,
  scopedTopics,
  scopedDocuments,
  onSelectTopic,
  onAddTopic,
  onAddSubtopic,
  onDeleteTopic,
}: TopicsSectionProps) => {
  const renderBreadcrumbs = () => {
    if (!selectedTopic?.name) return null;
    const path: Topic[] = [];
    let current: Topic | undefined = selectedTopic;
    while (current?.name) {
      path.unshift(current);
      current = scopedTopics.find((t) => t.id === current?.parent_id);
    }
    return path.map((topic, idx) =>
      topic?.name ? (
        <span key={topic.id} className="flex items-center">
          <ChevronRight className="w-4 h-4" />
          <button
            onClick={() => onSelectTopic(topic)}
            className={
              idx === path.length - 1
                ? "text-foreground font-medium"
                : "hover:text-foreground transition-colors"
            }
          >
            {topic.name}
          </button>
        </span>
      ) : null
    );
  };

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-semibold shrink-0">Topics</h2>
          {selectedTopic?.name && (
            <div className="flex items-center text-sm text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
              <button
                onClick={() => onSelectTopic(null)}
                className="hover:text-foreground transition-colors"
              >
                All
              </button>
              {renderBreadcrumbs()}
            </div>
          )}
        </div>
        <button
          onClick={onAddTopic}
          disabled={!selectedProject}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title={!selectedProject ? "Select a project first" : "Add topic"}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {!selectedProject ? (
        <p className="text-sm text-muted-foreground">Select a project to view topics.</p>
      ) : (
        <SubtopicsView
          topics={scopedTopics.filter((t) => t.project_id === selectedProject.id)}
          allTopics={scopedTopics.filter((t) => t.project_id === selectedProject.id)}
          selectedTopic={selectedTopic}
          onSelectTopic={(topic) => onSelectTopic(topic)}
          onAddSubtopic={(parentTopic) => onAddSubtopic(parentTopic)}
          onDeleteTopic={(topic) => onDeleteTopic(topic)}
          documents={scopedDocuments}
        />
      )}
    </div>
  );
};
