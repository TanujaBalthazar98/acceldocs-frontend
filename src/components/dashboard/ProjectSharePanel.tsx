import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy } from "lucide-react";

interface ProjectSharePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectSlug?: string | null;
  organizationSlug?: string | null;
  projectVersionSlug?: string | null;
}

export const ProjectSharePanel = ({
  open,
  onOpenChange,
  projectName,
  projectSlug,
  organizationSlug,
  projectVersionSlug,
}: ProjectSharePanelProps) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => {
    if (!projectSlug) return "";
    const orgSegment = organizationSlug ? `/${organizationSlug}` : "";
    const versionSegment = projectVersionSlug ? `/${projectVersionSlug}` : "";
    return `${window.location.origin}/docs${orgSegment}/${projectSlug}${versionSegment}`;
  }, [projectSlug, organizationSlug, projectVersionSlug]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {projectName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Copy the public docs link for this project.
          </p>
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly />
            <Button variant="outline" size="icon" onClick={handleCopy} disabled={!shareUrl}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {!shareUrl && (
            <p className="text-xs text-muted-foreground">
              Project slug is missing, so a share link can’t be generated.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
