import { useMemo } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { AutoLinkPlugin, createLinkMatcherWithRegExp } from "@lexical/react/LexicalAutoLinkPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { $getRoot } from "lexical";
import { TRANSFORMERS } from "@lexical/markdown";
import { LexicalToolbar } from "@/components/editor/LexicalToolbar";
import { ImagePlugin } from "@/components/editor/plugins/ImagePlugin";
import { ImageNode } from "@/components/editor/nodes/ImageNode";
import { ClickFocusPlugin } from "@/components/editor/plugins/ClickFocusPlugin";
import { EnsureEditablePlugin } from "@/components/editor/plugins/EnsureEditablePlugin";

interface LexicalEditorProps {
  initialHtml?: string | null;
  onChangeHtml?: (html: string) => void;
}

const placeholder = "Start writing...";

const URL_MATCHER = createLinkMatcherWithRegExp(/https?:\/\/[^\s]+/);

export const LexicalEditor = ({ initialHtml, onChangeHtml }: LexicalEditorProps) => {
  const initialConfig = useMemo(() => ({
    namespace: "docspeare-editor",
    editable: true,
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
      table: "editor-table",
      tableCell: "editor-table-cell",
      tableCellHeader: "editor-table-cell-header",
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      LinkNode,
      AutoLinkNode,
      TableNode,
      TableRowNode,
      TableCellNode,
      HorizontalRuleNode,
      ImageNode,
    ],
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
    <LexicalComposer initialConfig={initialConfig}>
      <div className="rounded-xl border border-border bg-card/50">
        <LexicalToolbar />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="min-h-[360px] cursor-text outline-none px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 prose prose-sm sm:prose-base max-w-none"
              spellCheck={true}
              autoCorrect="on"
              autoComplete="on"
              tabIndex={0}
            />
          }
          placeholder={
            <div className="pointer-events-none text-muted-foreground px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <AutoFocusPlugin />
        <ClickFocusPlugin />
        <EnsureEditablePlugin />
        <HistoryPlugin />
        <LinkPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <AutoLinkPlugin matchers={[URL_MATCHER]} />
        <TablePlugin />
        <HorizontalRulePlugin />
        <ImagePlugin />
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
