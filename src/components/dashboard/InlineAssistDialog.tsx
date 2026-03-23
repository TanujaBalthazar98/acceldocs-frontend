import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Wand2,
  Expand,
  FileText,
  Minimize2,
  Languages,
  SpellCheck,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { agentApi, type InlineOperation } from "@/api/agent";

const OPERATIONS: {
  key: InlineOperation;
  label: string;
  icon: typeof Wand2;
  description: string;
}[] = [
  { key: "rewrite", label: "Rewrite", icon: Wand2, description: "Clearer and more professional" },
  { key: "expand", label: "Expand", icon: Expand, description: "Add detail and examples" },
  { key: "summarize", label: "Summarize", icon: FileText, description: "Condense to key points" },
  { key: "simplify", label: "Simplify", icon: Minimize2, description: "Plain language" },
  { key: "translate", label: "Translate", icon: Languages, description: "Convert to another language" },
  { key: "fix_grammar", label: "Fix grammar", icon: SpellCheck, description: "Fix errors only" },
];

interface InlineAssistDialogProps {
  open: boolean;
  onClose: () => void;
  initialText?: string;
  pageContext?: string;
}

export default function InlineAssistDialog({
  open,
  onClose,
  initialText = "",
  pageContext = "",
}: InlineAssistDialogProps) {
  const [text, setText] = useState(initialText);
  const [language, setLanguage] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeOp, setActiveOp] = useState<InlineOperation | null>(null);

  const mutation = useMutation({
    mutationFn: (op: InlineOperation) =>
      agentApi.inlineAssist({
        operation: op,
        selected_text: text,
        context: pageContext,
        language: op === "translate" ? language : undefined,
      }),
    onSuccess: (data) => {
      setResult(data.result);
    },
  });

  const handleOp = (op: InlineOperation) => {
    if (!text.trim()) return;
    setActiveOp(op);
    setResult("");
    setCopied(false);
    mutation.mutate(op);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Writing Assistant</DialogTitle>
          <DialogDescription>
            Paste text below, choose an operation, and copy the result into your Google Doc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Paste the text you want to transform..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="resize-none text-sm"
          />

          <div className="flex flex-wrap gap-2">
            {OPERATIONS.map(({ key, label, icon: Icon, description }) => (
              <Button
                key={key}
                variant={activeOp === key ? "default" : "outline"}
                size="sm"
                onClick={() => handleOp(key)}
                disabled={mutation.isPending || !text.trim()}
                title={description}
              >
                {mutation.isPending && activeOp === key ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5 mr-1.5" />
                )}
                {label}
              </Button>
            ))}
          </div>

          {activeOp === "translate" && (
            <Input
              placeholder="Target language (e.g. Spanish, French, Japanese)"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm"
            />
          )}

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {mutation.error instanceof Error ? mutation.error.message : "Something went wrong"}
            </p>
          )}

          {result && (
            <div className="space-y-2">
              <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                {result}
              </div>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy to clipboard
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
