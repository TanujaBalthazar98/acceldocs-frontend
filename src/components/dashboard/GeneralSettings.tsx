import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/api/functions";
import { API_BASE_URL } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Github, ExternalLink, RefreshCw, Globe, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface GeneralSettingsProps {
  onBack: () => void;
}

interface OrgMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

function inferWorkspaceDomain(email?: string | null): string {
  if (!email) return "";
  const atIndex = email.indexOf("@");
  if (atIndex < 0) return "";
  const domain = email.slice(atIndex + 1).trim().toLowerCase();
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return "";
  return domain;
}

export const GeneralSettings = ({ onBack }: GeneralSettingsProps) => {
  const { toast } = useToast();
  const { user, googleAccessToken, requestDriveAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [customDocsDomain, setCustomDocsDomain] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [fontHeading, setFontHeading] = useState("");
  const [fontBody, setFontBody] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroDescription, setHeroDescription] = useState("");
  const [showSearch, setShowSearch] = useState(true);
  const [showFeatured, setShowFeatured] = useState(true);
  const [showDriveId, setShowDriveId] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [autoReconnectDrive, setAutoReconnectDrive] = useState(true);
  const inferredDomain = inferWorkspaceDomain(user?.email);

  useEffect(() => {
    const storedAuto = localStorage.getItem("drive_auto_reconnect");
    if (storedAuto !== null) {
      setAutoReconnectDrive(storedAuto === "1");
    }
    const load = async () => {
      setLoading(true);
      try {
        const { data: workspace, error: workspaceError } = await invokeFunction<{
          ok?: boolean;
          organization?: { id: number; name: string };
          error?: string;
        }>("ensure-workspace", {
          body: {},
        });
        if (workspaceError || !workspace?.organization?.id) {
          throw workspaceError || new Error(workspace?.error || "Failed to load workspace");
        }
        const orgId = Number(workspace.organization.id);
        if (!Number.isFinite(orgId)) {
          throw new Error("Invalid workspace id");
        }
        setOrganizationId(orgId);

        const { data: orgRes, error: orgError } = await invokeFunction<{
          ok?: boolean;
          id?: number;
          name?: string;
          slug?: string;
          domain?: string;
          custom_docs_domain?: string;
          drive_folder_id?: string;
          tagline?: string;
          logo_url?: string;
          primary_color?: string;
          secondary_color?: string;
          accent_color?: string;
          font_heading?: string;
          font_body?: string;
          custom_css?: string;
          hero_title?: string;
          hero_description?: string;
          show_search_on_landing?: boolean;
          show_featured_projects?: boolean;
          members?: any[];
          error?: string;
        }>("get-organization");
        if (orgError || !orgRes?.ok) {
          throw orgError || new Error(orgRes?.error || "Failed to load organization");
        }
        const org = orgRes || {};
        setName(org.name || "");
        setSlug(org.slug || "");
        const resolvedDomain = (org.domain || "").trim().toLowerCase() || inferredDomain;
        setDomain(resolvedDomain);
        setCustomDocsDomain(org.custom_docs_domain || "");
        setDriveFolderId(org.drive_folder_id || "");
        setTagline(org.tagline || "");
        setLogoUrl(org.logo_url || "");
        setPrimaryColor(org.primary_color || "");
        setSecondaryColor(org.secondary_color || "");
        setAccentColor(org.accent_color || "");
        setFontHeading(org.font_heading || "");
        setFontBody(org.font_body || "");
        setCustomCss(org.custom_css || "");
        setHeroTitle(org.hero_title || "");
        setHeroDescription(org.hero_description || "");
        setShowSearch(org.show_search_on_landing ?? true);
        setShowFeatured(org.show_featured_projects ?? true);

        const mapped = Array.isArray(orgRes.members)
          ? orgRes.members.map((member: any) => ({
              id: String(member.id ?? ""),
              email: member.email || "",
              full_name: member.full_name ?? null,
              role: member.role || "viewer",
            }))
          : [];
        setMembers(mapped);
      } catch (error: any) {
        toast({
          title: "Failed to load settings",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [inferredDomain, toast]);

  const handleConnectDrive = async () => {
    const oauthWindow = window.open("about:blank", "_blank");
    if (!oauthWindow) {
      toast({
        title: "Popup blocked",
        description: "Allow popups and try reconnecting Drive again.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await requestDriveAccess({ oauthWindow });
    if (error) {
      toast({
        title: "Drive reconnect failed",
        description: error.message || "Could not start Google Drive authorization.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!organizationId) return;
    setSaving(true);
    const normalizedDomain = (domain.trim().toLowerCase() || inferredDomain || null);
    const payload = {
      name: name.trim(),
      slug: slug.trim() || null,
      domain: normalizedDomain,
      custom_docs_domain: customDocsDomain.trim() || null,
      drive_folder_id: driveFolderId.trim() || null,
      tagline: tagline.trim() || null,
      logo_url: logoUrl.trim() || null,
      primary_color: primaryColor.trim() || null,
      secondary_color: secondaryColor.trim() || null,
      accent_color: accentColor.trim() || null,
      font_heading: fontHeading.trim() || null,
      font_body: fontBody.trim() || null,
      custom_css: customCss.trim() || null,
      hero_title: heroTitle.trim() || null,
      hero_description: heroDescription.trim() || null,
      show_search_on_landing: showSearch,
      show_featured_projects: showFeatured,
    };

    const attempts = [
      { organizationId, data: payload },
      { id: organizationId, ...payload },
      { id: organizationId, data: payload },
      { organizationId, ...payload },
      { org_id: organizationId, data: payload },
    ];

    let finalError: Error | null = null;
    let saved = false;
    for (const body of attempts) {
      const { data: updated, error } = await invokeFunction<{ ok?: boolean; error?: string }>(
        "update-organization",
        { body }
      );
      if (!error && updated?.ok !== false) {
        saved = true;
        break;
      }
      finalError = error || new Error(updated?.error || "Could not update organization.");
    }

    setSaving(false);
    if (!saved) {
      toast({
        title: "Save failed",
        description: finalError?.message || "Could not update organization.",
        variant: "destructive",
      });
      return;
    }

    if (normalizedDomain && normalizedDomain !== domain) {
      setDomain(normalizedDomain);
    }
    toast({ title: "Saved", description: "Organization settings updated." });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleConnectDrive}
            >
              {googleAccessToken ? "Reconnect Drive" : "Connect Drive"}
            </Button>
            <Button onClick={handleSave} disabled={saving || loading || !organizationId}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-foreground">General Settings</h1>
          <p className="text-sm text-muted-foreground">
            Update your organization profile, branding, and Drive connection.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="brand">Branding</TabsTrigger>
              <TabsTrigger value="landing">Landing</TabsTrigger>
              <TabsTrigger value="drive">Drive</TabsTrigger>
              <TabsTrigger value="github">GitHub</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6 space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-tagline">Tagline</Label>
                <Input id="org-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-slug">Slug</Label>
                <Input id="org-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-domain">Domain</Label>
                <Input
                  id="org-domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder={inferredDomain || "example.com"}
                  readOnly={!!inferredDomain}
                />
                {inferredDomain ? (
                  <p className="text-xs text-muted-foreground">
                    Auto-detected from your login email.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-custom-domain">Custom Docs Domain</Label>
                <Input
                  id="org-custom-domain"
                  value={customDocsDomain}
                  onChange={(e) => setCustomDocsDomain(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="brand" className="mt-6 space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="org-logo">Logo URL</Label>
                <Input id="org-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-primary">Primary Color</Label>
                <Input id="org-primary" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-secondary">Secondary Color</Label>
                <Input id="org-secondary" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-accent">Accent Color</Label>
                <Input id="org-accent" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-font-heading">Heading Font</Label>
                <Input id="org-font-heading" value={fontHeading} onChange={(e) => setFontHeading(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-font-body">Body Font</Label>
                <Input id="org-font-body" value={fontBody} onChange={(e) => setFontBody(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-css">Custom CSS</Label>
                <Textarea
                  id="org-css"
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="landing" className="mt-6 space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="org-hero-title">Hero Title</Label>
                <Input id="org-hero-title" value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-hero-desc">Hero Description</Label>
                <Textarea
                  id="org-hero-desc"
                  value={heroDescription}
                  onChange={(e) => setHeroDescription(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 p-4">
                <div>
                  <Label>Show Search on Landing</Label>
                  <div className="text-xs text-muted-foreground">Enable the search bar on docs landing</div>
                </div>
                <Switch checked={showSearch} onCheckedChange={setShowSearch} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 p-4">
                <div>
                  <Label>Show Featured Projects</Label>
                  <div className="text-xs text-muted-foreground">Highlight featured projects on landing</div>
                </div>
                <Switch checked={showFeatured} onCheckedChange={setShowFeatured} />
              </div>
            </TabsContent>

            <TabsContent value="drive" className="mt-6 space-y-5">
              <div className="rounded-lg border border-border/60 bg-card/50 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Google Drive Connection</p>
                  <p className="text-xs text-muted-foreground">
                    Connect Drive to create folders and sync docs automatically.
                  </p>
                </div>
                <Button onClick={handleConnectDrive}>
                  {googleAccessToken ? "Reconnect Drive" : "Connect Drive"}
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 p-4">
                <div>
                  <Label>Auto‑reconnect on expiry</Label>
                  <div className="text-xs text-muted-foreground">
                    Automatically open Google reauth when Drive access expires.
                  </div>
                </div>
                <Switch
                  checked={autoReconnectDrive}
                  onCheckedChange={(value) => {
                    setAutoReconnectDrive(value);
                    localStorage.setItem("drive_auto_reconnect", value ? "1" : "0");
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-drive-folder">Drive Folder ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="org-drive-folder"
                    type={showDriveId ? "text" : "password"}
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDriveId((prev) => !prev)}
                  >
                    {showDriveId ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="github" className="mt-6 space-y-5">
              <GitHubSettingsTab organizationId={organizationId} />
            </TabsContent>

            <TabsContent value="members" className="mt-6 space-y-4">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members found.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium text-foreground">
                          {member.full_name || member.email}
                        </div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                      <span className="text-xs capitalize text-muted-foreground">{member.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

interface GitHubSettingsTabProps {
  organizationId: number | null;
}

interface GitHubSettings {
  connected: boolean;
  username?: string;
  repoName?: string;
  repoFullName?: string;
  customDomain?: string;
  domainVerified?: boolean;
  pagesUrl?: string;
  lastPublishedAt?: string;
}

function GitHubSettingsTab({ organizationId }: GitHubSettingsTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [settings, setSettings] = useState<GitHubSettings | null>(null);
  const [customDomain, setCustomDomain] = useState("");
  const [domainVerifying, setDomainVerifying] = useState(false);

  useEffect(() => {
    if (organizationId) {
      loadSettings();
    }
  }, [organizationId]);

  const loadSettings = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/github/settings/${organizationId}`);
      const data = await response.json();
      if (data.ok) {
        setSettings(data);
        setCustomDomain(data.customDomain || "");
      }
    } catch (error) {
      console.error("Failed to load GitHub settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGitHub = async () => {
    if (!organizationId) return;
    setConnecting(true);
    window.location.href = `${API_BASE_URL}/auth/github/authorize?organizationId=${organizationId}`;
  };

  const handleCreateRepo = async () => {
    if (!organizationId) return;
    setCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/github/create-repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = await response.json();
      if (data.ok) {
        toast({ title: "Repository created", description: `Created ${data.repo.fullName}` });
        await loadSettings();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async () => {
    if (!organizationId) return;
    setPublishing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/publish/mkdocs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = await response.json();
      if (data.ok) {
        toast({ title: "Published!", description: `Docs published to ${data.pagesUrl}` });
        await loadSettings();
      } else {
        toast({ title: "Publish failed", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleSetCustomDomain = async () => {
    if (!organizationId || !customDomain) return;
    setDomainVerifying(true);
    try {
      const response = await fetch(`${API_BASE_URL}/github/custom-domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, domain: customDomain }),
      });
      const data = await response.json();
      if (data.ok) {
        toast({ title: "Custom domain set", description: "Verify DNS configuration" });
        await loadSettings();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDomainVerifying(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!settings?.connected) {
    return (
      <div className="rounded-lg border border-border/60 bg-card/50 p-6 text-center">
        <Github className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">Connect GitHub</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Connect your GitHub account to publish documentation to GitHub Pages.
        </p>
        <Button onClick={handleConnectGitHub} disabled={connecting}>
          <Github className="w-4 h-4 mr-2" />
          {connecting ? "Connecting..." : "Connect GitHub"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/60 bg-card/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Github className="w-5 h-5" />
            <div>
              <p className="font-medium">Connected as @{settings.username}</p>
              <p className="text-xs text-muted-foreground">
                {settings.repoFullName || "No repository created"}
              </p>
            </div>
          </div>
          <CheckCircle className="w-5 h-5 text-green-500" />
        </div>
      </div>

      {!settings.repoName ? (
        <div className="rounded-lg border border-border/60 bg-card/50 p-4">
          <h4 className="font-medium mb-2">Create Documentation Repository</h4>
          <p className="text-sm text-muted-foreground mb-4">
            We'll create a new repository for your documentation and enable GitHub Pages.
          </p>
          <Button onClick={handleCreateRepo} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {creating ? "Creating..." : "Create Repository"}
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border/60 bg-card/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium">Published Site</h4>
                <p className="text-sm text-muted-foreground">
                  {settings.pagesUrl || "Not published yet"}
                </p>
              </div>
              {settings.pagesUrl && (
                <a
                  href={settings.pagesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline flex items-center gap-1"
                >
                  View <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {publishing ? "Publishing..." : "Publish to GitHub Pages"}
            </Button>
            {settings.lastPublishedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Last published: {new Date(settings.lastPublishedAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4" />
              <h4 className="font-medium">Custom Domain</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Use your own domain for the published documentation.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="docs.yourcompany.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
              />
              <Button onClick={handleSetCustomDomain} disabled={domainVerifying || !customDomain}>
                {domainVerifying ? "Setting..." : "Set Domain"}
              </Button>
            </div>
            {settings.customDomain && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                {settings.domainVerified ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-green-600">{settings.customDomain} verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-600">
                      {settings.customDomain} - Add CNAME record pointing to your GitHub Pages domain
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
