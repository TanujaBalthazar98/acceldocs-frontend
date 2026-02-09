import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

export const EnsureEditablePlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(true);
    return editor.registerEditableListener((editable) => {
      if (!editable) editor.setEditable(true);
    });
  }, [editor]);

  return null;
};
