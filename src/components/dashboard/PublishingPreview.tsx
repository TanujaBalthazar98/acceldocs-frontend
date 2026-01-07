import { useState, useEffect } from "react";
import {
  Globe,
  Lock,
  Eye,
  Users,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type VisibilityLevel = "internal" | "external" | "public";

interface Project {
  id: string;
  name: string;
  slug: string | null;
  visibility: VisibilityLevel;
  is_published: boolean;
  organization_id: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  domain: string;
  subdomain: string | null;
  custom_docs_domain: string | null;
}

interface PublishingPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  organization: Organization;
  onPublish: () => Promise<void>;
}

const DOCSPEARE_DOMAIN = "docspeare.io";

const visibilityConfig: Record<VisibilityLevel, { icon: typeof Lock; label: string; description: string; color: string }> = {
  internal: {
    icon: Lock,
    label: "Internal",
    description: "Only members of your organization can access",
    color: "text-amber-600 border-amber-300 bg-amber-50",
  },
  external: {
    icon: Users,
    label: "External",
    description: "Organization members and invited external users can access",
    color: "text-blue-600 border-blue-300 bg-blue-50",
  },
  public: {
    icon: Globe,
    label: "Public",
    description: "Anyone with the link can access without signing in",
    color: "text-green-600 border-green-300 bg-green-50",
  },
};

export const PublishingPreview = ({
  open,
  onOpenChange,
  project,
  organization,
  onPublish,
}: PublishingPreviewProps) => {
  const [publishing, setPublishing] = useState(false);
  const [customDomains, setCustomDomains] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetchCustomDomains();
    }
  }, [open, organization.id]);

  const fetchCustomDomains = async () => {
    const { data } = await supabase
      .from("domains")
      .select("domain")
      .eq("organization_id", organization.id)
      .eq("is_verified", true)
      .eq("ssl_status", "active");

    setCustomDomains((data || []).map((d: any) => d.domain));
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onPublish();
      onOpenChange(false);
    } finally {
      setPublishing(false);
    }
  };

  const visibility = visibilityConfig[project.visibility];
  const VisibilityIcon = visibility.icon;

  // Build the documentation URL
  const getDocUrl = (domain: string) => {
    const projectPath = project.slug || project.name.toLowerCase().replace(/\s+/g, "-");
    return `https://${domain}/${projectPath}`;
  };

  // Primary domain (custom or subdomain)
  const primaryDomain = customDomains[0] || 
    (organization.subdomain ? `${organization.subdomain}.${DOCSPEARE_DOMAIN}` : null) ||
    (organization.slug ? `${organization.slug}.${DOCSPEARE_DOMAIN}` : null);

  // All available domains
  const allDomains = [
    ...(organization.subdomain ? [`${organization.subdomain}.${DOCSPEARE_DOMAIN}`] : []),
    ...customDomains,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish {project.name}</DialogTitle>
          <DialogDescription>
            Review where your documentation will be published and who can access it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Visibility Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Access Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${visibility.color.replace('text-', 'bg-').replace('-600', '-100')}`}>
                  <VisibilityIcon className={`w-5 h-5 ${visibility.color.split(' ')[0]}`} />
                </div>
                <div>
                  <Badge variant="outline" className={visibility.color}>
                    {visibility.label}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    {visibility.description}
                  </p>
                </div>
              </div>

              {project.visibility === "public" && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-green-800 dark:text-green-200">
                        Publicly accessible
                      </p>
                      <p className="text-green-700 dark:text-green-300">
                        This documentation will be visible to anyone on the internet.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {project.visibility === "internal" && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Organization members only
                      </p>
                      <p className="text-amber-700 dark:text-amber-300">
                        Users must sign in and be part of {organization.name} to view.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {project.visibility === "external" && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-800 dark:text-blue-200">
                        Invitation required
                      </p>
                      <p className="text-blue-700 dark:text-blue-300">
                        External users need a project invitation to access.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Publishing URLs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Documentation URLs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allDomains.length > 0 ? (
                <div className="space-y-2">
                  {allDomains.map((domain, index) => (
                    <div
                      key={domain}
                      className="flex items-center justify-between p-3 bg-muted rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-mono">{getDocUrl(domain)}</span>
                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(getDocUrl(domain), "_blank")}
                        disabled={!project.is_published}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">No domain configured</p>
                  <p className="text-sm text-muted-foreground">
                    Configure a subdomain in Settings → Domains to publish your documentation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Branding Info */}
          <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Your documentation will be displayed with <strong>{organization.name}</strong>'s 
              branding (logo, colors, and fonts) as configured in Settings → Branding.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={publishing || allDomains.length === 0}>
            {publishing ? "Publishing..." : project.is_published ? "Update Published Docs" : "Publish Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
