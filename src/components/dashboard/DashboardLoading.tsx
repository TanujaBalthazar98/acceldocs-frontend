import { BookOpen } from "lucide-react";

export const DashboardLoading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary animate-pulse" />
        </div>
        <span className="text-2xl font-semibold text-foreground">Knowledge Workspace</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading workspace...</span>
      </div>
    </div>
  </div>
);
