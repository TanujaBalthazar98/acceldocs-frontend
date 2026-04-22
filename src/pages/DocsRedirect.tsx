import { useEffect, useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";

import Docs from "@/pages/Docs";
import { API_BASE_URL, getAuthToken } from "@/api/client";
import { Button } from "@/components/ui/button";

export function buildDocsRedirectTarget(params: {
  orgSlug?: string;
  pathname: string;
  search: string;
  hash: string;
  apiBaseUrl: string;
}): string {
  if (!params.orgSlug) return "";
  const normalizedPath = normalizePublicDocsPathForBackend(params.pathname, params.orgSlug);
  return `${params.apiBaseUrl}${normalizedPath}${params.search}${params.hash}`;
}

export function shouldRedirectToBackend(targetUrl: string, currentUrl: string): boolean {
  return Boolean(targetUrl) && targetUrl !== currentUrl;
}

/**
 * Keep full docs path structure while proxying through backend.
 * Supports:
 *   /docs/:orgSlug
 *   /docs/:orgSlug/:projectSlug/.../:pageSlug
 *   /docs/:orgSlug/search
 *   /docs/:orgSlug/p/:id/:slug
 */
export function normalizePublicDocsPathForBackend(pathname: string, orgSlug: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const docsPrefix = `/docs/${orgSlug}`;

  if (segments.length <= 2) return docsPrefix;

  const tail = segments.slice(2);
  return `${docsPrefix}/${tail.join("/")}`;
}

export default function DocsRedirect() {
  const location = useLocation();
  const { orgSlug } = useParams();

  const targetUrl = useMemo(() => {
    return buildDocsRedirectTarget({
      orgSlug,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      apiBaseUrl: API_BASE_URL,
    });
  }, [location.hash, location.pathname, location.search, orgSlug]);

  const currentUrl = useMemo(
    () => `${window.location.origin}${location.pathname}${location.search}${location.hash}`,
    [location.hash, location.pathname, location.search],
  );

  // In development (or special proxy setups), frontend and backend may share
  // origin. Avoid redirect loops and render the existing docs page in-place.
  const canRedirect = shouldRedirectToBackend(targetUrl, currentUrl);

  useEffect(() => {
    if (!canRedirect) return;
    let isCancelled = false;

    const redirect = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          await fetch(`${API_BASE_URL}/auth/docs-session`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
        } catch {
          // If cookie bootstrap fails, continue redirecting as anonymous.
        }
      }
      if (!isCancelled) {
        window.location.replace(targetUrl);
      }
    };

    void redirect();
    return () => {
      isCancelled = true;
    };
  }, [canRedirect, targetUrl]);

  if (!orgSlug) {
    return <Docs />;
  }

  if (!canRedirect) {
    return <Docs />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting to published docs...
        </div>
        <p className="text-sm text-muted-foreground mb-4 break-all">{targetUrl}</p>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <a href={targetUrl}>
              Open docs
              <ExternalLink className="h-4 w-4 ml-1.5" />
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
