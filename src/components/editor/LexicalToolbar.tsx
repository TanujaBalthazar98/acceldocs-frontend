import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListChecks,
  Link as LinkIcon,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Undo2,
  Redo2,
  Minus,
  Table,
  Image,
} from "lucide-react";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  ListNode,
} from "@lexical/list";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode } from "lexical";
import { $getNearestNodeOfType } from "@lexical/utils";
import { INSERT_IMAGE_COMMAND } from "@/components/editor/plugins/ImagePlugin";

type BlockType = "paragraph" | "h1" | "h2" | "h3" | "quote";

const blockOptions: { value: BlockType; label: string; icon: JSX.Element }[] = [
  { value: "paragraph", label: "Paragraph", icon: <Pilcrow className="h-4 w-4" /> },
  { value: "h1", label: "Heading 1", icon: <Heading1 className="h-4 w-4" /> },
  { value: "h2", label: "Heading 2", icon: <Heading2 className="h-4 w-4" /> },
  { value: "h3", label: "Heading 3", icon: <Heading3 className="h-4 w-4" /> },
  { value: "quote", label: "Quote", icon: <Quote className="h-4 w-4" /> },
];

export const LexicalToolbar = () => {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = useState<BlockType>("paragraph");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getTopLevelElementOrThrow();
      const elementType = element.getType();

      if (elementType === "heading") {
        const tag = (element as any).getTag?.();
        setBlockType(tag as BlockType);
      } else if (elementType === "quote") {
        setBlockType("quote");
      } else {
        setBlockType("paragraph");
      }

      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrike(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));
      const node = selection.anchor.getNode();
      const parent = node.getParent();
      setIsLink(parent?.getType() === "link" || node.getType() === "link");
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(updateToolbar);
    });
  }, [editor, updateToolbar]);

  useEffect(() => {
    const unregisterCanUndo = editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload);
        return false;
      },
      0
    );
    const unregisterCanRedo = editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload);
        return false;
      },
      0
    );
    return () => {
      unregisterCanUndo();
      unregisterCanRedo();
    };
  }, [editor]);

  const setBlock = (value: BlockType) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      switch (value) {
        case "paragraph":
          $setBlocksType(selection, () => $createParagraphNode());
          break;
        case "h1":
        case "h2":
        case "h3":
          $setBlocksType(selection, () => $createHeadingNode(value));
          break;
        case "quote":
          $setBlocksType(selection, () => $createQuoteNode());
          break;
        default:
          break;
      }
    });
  };

  const toggleList = (type: "bullet" | "number" | "check") => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const anchorNode = selection.anchor.getNode();
      const listNode = $getNearestNodeOfType(anchorNode, ListNode);
      if (listNode && listNode.getListType() === type) {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        return;
      }
      if (type === "bullet") editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      if (type === "number") editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      if (type === "check") editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
    });
  };

  const insertLink = () => {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }
    const url = window.prompt("Enter URL");
    if (!url) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
  };

  const insertImage = () => {
    const src = window.prompt("Image URL");
    if (!src) return;
    const altText = window.prompt("Alt text (optional)") || "";
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src, altText });
  };

  const blockValue = useMemo(() => blockOptions.find((opt) => opt.value === blockType), [blockType]);

  return (
    <div className="lexical-toolbar">
      <div className="lexical-toolbar-group">
        <Button
          variant="ghost"
          size="icon"
          className="toolbar-btn"
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          disabled={!canUndo}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="toolbar-btn"
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          disabled={!canRedo}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="lexical-toolbar-divider" />

      <div className="lexical-toolbar-group">
        <select
          className="lexical-toolbar-select"
          value={blockType}
          onChange={(event) => setBlock(event.target.value as BlockType)}
        >
          {blockOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="lexical-toolbar-select-icon">{blockValue?.icon}</span>
      </div>

      <div className="lexical-toolbar-divider" />

      <div className="lexical-toolbar-group">
        <Button
          variant="ghost"
          size="icon"
          className={isBold ? "toolbar-btn toolbar-btn-active" : "toolbar-btn"}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={isItalic ? "toolbar-btn toolbar-btn-active" : "toolbar-btn"}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={isUnderline ? "toolbar-btn toolbar-btn-active" : "toolbar-btn"}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={isStrike ? "toolbar-btn toolbar-btn-active" : "toolbar-btn"}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={isCode ? "toolbar-btn toolbar-btn-active" : "toolbar-btn"}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>

      <div className="lexical-toolbar-divider" />

      <div className="lexical-toolbar-group">
        <Button
          variant="ghost"
          size="icon"
          className="toolbar-btn"
          onClick={() => toggleList("bullet")}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="toolbar-btn"
          onClick={() => toggleList("number")}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="toolbar-btn"
          onClick={() => toggleList("check")}
        >
          <ListChecks className="h-4 w-4" />
        </Button>
      </div>

      <div className="lexical-toolbar-divider" />

      <div className="lexical-toolbar-group">
        <Button
          variant="ghost"
          size="icon"
          className={isLink ? "toolbar-btn toolbar-btn-active" : "toolbar-btn"}
          onClick={insertLink}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="toolbar-btn"
          onClick={() => setBlock("quote")}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="toolbar-btn"
          onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="toolbar-btn"
          onClick={() => editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: 3, rows: 3 })}
        >
          <Table className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="toolbar-btn"
          onClick={insertImage}
        >
          <Image className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
