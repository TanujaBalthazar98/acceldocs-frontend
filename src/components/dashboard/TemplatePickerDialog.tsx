import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DOC_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type DocTemplate,
} from "@/lib/templates";
import { FileText, Check } from "lucide-react";

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: DocTemplate) => void;
}

const CATEGORY_ORDER: DocTemplate["category"][] = [
  "getting-started",
  "guides",
  "reference",
  "release",
  "support",
];

export function TemplatePickerDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: TemplatePickerDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<
    DocTemplate["category"] | "all"
  >("all");

  const filtered =
    activeCategory === "all"
      ? DOC_TEMPLATES
      : DOC_TEMPLATES.filter((t) => t.category === activeCategory);

  const handleConfirm = () => {
    const template = DOC_TEMPLATES.find((t) => t.id === selected);
    if (template) {
      onSelectTemplate(template);
      onOpenChange(false);
      setSelected(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Choose a template</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Start with a pre-built structure you can customise
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex h-[420px]">
          {/* Category sidebar */}
          <div className="w-40 shrink-0 border-r p-2 flex flex-col gap-1">
            <button
              onClick={() => setActiveCategory("all")}
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeCategory === "all"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              All templates
            </button>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                  activeCategory === cat
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {TEMPLATE_CATEGORIES[cat]}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <ScrollArea className="flex-1">
            <div className="p-3 grid grid-cols-2 gap-2.5">
              {filtered.map((template) => {
                const isSelected = selected === template.id;
                return (
                  <button
                    key={template.id}
                    onClick={() =>
                      setSelected(isSelected ? null : template.id)
                    }
                    className={`relative group text-left rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                    <div className="text-2xl mb-2 leading-none">
                      {template.icon}
                    </div>
                    <p className="font-medium text-sm leading-snug">
                      {template.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">
                      {template.description}
                    </p>
                    <Badge
                      variant="secondary"
                      className="mt-2.5 text-[10px] h-4 px-1.5"
                    >
                      {TEMPLATE_CATEGORIES[template.category]}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 bg-background">
          <p className="text-xs text-muted-foreground">
            Templates create a blank page pre-filled with structure and
            placeholder content.
          </p>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelected(null);
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={!selected} onClick={handleConfirm}>
              Use template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
