import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { APIDocs as APIDocsComponent } from "@/components/docs/APIDocs";
import { ThemeToggle } from "@/components/docs/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileJson } from "lucide-react";
import { useBrandingLoader, useBrandingStyles } from "@/hooks/useBrandingLoader";
import type { Json } from "@/integrations/supabase/types";

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
}


export default function APIDocs() {
  const { orgSlug } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [openApiSpec, setOpenApiSpec] = useState<Json | null>(null);
  const [openApiSpecUrl, setOpenApiSpecUrl] = useState<string | null>(null);
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

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch organization by slug or domain - including OpenAPI spec fields
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .or(`slug.eq.${orgSlug},domain.eq.${orgSlug}`)
        .maybeSingle();

      if (orgError) throw orgError;
      if (!org) {
        setError("Organization not found");
        setLoading(false);
        return;
      }

      setOrganization(org);
      
      // Get OpenAPI spec directly from organization
      setOpenApiSpec((org as any).openapi_spec_json);
      setOpenApiSpecUrl((org as any).openapi_spec_url);
    } catch (err) {
      console.error("Error fetching API docs data:", err);
      setError("Failed to load API documentation");
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
          <FileJson className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {error || "API Documentation Not Found"}
          </h1>
          <p className="text-muted-foreground mb-4">
            The requested API documentation could not be loaded.
          </p>
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasApiSpec = openApiSpec || openApiSpecUrl;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          {/* Left: Logo & Title */}
          <div className="flex items-center gap-4">
            <Link 
              to={`/docs/${orgSlug}`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {organization?.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <span className="font-semibold text-foreground">
                  {organization?.name || "API Docs"}
                </span>
              )}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">API Reference</span>
          </div>

          {/* Right: Theme + Auth */}
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-9 w-9" />
            {authLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : user ? (
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {hasApiSpec ? (
          <APIDocsComponent 
            spec={openApiSpec as any} 
            specUrl={openApiSpecUrl || undefined}
          />
        ) : (
          <div className="max-w-4xl mx-auto p-6 lg:p-8">
            <div className="text-center py-16">
              <FileJson className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No API Specification</h2>
              <p className="text-muted-foreground">
                No OpenAPI specification has been configured for this organization yet.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
