import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Loader2, FolderTree, FileStack, X, CheckCircle2, AlertCircle, StopCircle, Trash2 } from "lucide-react";
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
  project_id: string;
}

interface GlobalImportProgressProps {
  organizationId: string;
  onComplete?: () => void;
}

export function GlobalImportProgress({ organizationId, onComplete }: GlobalImportProgressProps) {
  const [activeJobs, setActiveJobs] = useState<ImportJob[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [stoppingJobs, setStoppingJobs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Stop import and cleanup partial content
  const stopAndCleanup = useCallback(async (job: ImportJob) => {
    setStoppingJobs(prev => new Set([...prev, job.id]));
    
    try {
      // Mark job as stopped
      await supabase
        .from("import_jobs")
        .update({
          status: 'stopped',
          completed_at: new Date().toISOString(),
          errors: [...(job.errors || []), 'Import stopped by user - cleaning up partial content'],
        })
        .eq("id", job.id);

      // Get the job's created_at for cleanup
      const { data: jobData } = await supabase
        .from("import_jobs")
        .select("created_at")
        .eq("id", job.id)
        .single();

      const jobStartTime = jobData?.created_at || job.current_file;

      // Get documents created by this import (created after job started)
      const { data: docsToDelete } = await supabase
        .from("documents")
        .select("id")
        .eq("project_id", job.project_id)
        .gte("created_at", jobStartTime);

      if (docsToDelete && docsToDelete.length > 0) {
        await supabase
          .from("documents")
          .delete()
          .in("id", docsToDelete.map(d => d.id));
      }

      // Get topics created by this import
      const { data: topicsToDelete } = await supabase
        .from("topics")
        .select("id")
        .eq("project_id", job.project_id)
        .gte("created_at", jobStartTime);

      if (topicsToDelete && topicsToDelete.length > 0) {
        await supabase
          .from("topics")
          .delete()
          .in("id", topicsToDelete.map(t => t.id));
      }

      toast({
        title: "Import Stopped",
        description: `Cleaned up ${docsToDelete?.length || 0} pages and ${topicsToDelete?.length || 0} topics.`,
      });

      setDismissed(prev => new Set([...prev, job.id]));
      onComplete?.();
    } catch (error) {
      console.error("Error stopping import:", error);
      toast({
        title: "Error",
        description: "Failed to stop import. Please try again.",
        variant: "destructive",
      });
    } finally {
      setStoppingJobs(prev => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  }, [toast, onComplete]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let isActive = true;

    const fetchActiveJobs = async () => {
      if (!isActive) return;

      // Get all projects for this organization first
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", organizationId);

      if (!projects?.length) return;

      // Store project names
      const names: Record<string, string> = {};
      projects.forEach(p => { names[p.id] = p.name; });
      setProjectNames(names);

      const projectIds = projects.map(p => p.id);

      // Get active import jobs
      const { data: jobs, error } = await supabase
        .from("import_jobs")
        .select("*")
        .in("project_id", projectIds)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false });

      if (!error && jobs) {
        setActiveJobs(jobs as ImportJob[]);
        
        // If no more active jobs, call onComplete
        if (jobs.length === 0 && activeJobs.length > 0) {
          onComplete?.();
        }
      }
    };

    fetchActiveJobs();
    pollInterval = setInterval(fetchActiveJobs, 2000);

    // Realtime subscription for updates
    const channel = supabase
      .channel('import-jobs-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'import_jobs',
        },
        () => {
          fetchActiveJobs();
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      if (pollInterval) clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [organizationId, onComplete]);

  // Filter out dismissed jobs and only show active ones
  const visibleJobs = activeJobs.filter(job => !dismissed.has(job.id));

  if (visibleJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {visibleJobs.map(job => {
        const progress = job.total_files > 0 
          ? Math.round((job.processed_files / job.total_files) * 100) 
          : 0;
        const isComplete = job.status === 'completed';
        const isFailed = job.status === 'failed';
        const isStopped = job.status === 'stopped';
        const isProcessing = job.status === 'processing' || job.status === 'pending';
        const hasErrors = job.errors && job.errors.length > 0;
        const isStopping = stoppingJobs.has(job.id);

        return (
          <div 
            key={job.id}
            className={cn(
              "bg-card border rounded-lg shadow-lg overflow-hidden animate-in slide-in-from-bottom-2",
              isComplete && "border-green-500/30",
              (isFailed || isStopped) && "border-destructive/30",
              isProcessing && !isStopping && "border-primary/30"
            )}
          >
            {/* Header */}
            <div className={cn(
              "px-3 py-2 flex items-center gap-2",
              isComplete && "bg-green-500/10",
              (isFailed || isStopped) && "bg-destructive/10",
              isProcessing && !isStopping && "bg-primary/5"
            )}>
              {isProcessing && !isStopping && (
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
              )}
              {isStopping && (
                <Loader2 className="h-4 w-4 animate-spin text-destructive flex-shrink-0" />
              )}
              {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
              {(isFailed || isStopped) && !isStopping && <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
              
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {isStopping ? "Stopping import..." : `Importing to ${projectNames[job.project_id] || "project"}`}
                </p>
                {job.current_file && isProcessing && !isStopping && (
                  <p className="text-xs text-muted-foreground truncate">
                    {job.current_file}
                  </p>
                )}
              </div>
              
              <span className="text-sm font-semibold">{progress}%</span>
              
              {/* Stop button - only show when processing */}
              {isProcessing && !isStopping && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <StopCircle className="h-4 w-4" />
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
                        onClick={() => stopAndCleanup(job)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Stop & Cleanup
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
              {(isComplete || isFailed || isStopped) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -mr-1"
                  onClick={() => setDismissed(prev => new Set([...prev, job.id]))}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Progress */}
            <div className="px-3 py-1.5">
              <Progress 
                value={progress} 
                className={cn(
                  "h-1.5",
                  isComplete && "[&>div]:bg-green-500",
                  (isFailed || isStopped || isStopping) && "[&>div]:bg-destructive"
                )} 
              />
            </div>

            {/* Stats */}
            <div className="px-3 py-2 flex items-center gap-4 text-xs text-muted-foreground border-t border-border/50">
              <div className="flex items-center gap-1">
                <FolderTree className="h-3 w-3" />
                <span>{job.topics_created} topics</span>
              </div>
              <div className="flex items-center gap-1">
                <FileStack className="h-3 w-3" />
                <span>{job.pages_created} pages</span>
              </div>
              {hasErrors && (
                <div className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{job.errors.length} errors</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
