import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Loader2, FolderTree, FileStack, X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
        const hasErrors = job.errors && job.errors.length > 0;

        return (
          <div 
            key={job.id}
            className={cn(
              "bg-card border rounded-lg shadow-lg overflow-hidden animate-in slide-in-from-bottom-2",
              isComplete && "border-green-500/30",
              isFailed && "border-destructive/30",
              !isComplete && !isFailed && "border-primary/30"
            )}
          >
            {/* Header */}
            <div className={cn(
              "px-3 py-2 flex items-center gap-2",
              isComplete && "bg-green-500/10",
              isFailed && "bg-destructive/10",
              !isComplete && !isFailed && "bg-primary/5"
            )}>
              {!isComplete && !isFailed && (
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
              )}
              {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
              {isFailed && <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
              
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  Importing to {projectNames[job.project_id] || "project"}
                </p>
                {job.current_file && !isComplete && !isFailed && (
                  <p className="text-xs text-muted-foreground truncate">
                    {job.current_file}
                  </p>
                )}
              </div>
              
              <span className="text-sm font-semibold">{progress}%</span>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1"
                onClick={() => setDismissed(prev => new Set([...prev, job.id]))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Progress */}
            <div className="px-3 py-1.5">
              <Progress 
                value={progress} 
                className={cn(
                  "h-1.5",
                  isComplete && "[&>div]:bg-green-500",
                  isFailed && "[&>div]:bg-destructive"
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
