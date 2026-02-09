import { useEffect, useMemo, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { $getRoot } from "lexical";

interface LexicalEditorProps {
  initialHtml?: string | null;
  onChangeHtml?: (html: string) => void;
}

const placeholder = "Start writing...";

export const LexicalEditor = ({ initialHtml, onChangeHtml }: LexicalEditorProps) => {
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    setEditorKey((prev) => prev + 1);
  }, [initialHtml]);

  const initialConfig = useMemo(() => ({
    namespace: "docspeare-editor",
    theme: {
      paragraph: "editor-paragraph",
      heading: {
        h1: "editor-heading editor-h1",
        h2: "editor-heading editor-h2",
        h3: "editor-heading editor-h3",
      },
      quote: "editor-quote",
      list: {
        listitem: "editor-list-item",
        nested: {
          listitem: "editor-list-item-nested",
        },
        ol: "editor-ol",
        ul: "editor-ul",
      },
      code: "editor-code",
      link: "editor-link",
    },
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, LinkNode],
    onError(error: Error) {
      console.error("Lexical error:", error);
    },
    editorState: (editor: any) => {
      if (!initialHtml) return;
      const parser = new DOMParser();
      const dom = parser.parseFromString(initialHtml, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot();
      root.clear();
      root.append(...nodes);
    },
  }), [initialHtml]);

  return (
    <LexicalComposer key={editorKey} initialConfig={initialConfig}>
      <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6 lg:p-8">
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="min-h-[360px] outline-none prose prose-sm sm:prose-base max-w-none" />
          }
          placeholder={
            <div className="pointer-events-none text-muted-foreground">{placeholder}</div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin
          onChange={(editorState, editor) => {
            editorState.read(() => {
              const html = $generateHtmlFromNodes(editor, null);
              onChangeHtml?.(html);
            });
          }}
        />
      </div>
    </LexicalComposer>
  );
};
