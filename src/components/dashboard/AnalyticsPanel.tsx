import { useEffect, useState } from "react";
import { BarChart3, FileText, Globe2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AnalyticsPanelProps {
  projectId: string | null;
  documentId?: string | null;
  className?: string;
}

interface AnalyticsSummary {
  views: number;
  unique_visitors: number;
  top_pages?: Array<{ document_id: string; title: string; views: number }>;
  top_countries?: Array<{ country: string; views: number }>;
  top_referrers?: Array<{ referrer: string; views: number }>;
}

interface AnalyticsResponse {
  ok: boolean;
  error?: { code: string; message: string };
  project?: AnalyticsSummary;
  page?: AnalyticsSummary | null;
}

export const AnalyticsPanel = ({ projectId, documentId, className }: AnalyticsPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  useEffect(() => {
    if (!projectId) {
      setData(null);
      return;
    }

    let cancelled = false;

    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);

      const { data: response, error: invokeError } = await supabase.functions.invoke<AnalyticsResponse>(
        "posthog-analytics",
        {
          body: {
            projectId,
            documentId: documentId || null,
          },
        }
      );

      if (cancelled) return;

      if (invokeError) {
        setError("Failed to load analytics.");
        setData(null);
      } else if (response?.ok === false) {
        setError(response.error?.message || "Analytics not configured.");
        setData(response);
      } else {
        setData(response || null);
      }

      setLoading(false);
    };

    fetchAnalytics();

    return () => {
      cancelled = true;
    };
  }, [projectId, documentId]);

  if (!projectId) {
    return (
      <div className={cn("p-4 rounded-xl glass text-sm text-muted-foreground", className)}>
        Select a project to see analytics.
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("p-4 rounded-xl glass text-sm text-muted-foreground", className)}>
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4 rounded-xl glass text-sm text-muted-foreground", className)}>
        {error}
      </div>
    );
  }

  if (!data?.project) {
    return null;
  }

  const { project, page } = data;

  return (
    <div className={cn("p-4 rounded-xl glass space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Analytics</h3>
        </div>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Views</p>
          <p className="text-lg font-semibold">{project.views}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Unique visitors</p>
          <p className="text-lg font-semibold">{project.unique_visitors}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Top country</p>
          <p className="text-lg font-semibold">{project.top_countries?.[0]?.country || "-"}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Top page</p>
          <p className="text-lg font-semibold line-clamp-1">{project.top_pages?.[0]?.title || "-"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <FileText className="h-3.5 w-3.5" />
            Top pages
          </div>
          <div className="space-y-2">
            {(project.top_pages || []).slice(0, 5).map((item) => (
              <div key={item.document_id} className="flex items-center justify-between text-sm">
                <span className="truncate">{item.title || "Untitled"}</span>
                <span className="text-muted-foreground ml-2">{item.views}</span>
              </div>
            ))}
            {(!project.top_pages || project.top_pages.length === 0) && (
              <p className="text-xs text-muted-foreground">No page views yet.</p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Globe2 className="h-3.5 w-3.5" />
            Top countries
          </div>
          <div className="space-y-2">
            {(project.top_countries || []).slice(0, 5).map((item) => (
              <div key={item.country} className="flex items-center justify-between text-sm">
                <span className="truncate">{item.country || "Unknown"}</span>
                <span className="text-muted-foreground ml-2">{item.views}</span>
              </div>
            ))}
            {(!project.top_countries || project.top_countries.length === 0) && (
              <p className="text-xs text-muted-foreground">No country data yet.</p>
            )}
          </div>
        </div>
      </div>

      {page && documentId && (
        <div className="rounded-lg border border-border bg-background/60 p-3 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            This page
          </div>
          <div className="flex gap-4 text-sm">
            <span>Views: {page.views}</span>
            <span>Unique: {page.unique_visitors}</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Top referrers</p>
            {(page.top_referrers || []).slice(0, 4).map((item) => (
              <div key={item.referrer} className="flex items-center justify-between text-sm">
                <span className="truncate">{item.referrer || "Direct"}</span>
                <span className="text-muted-foreground ml-2">{item.views}</span>
              </div>
            ))}
            {(!page.top_referrers || page.top_referrers.length === 0) && (
              <p className="text-xs text-muted-foreground">No referrers yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
