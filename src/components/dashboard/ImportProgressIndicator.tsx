import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ImportProgressIndicatorProps {
  jobId: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export const ImportProgressIndicator = ({ jobId, onComplete, onDismiss }: ImportProgressIndicatorProps) => {
  const [progress, setProgress] = useState(10);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    setProgress(10);
    setStalled(false);

    const tick = window.setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + 7, 92);
        return next;
      });
    }, 1200);

    const stallTimer = window.setTimeout(() => {
      setStalled(true);
    }, 15000);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(stallTimer);
    };
  }, [jobId]);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">Importing files</div>
          <div className="text-xs text-muted-foreground">
            {stalled ? "Taking longer than expected. You can keep working." : "Processing in the background."}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onDismiss}>
          Hide
        </Button>
      </div>
      <Progress value={progress} />
      {stalled && (
        <div className="flex items-center justify-end">
          <Button size="sm" onClick={onComplete}>
            Mark as Done
          </Button>
        </div>
      )}
    </div>
  );
};
