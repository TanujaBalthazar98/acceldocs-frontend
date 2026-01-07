import { useState, useEffect } from "react";
import {
  Globe,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  ExternalLink,
  Trash2,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Domain {
  id: string;
  domain: string;
  domain_type: "custom" | "subdomain";
  is_primary: boolean;
  is_verified: boolean;
  verification_token: string | null;
  ssl_status: "pending" | "provisioning" | "active" | "failed";
  organization_id: string | null;
  project_id: string | null;
}

interface DomainSettingsProps {
  organizationId: string;
  organizationName: string;
  organizationSlug: string | null;
  currentSubdomain: string | null;
  onSubdomainChange?: (subdomain: string) => void;
}

const DOCSPEARE_DOMAIN = "docspeare.io";

export const DomainSettings = ({
  organizationId,
  organizationName,
  organizationSlug,
  currentSubdomain,
  onSubdomainChange,
}: DomainSettingsProps) => {
  const { toast } = useToast();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [subdomain, setSubdomain] = useState(currentSubdomain || "");
  const [savingSubdomain, setSavingSubdomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [addDomainOpen, setAddDomainOpen] = useState(false);

  useEffect(() => {
    fetchDomains();
  }, [organizationId]);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("domains")
        .select("*")
        .eq("organization_id", organizationId)
        .order("is_primary", { ascending: false });

      if (error) throw error;
      setDomains((data || []) as Domain[]);
    } catch (error) {
      console.error("Error fetching domains:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSubdomain = async () => {
    if (!subdomain.trim()) {
      toast({
        title: "Subdomain required",
        description: "Please enter a subdomain for your documentation.",
        variant: "destructive",
      });
      return;
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomain.toLowerCase())) {
      toast({
        title: "Invalid subdomain",
        description: "Subdomain must start and end with a letter or number, and can only contain lowercase letters, numbers, and hyphens.",
        variant: "destructive",
      });
      return;
    }

    setSavingSubdomain(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ subdomain: subdomain.toLowerCase() })
        .eq("id", organizationId);

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Subdomain taken",
            description: "This subdomain is already in use. Please choose another.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Subdomain saved",
        description: `Your docs will be available at ${subdomain.toLowerCase()}.${DOCSPEARE_DOMAIN}`,
      });
      onSubdomainChange?.(subdomain.toLowerCase());
    } catch (error) {
      console.error("Error saving subdomain:", error);
      toast({
        title: "Error",
        description: "Failed to save subdomain. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSubdomain(false);
    }
  };

  const addCustomDomain = async () => {
    if (!newDomain.trim()) return;

    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
    if (!domainRegex.test(newDomain.toLowerCase())) {
      toast({
        title: "Invalid domain",
        description: "Please enter a valid domain (e.g., docs.example.com)",
        variant: "destructive",
      });
      return;
    }

    setAddingDomain(true);
    try {
      // Generate verification token
      const verificationToken = `docspeare-verify-${crypto.randomUUID().slice(0, 8)}`;

      const { error } = await supabase.from("domains").insert({
        organization_id: organizationId,
        domain: newDomain.toLowerCase(),
        domain_type: "custom",
        verification_token: verificationToken,
        is_primary: domains.length === 0,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Domain already exists",
            description: "This domain is already registered.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Domain added",
        description: "Please add the DNS records to verify your domain.",
      });
      setNewDomain("");
      setAddDomainOpen(false);
      fetchDomains();
    } catch (error) {
      console.error("Error adding domain:", error);
      toast({
        title: "Error",
        description: "Failed to add domain. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingDomain(false);
    }
  };

  const removeDomain = async (domainId: string) => {
    try {
      const { error } = await supabase
        .from("domains")
        .delete()
        .eq("id", domainId);

      if (error) throw error;

      toast({
        title: "Domain removed",
        description: "The domain has been removed.",
      });
      fetchDomains();
    } catch (error) {
      console.error("Error removing domain:", error);
      toast({
        title: "Error",
        description: "Failed to remove domain.",
        variant: "destructive",
      });
    }
  };

  const setPrimaryDomain = async (domainId: string) => {
    try {
      // First, unset all as primary
      await supabase
        .from("domains")
        .update({ is_primary: false })
        .eq("organization_id", organizationId);

      // Then set the selected one as primary
      const { error } = await supabase
        .from("domains")
        .update({ is_primary: true })
        .eq("id", domainId);

      if (error) throw error;

      toast({
        title: "Primary domain updated",
        description: "Your primary domain has been updated.",
      });
      fetchDomains();
    } catch (error) {
      console.error("Error setting primary domain:", error);
      toast({
        title: "Error",
        description: "Failed to update primary domain.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard.",
    });
  };

  const getStatusBadge = (domain: Domain) => {
    if (!domain.is_verified) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
          <AlertCircle className="w-3 h-3 mr-1" />
          Pending verification
        </Badge>
      );
    }

    switch (domain.ssl_status) {
      case "active":
        return (
          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case "provisioning":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Setting up SSL
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
            <AlertCircle className="w-3 h-3 mr-1" />
            SSL failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-600 border-gray-300 bg-gray-50">
            Pending
          </Badge>
        );
    }
  };

  const docspeareDomain = subdomain ? `${subdomain}.${DOCSPEARE_DOMAIN}` : null;

  return (
    <div className="space-y-6">
      {/* Docspeare Subdomain */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Docspeare Subdomain
          </CardTitle>
          <CardDescription>
            Your default documentation URL. This is always available even if you add a custom domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label htmlFor="subdomain" className="sr-only">Subdomain</Label>
              <div className="flex">
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                  placeholder="your-company"
                  className="rounded-r-none"
                />
                <div className="flex items-center px-3 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm">
                  .{DOCSPEARE_DOMAIN}
                </div>
              </div>
            </div>
            <Button onClick={saveSubdomain} disabled={savingSubdomain}>
              {savingSubdomain ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </div>

          {docspeareDomain && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <LinkIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-mono flex-1">{docspeareDomain}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(`https://${docspeareDomain}`)}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://${docspeareDomain}`, "_blank")}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Domains */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Custom Domains
            </CardTitle>
            <CardDescription>
              Add your own domain to brand your documentation (e.g., docs.yourcompany.com)
            </CardDescription>
          </div>
          <Dialog open={addDomainOpen} onOpenChange={setAddDomainOpen}>
            <DialogTrigger asChild>
              <Button>Add Domain</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Domain</DialogTitle>
                <DialogDescription>
                  Enter the domain you want to use for your documentation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-domain">Domain</Label>
                  <Input
                    id="new-domain"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                    placeholder="docs.yourcompany.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDomainOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addCustomDomain} disabled={addingDomain}>
                  {addingDomain ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add Domain
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No custom domains</p>
              <p className="text-sm">Add a custom domain to brand your documentation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {domains.map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{domain.domain}</span>
                        {domain.is_primary && (
                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                        )}
                      </div>
                      {!domain.is_verified && domain.verification_token && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <p className="mb-1">Add this TXT record to verify:</p>
                          <code className="bg-muted px-2 py-1 rounded">
                            _docspeare.{domain.domain} = {domain.verification_token}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(domain)}
                    {!domain.is_verified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchDomains}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    )}
                    {domain.is_verified && !domain.is_primary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPrimaryDomain(domain.id)}
                      >
                        Set Primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeDomain(domain.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {domains.some((d) => !d.is_verified) && (
            <Alert className="mt-4">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>DNS Configuration Required</AlertTitle>
              <AlertDescription className="text-sm">
                <p className="mb-2">To verify your domain, add these DNS records:</p>
                <div className="space-y-2 font-mono text-xs bg-muted p-3 rounded">
                  <p><strong>A Record:</strong> @ → 185.158.133.1</p>
                  <p><strong>A Record:</strong> www → 185.158.133.1</p>
                  <p><strong>TXT Record:</strong> _docspeare → [verification token shown above]</p>
                </div>
                <p className="mt-2 text-muted-foreground">
                  DNS changes can take up to 48 hours to propagate.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Publishing Info */}
      <Card>
        <CardHeader>
          <CardTitle>Where Your Docs Are Published</CardTitle>
          <CardDescription>
            Based on your current configuration, your documentation will be accessible at:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {docspeareDomain && (
              <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-md border border-primary/20">
                <CheckCircle className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">https://{docspeareDomain}</p>
                  <p className="text-sm text-muted-foreground">Docspeare subdomain (always available)</p>
                </div>
              </div>
            )}
            {domains.filter((d) => d.is_verified && d.ssl_status === "active").map((domain) => (
              <div key={domain.id} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium">https://{domain.domain}</p>
                  <p className="text-sm text-muted-foreground">
                    Custom domain {domain.is_primary && "(primary)"}
                  </p>
                </div>
              </div>
            ))}
            {!docspeareDomain && domains.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <p>Configure a subdomain or add a custom domain to publish your documentation.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
