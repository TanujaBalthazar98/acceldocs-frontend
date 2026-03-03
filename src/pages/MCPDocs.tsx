import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MCPDocs as MCPDocsComponent } from "@/components/docs/MCPDocs";
import { ThemeToggle } from "@/components/docs/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Bot } from "lucide-react";
import { useBrandingLoader, useBrandingStyles } from "@/hooks/useBrandingLoader";
import { strapiFetch } from "@/lib/api/client";

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  domain: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_heading: string | null;
  font_body: string | null;
  custom_css: string | null;
  mcp_enabled: boolean | null;
}

const unwrapStrapiEntity = <T extends Record<string, any>>(entity: T | null | undefined): T | null => {
  if (!entity) return null;
  if ("attributes" in entity) {
    return { id: String((entity as any).id), ...(entity as any).attributes } as T;
  }
  return entity;
};

export default function MCPDocs() {
  const { orgSlug } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load branding fonts
  const fontsToLoad = [organization?.font_heading, organization?.font_body].filter(Boolean) as string[];
  useBrandingLoader(fontsToLoad);
  
  // Apply branding styles
  useBrandingStyles(organization ? {
    primary_color: organization.primary_color || "#3b82f6",
    secondary_color: organization.secondary_color || "#6366f1",
    accent_color: organization.accent_color || "#8b5cf6",
    font_heading: organization.font_heading || "Inter",
    font_body: organization.font_body || "Inter",
    custom_css: organization.custom_css,
  } : null);

  useEffect(() => {
    if (!orgSlug) {
      setError("Missing organization");
      setLoading(false);
      return;
    }

    fetchData();
  }, [orgSlug]);

  const handleRetry = () => {
    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const slugParams = new URLSearchParams({
        "filters[slug][$eq]": orgSlug!,
        "pagination[limit]": "1",
      });
      const { data: slugRes, error: slugError } = await strapiFetch<{ data: Organization[] }>(
        `/api/organizations?${slugParams.toString()}`,
      );

      if (slugError) throw slugError;
      let org = unwrapStrapiEntity(slugRes?.data?.[0]) as Organization | null;

      if (!org) {
        const domainParams = new URLSearchParams({
          "filters[domain][$eq]": orgSlug!,
          "pagination[limit]": "1",
        });
        const { data: domainRes, error: domainError } = await strapiFetch<{ data: Organization[] }>(
          `/api/organizations?${domainParams.toString()}`,
        );
        if (domainError) throw domainError;
        org = unwrapStrapiEntity(domainRes?.data?.[0]) as Organization | null;
      }

      if (!org) {
        setError("Organization not found");
        setLoading(false);
        return;
      }

      setOrganization(org as Organization);
    } catch (err) {
      console.error("Error fetching MCP docs data:", err);
      setError("Failed to load MCP documentation");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-9 w-9" />
          </div>
        </header>
        <div className="max-w-5xl mx-auto p-8 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {error || "MCP Documentation Not Found"}
          </h1>
          <p className="text-muted-foreground mb-4">
            The requested MCP documentation could not be loaded.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <Button variant="outline" onClick={handleRetry}>
              Retry
            </Button>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasMCP = (organization as any)?.mcp_enabled;

  return (
    <div className="min-h-screen bg-background docs-branded">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-3 sm:px-4 lg:px-6 gap-2">
          {/* Left: Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link 
              to={`/docs/${orgSlug}`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
            >
              {organization?.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="h-7 sm:h-8 w-auto object-contain"
                />
              ) : (
                <span className="font-semibold text-foreground truncate">
                  {organization?.name || "MCP Docs"}
                </span>
              )}
            </Link>
            <span className="text-muted-foreground hidden sm:inline">/</span>
            <span className="text-muted-foreground text-sm sm:text-base truncate">MCP Protocol</span>
          </div>

          {/* Right: Theme + Auth */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <ThemeToggle className="h-8 w-8 sm:h-9 sm:w-9" />
            {authLoading ? (
              <Skeleton className="h-8 w-16 sm:h-9 sm:w-24" />
            ) : user ? (
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-xs sm:text-sm">
                  <span className="hidden sm:inline">Dashboard</span>
                  <span className="sm:hidden">Dash</span>
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-xs sm:text-sm">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {hasMCP ? (
          <MCPDocsComponent orgName={organization?.name} />
        ) : (
          <div className="max-w-4xl mx-auto p-6 lg:p-8">
            <div className="text-center py-16">
              <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h2 className="text-xl font-semibold text-foreground mb-2">MCP Not Enabled</h2>
              <p className="text-muted-foreground">
                MCP integration has not been enabled for this organization yet.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
