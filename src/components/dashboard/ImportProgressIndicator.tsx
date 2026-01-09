import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, FileText, FolderTree, FileStack, AlertCircle, X, StopCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  updated_at: string;
  completed_at: string | null;
  project_id: string;
}

interface ImportProgressIndicatorProps {
  jobId: string;
  onComplete?: () => void;
  onDismiss?: () => void;
}

const STALL_TIMEOUT_MS = 60000; // 1 minute without progress = stalled

export function ImportProgressIndicator({ jobId, onComplete, onDismiss }: ImportProgressIndicatorProps) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [isStalled, setIsStalled] = useState(false);
  const [lastProgress, setLastProgress] = useState<{ files: number; time: number } | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const { toast } = useToast();

  // Mark job as failed
  const markAsFailed = useCallback(async (reason?: string) => {
    await supabase
      .from("import_jobs")
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: [...(job?.errors || []), reason || 'Import timed out - background task may have been terminated'],
      })
      .eq("id", jobId);
  }, [jobId, job?.errors]);

  // Stop import and cleanup partial content
  const stopAndCleanup = useCallback(async () => {
    if (!job) return;

    setIsStopping(true);
    setIsCleaning(true);

    try {
      const { data, error } = await supabase.functions.invoke("stop-import-job", {
        body: { jobId },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Import Stopped",
        description: `Cleaned up ${data?.deletedPages ?? 0} pages and ${data?.deletedTopics ?? 0} topics.`,
      });

      onComplete?.();
      onDismiss?.();
    } catch (error) {
      console.error("Error stopping import:", error);
      toast({
        title: "Error",
        description: "Failed to stop import. Please sign in again and retry.",
        variant: "destructive",
      });
    } finally {
      setIsStopping(false);
      setIsCleaning(false);
    }
  }, [job, jobId, toast, onComplete, onDismiss]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let isActive = true;

    // Fetch job state
    const fetchJob = async () => {
      if (!isActive) return;
      
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (!error && data) {
        const jobData = data as ImportJob;
        setJob(jobData);
        
        // Check for stall - if processing but no progress in STALL_TIMEOUT_MS
        if (jobData.status === 'processing') {
          const now = Date.now();
          const updatedAt = new Date(jobData.updated_at).getTime();
          
          // If no update in STALL_TIMEOUT_MS, mark as stalled
          if (now - updatedAt > STALL_TIMEOUT_MS) {
            setIsStalled(true);
          } else {
            setIsStalled(false);
          }
          
          // Track progress for stall detection
          setLastProgress(prev => {
            if (!prev || prev.files !== jobData.processed_files) {
              return { files: jobData.processed_files, time: now };
            }
            // Same progress for too long?
            if (now - prev.time > STALL_TIMEOUT_MS) {
              setIsStalled(true);
            }
            return prev;
          });
        }
        
        if (jobData.status === 'completed' || jobData.status === 'failed' || jobData.status === 'stopped') {
          setIsStalled(false);
          onComplete?.();
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      }
    };

    fetchJob();

    // Poll more frequently (every 2 seconds)
    pollInterval = setInterval(fetchJob, 2000);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchJob();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Realtime updates as backup
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
          setIsStalled(false);
          if (updatedJob.status === 'completed' || updatedJob.status === 'failed' || updatedJob.status === 'stopped') {
            onComplete?.();
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
  const isFailed = job.status === 'failed' || isStalled;
  const isStopped = job.status === 'stopped';
  const isProcessing = job.status === 'processing' && !isStalled;

  const handleDismiss = async () => {
    if (isStalled) {
      await markAsFailed();
    }
    onDismiss?.();
  };

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      isComplete && "border-green-500/30",
      (isFailed || isStopped) && "border-destructive/30",
      isProcessing && "border-primary/30"
    )}>
      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center gap-3",
        isComplete && "bg-green-500/10",
        (isFailed || isStopped) && "bg-destructive/10",
        isProcessing && "bg-primary/5"
      )}>
        {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        {(isFailed || isStopped) && <XCircle className="h-5 w-5 text-destructive" />}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            {isProcessing && "Importing files..."}
            {isComplete && "Import completed"}
            {isStalled && "Import stalled"}
            {isStopped && "Import stopped"}
            {isFailed && !isStalled && "Import failed"}
          </p>
          <p className="text-xs text-muted-foreground">
            {job.processed_files} of {job.total_files} files processed
          </p>
        </div>
        <span className="text-2xl font-bold text-foreground">{progress}%</span>
        
        {/* Stop button - only show when processing */}
        {isProcessing && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isStopping}
              >
                {isStopping ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <StopCircle className="h-4 w-4 mr-1" />
                )}
                Stop
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Stop Import?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will stop the import and remove all partially imported content 
                  ({job.pages_created} pages and {job.topics_created} topics created so far).
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continue Import</AlertDialogCancel>
                <AlertDialogAction
                  onClick={stopAndCleanup}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Stop & Cleanup
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        
        {(isComplete || isFailed || isStopped || isStalled) && onDismiss && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Stalled warning */}
      {isStalled && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/30">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            The import appears to have stopped responding. The background task may have timed out.
            You can dismiss this and try importing fewer files at once.
          </p>
        </div>
      )}

      {/* Cleaning indicator */}
      {isCleaning && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/30">
          <div className="flex items-center gap-2 text-xs text-destructive">
            <Loader2 className="h-3 w-3 animate-spin" />
            Cleaning up imported content...
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 py-2 bg-card">
        <Progress 
          value={progress} 
          className={cn(
            "h-2",
            isComplete && "[&>div]:bg-green-500",
            (isFailed || isStopped) && "[&>div]:bg-destructive"
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
      {job.errors && job.errors.length > 0 && (isComplete || isFailed || isStopped) && (
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
