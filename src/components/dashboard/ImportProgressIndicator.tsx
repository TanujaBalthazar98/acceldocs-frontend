import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportJob {
  id: string;
  status: string;
  total_files: number;
  processed_files: number;
  topics_created: number;
  pages_created: number;
  errors: string[];
  current_file: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ImportProgressIndicatorProps {
  jobId: string;
  onComplete?: () => void;
}

export function ImportProgressIndicator({ jobId, onComplete }: ImportProgressIndicatorProps) {
  const [job, setJob] = useState<ImportJob | null>(null);

  useEffect(() => {
    // Fetch initial job state
    const fetchJob = async () => {
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (!error && data) {
        setJob(data as ImportJob);
        if (data.status === 'completed' || data.status === 'failed') {
          onComplete?.();
        }
      }
    };

    fetchJob();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`import-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'import_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const updatedJob = payload.new as ImportJob;
          setJob(updatedJob);
          if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
            onComplete?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, onComplete]);

  if (!job) {
    return (
      <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading import status...</span>
      </div>
    );
  }

  const progress = job.total_files > 0 
    ? Math.round((job.processed_files / job.total_files) * 100) 
    : 0;

  const isComplete = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isProcessing = job.status === 'processing';

  return (
    <div className={cn(
      "p-4 border rounded-lg space-y-3",
      isComplete && "border-green-500/50 bg-green-500/10",
      isFailed && "border-destructive/50 bg-destructive/10",
      isProcessing && "border-primary/50 bg-primary/5"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {isComplete && <CheckCircle className="h-4 w-4 text-green-500" />}
          {isFailed && <XCircle className="h-4 w-4 text-destructive" />}
          <span className="font-medium">
            {isProcessing && "Importing files..."}
            {isComplete && "Import complete!"}
            {isFailed && "Import failed"}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {job.processed_files} / {job.total_files} files
        </span>
      </div>

      <Progress value={progress} className="h-2" />

      {job.current_file && isProcessing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="truncate">{job.current_file}</span>
        </div>
      )}

      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">
          Topics: <span className="font-medium text-foreground">{job.topics_created}</span>
        </span>
        <span className="text-muted-foreground">
          Pages: <span className="font-medium text-foreground">{job.pages_created}</span>
        </span>
        {job.errors && job.errors.length > 0 && (
          <span className="text-destructive">
            Errors: {job.errors.length}
          </span>
        )}
      </div>

      {job.errors && job.errors.length > 0 && isComplete && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            View {job.errors.length} error(s)
          </summary>
          <ul className="mt-2 space-y-1 text-destructive/80 text-xs max-h-32 overflow-y-auto">
            {job.errors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
