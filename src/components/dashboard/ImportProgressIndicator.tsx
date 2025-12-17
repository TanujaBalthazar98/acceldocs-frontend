import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, FileText, FolderTree, FileStack, AlertCircle } from "lucide-react";
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

    // Poll for updates every 2 seconds (more reliable than realtime for edge function updates)
    const pollInterval = setInterval(fetchJob, 2000);

    // Also subscribe to realtime updates as backup
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
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [jobId, onComplete]);

  if (!job) {
    return (
      <div className="flex items-center justify-center gap-3 p-6 rounded-lg border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium">Initializing import...</span>
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
      "rounded-lg border overflow-hidden",
      isComplete && "border-green-500/30",
      isFailed && "border-destructive/30",
      isProcessing && "border-primary/30"
    )}>
      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center gap-3",
        isComplete && "bg-green-500/10",
        isFailed && "bg-destructive/10",
        isProcessing && "bg-primary/5"
      )}>
        {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        {isFailed && <XCircle className="h-5 w-5 text-destructive" />}
        <div className="flex-1">
          <p className="font-semibold text-sm">
            {isProcessing && "Importing files..."}
            {isComplete && "Import completed"}
            {isFailed && "Import failed"}
          </p>
          <p className="text-xs text-muted-foreground">
            {job.processed_files} of {job.total_files} files processed
          </p>
        </div>
        <span className="text-2xl font-bold text-foreground">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 bg-card">
        <Progress 
          value={progress} 
          className={cn(
            "h-2",
            isComplete && "[&>div]:bg-green-500",
            isFailed && "[&>div]:bg-destructive"
          )} 
        />
      </div>

      {/* Current file */}
      {job.current_file && isProcessing && (
        <div className="px-4 py-2 bg-muted/30 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{job.current_file}</span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-4 py-3 bg-card border-t border-border/50 grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary/10">
            <FolderTree className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-none">{job.topics_created}</p>
            <p className="text-xs text-muted-foreground">Topics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary/10">
            <FileStack className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-none">{job.pages_created}</p>
            <p className="text-xs text-muted-foreground">Pages</p>
          </div>
        </div>
        {job.errors && job.errors.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-destructive/10">
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none text-destructive">{job.errors.length}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>
        )}
      </div>

      {/* Errors list */}
      {job.errors && job.errors.length > 0 && (isComplete || isFailed) && (
        <details className="border-t border-border/50">
          <summary className="px-4 py-2 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
            View {job.errors.length} error{job.errors.length !== 1 ? 's' : ''}
          </summary>
          <ul className="px-4 py-2 space-y-1 text-xs max-h-32 overflow-y-auto bg-muted/20">
            {job.errors.map((error, i) => (
              <li key={i} className="text-destructive/80 flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
