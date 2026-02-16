import { Topic, Document } from "@/types/dashboard";

interface UnifiedContentTreeProps {
  topics: Topic[];
  documents: Document[];
  selectedTopicId: string | null;
  selectedDocumentId: string | null;
  onSelectTopic: (topic: Topic) => void;
  onSelectDocument: (doc: Document) => void;
  onDeleteTopic?: (topic: Topic) => void;
}

export const UnifiedContentTree = ({
  topics,
  documents,
  selectedTopicId,
  selectedDocumentId,
  onSelectTopic,
  onSelectDocument,
  onDeleteTopic,
}: UnifiedContentTreeProps) => {
  const byParent = new Map<string | null, Topic[]>();
  for (const topic of topics) {
    const key = topic.parent_id ?? null;
    const list = byParent.get(key) ?? [];
    list.push(topic);
    byParent.set(key, list);
  }

  const docsByTopic = new Map<string, Document[]>();
  const rootDocs: Document[] = [];
  for (const doc of documents) {
    if (!doc.topic_id) {
      rootDocs.push(doc);
      continue;
    }
    const list = docsByTopic.get(doc.topic_id) ?? [];
    list.push(doc);
    docsByTopic.set(doc.topic_id, list);
  }

  const renderTopic = (topic: Topic, depth: number) => {
    const children = byParent.get(topic.id) ?? [];
    const docs = docsByTopic.get(topic.id) ?? [];
    const isSelected = selectedTopicId === topic.id;
    return (
      <div key={topic.id}>
        <div
          className={`w-full flex items-center gap-2 text-sm px-2 py-1 rounded ${
            isSelected ? "bg-primary/10" : "hover:bg-muted"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <button className="flex-1 text-left" onClick={() => onSelectTopic(topic)}>
            {topic.name}
          </button>
          {onDeleteTopic && (
            <button
              className="text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTopic(topic);
              }}
              title="Delete topic"
            >
              ✕
            </button>
          )}
        </div>
        {docs.map((doc) => (
          <button
            key={doc.id}
            className={`w-full text-left text-sm px-2 py-1 rounded ${
              selectedDocumentId === doc.id ? "bg-primary/10" : "hover:bg-muted"
            }`}
            style={{ paddingLeft: `${depth * 12 + 24}px` }}
            onClick={() => onSelectDocument(doc)}
          >
            {doc.title}
          </button>
        ))}
        {children.map((child) => renderTopic(child, depth + 1))}
      </div>
    );
  };

  const rootTopics = byParent.get(null) ?? [];

  return (
    <div className="space-y-2">
      {rootDocs.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground px-2">Unassigned Pages</div>
          {rootDocs.map((doc) => (
            <button
              key={doc.id}
              className={`w-full text-left text-sm px-2 py-1 rounded ${
                selectedDocumentId === doc.id ? "bg-primary/10" : "hover:bg-muted"
              }`}
              onClick={() => onSelectDocument(doc)}
            >
              {doc.title}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1">
        {rootTopics.map((topic) => renderTopic(topic, 0))}
      </div>
    </div>
  );
};
