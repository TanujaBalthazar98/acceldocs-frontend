import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

export const ClickFocusPlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerRootListener((rootElement) => {
      if (!rootElement) return;
      const handleClick = () => editor.focus();
      rootElement.addEventListener("click", handleClick);
      return () => {
        rootElement.removeEventListener("click", handleClick);
      };
    });
  }, [editor]);

  return null;
};
