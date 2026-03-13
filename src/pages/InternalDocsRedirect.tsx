import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";

import { API_BASE_URL, getAuthToken } from "@/api/client";
import { Button } from "@/components/ui/button";

function normalizeInternalDocsPathForBackend(pathname: string, orgSlug: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const docsPrefix = `/internal-docs/${orgSlug}`;

  // /internal/:orgSlug
  if (segments.length <= 2) return docsPrefix;

  const tail = segments.slice(2);
  if (tail.length === 1) return `${docsPrefix}/${tail[0]}`;

  // Keep explicit backend patterns unchanged.
  if (tail[0] === "search") return `${docsPrefix}/${tail.join("/")}`;
  if (tail[0] === "p" && tail.length >= 3) return `${docsPrefix}/${tail.join("/")}`;

  // Legacy deep paths collapse to final page slug.
  const pageSlug = tail[tail.length - 1];
  return `${docsPrefix}/${pageSlug}`;
}

function isSameTarget(targetUrl: string, pathname: string, search: string, hash: string): boolean {
  if (!targetUrl) return true;
  const currentUrl = `${window.location.origin}${pathname}${search}${hash}`;
  return targetUrl === currentUrl;
}

async function resolveOrgSlugFromApi(): Promise<string | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const resp = await fetch(`${API_BASE_URL}/api/org`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!resp.ok) return null;
    const payload = await resp.json();
    const data = payload?.data ?? payload;
    if (typeof data?.slug === "string" && data.slug.trim()) return data.slug.trim();
    if (data?.id != null) return String(data.id);
    return null;
  } catch {
    return null;
  }
}

export default function InternalDocsRedirect() {
  const location = useLocation();
  const { orgSlug: routeOrgSlug } = useParams();
  const [resolvedOrgSlug, setResolvedOrgSlug] = useState<string | null>(routeOrgSlug ?? null);
  const [resolutionDone, setResolutionDone] = useState<boolean>(!!routeOrgSlug);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      if (routeOrgSlug) {
        setResolvedOrgSlug(routeOrgSlug);
        setResolutionDone(true);
        return;
      }

      const slug = await resolveOrgSlugFromApi();
      if (cancelled) return;
      setResolvedOrgSlug(slug);
      setResolutionDone(true);
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [routeOrgSlug]);

  const targetUrl = useMemo(() => {
    if (!resolvedOrgSlug) return "";
    const normalizedPath = normalizeInternalDocsPathForBackend(location.pathname, resolvedOrgSlug);
    const search = new URLSearchParams(location.search).toString();
    return `${API_BASE_URL}${normalizedPath}${search ? `?${search}` : ""}${location.hash}`;
  }, [location.hash, location.pathname, location.search, resolvedOrgSlug]);

  const canRedirect = resolutionDone && !!resolvedOrgSlug && !isSameTarget(targetUrl, location.pathname, location.search, location.hash);

  useEffect(() => {
    if (!canRedirect) return;
    let cancelled = false;

    const redirect = async () => {
      const token = getAuthToken();
      let redirectUrl = targetUrl;
      const isLocalBackend =
        API_BASE_URL.includes("localhost") || API_BASE_URL.includes("127.0.0.1");
      if (token) {
        try {
          const resp = await fetch(`${API_BASE_URL}/auth/docs-session`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
          if (!resp.ok) {
            throw new Error(`docs-session failed (${resp.status})`);
          }
        } catch {
          // Continue below with localhost query-token fallback.
        }

        // Localhost hardening: always provide one-time token fallback because
        // mixed scheme localhost setups can drop docs cookie propagation.
        if (isLocalBackend) {
          const withToken = new URL(redirectUrl);
          withToken.searchParams.set("auth_token", token);
          redirectUrl = withToken.toString();
        }
      }
      if (!cancelled) window.location.replace(redirectUrl);
    };

    void redirect();
    return () => {
      cancelled = true;
    };
  }, [canRedirect, targetUrl]);

  if (!resolutionDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Resolving workspace...
          </div>
        </div>
      </div>
    );
  }

  if (!resolvedOrgSlug) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground mb-4">
            Unable to determine your workspace for internal docs.
          </p>
          <Button asChild size="sm">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!canRedirect) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground mb-4 break-all">{targetUrl}</p>
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <a href={targetUrl}>
                Open internal docs
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting to internal docs...
        </div>
        <p className="text-sm text-muted-foreground mb-4 break-all">{targetUrl}</p>
      </div>
    </div>
  );
}
