import { useEffect } from "react";
import { createCommand, $getSelection, $isRangeSelection, $getRoot } from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createImageNode } from "@/components/editor/nodes/ImageNode";

export const INSERT_IMAGE_COMMAND = createCommand<{ src: string; altText?: string }>();

export const ImagePlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        editor.update(() => {
          const selection = $getSelection();
          const node = $createImageNode(payload.src, payload.altText || "");
          if ($isRangeSelection(selection)) {
            selection.insertNodes([node]);
          } else {
            $getRoot().append(node);
          }
        });
        return true;
      },
      0
    );
  }, [editor]);

  return null;
};
