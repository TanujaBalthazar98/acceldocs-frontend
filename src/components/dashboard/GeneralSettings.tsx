import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/api/functions";
import { apiFetch } from "@/lib/api/client";
import { orgApi } from "@/api/org";
import { useAuth } from "@/hooks/useAuthNew";
import { useDriveAuth } from "@/hooks/useDriveAuth";
import { Github, ExternalLink, RefreshCw, Globe, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, Link2Off, Bot, Trash2 } from "lucide-react";
import type { AIProvider } from "@/api/types";

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

function normalizeOrgSlug(raw: string): string {
  const seed = raw.trim().toLowerCase();
  if (!seed) return "";
  return seed
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const GeneralSettings = ({ onBack }: GeneralSettingsProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { googleAccessToken, requestDriveAccess } = useDriveAuth();
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
  const [analyticsPropertyId, setAnalyticsPropertyId] = useState("");
  const [copyright, setCopyright] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [sidebarPosition, setSidebarPosition] = useState<"left" | "right">("left");
  const [showToc, setShowToc] = useState(true);
  const [codeTheme, setCodeTheme] = useState("github-dark");
  const [maxContentWidth, setMaxContentWidth] = useState<"4xl" | "5xl" | "6xl" | "full">("4xl");
  const [headerHtml, setHeaderHtml] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [landingBlocks, setLandingBlocks] = useState("");
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
        const org = await orgApi.get();
        setOrganizationId(org.id);
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
        setShowSearch((org as any).show_search_on_landing ?? true);
        setShowFeatured((org as any).show_featured_projects ?? true);
        setAnalyticsPropertyId((org as any).analytics_property_id || "");
        setCopyright((org as any).copyright || "");
        setSidebarPosition(org.sidebar_position === "right" ? "right" : "left");
        setShowToc(org.show_toc ?? true);
        setCodeTheme(org.code_theme || "github-dark");
        setMaxContentWidth(org.max_content_width || "4xl");
        setHeaderHtml(org.header_html || "");
        setFooterHtml(org.footer_html || "");
        setLandingBlocks(org.landing_blocks || "");
        if (org.custom_links) {
          try {
            const parsed = JSON.parse(org.custom_links);
            setSocialLinks(JSON.stringify(parsed, null, 2));
          } catch {
            setSocialLinks(org.custom_links);
          }
        }

        const { members: memberList } = await orgApi.listMembers();
        setMembers(memberList.map((m) => ({
          id: String(m.id),
          email: m.email || "",
          full_name: m.name ?? null,
          role: m.role || "viewer",
        })));
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
    const normalizedSlug = normalizeOrgSlug(slug);
    if (!normalizedSlug) {
      toast({
        title: "Invalid slug",
        description: "Workspace slug must include letters or numbers.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const updatedOrg = await orgApi.update({
        name: name.trim(),
        slug: normalizedSlug,
        domain: domain.trim().toLowerCase() || null,
        logo_url: logoUrl.trim() || null,
        primary_color: primaryColor.trim() || null,
        secondary_color: secondaryColor.trim() || null,
        accent_color: accentColor.trim() || null,
        font_heading: fontHeading.trim() || null,
        font_body: fontBody.trim() || null,
        custom_css: customCss.trim() || null,
        tagline: tagline.trim() || null,
        custom_docs_domain: customDocsDomain.trim() || null,
        hero_title: heroTitle.trim() || null,
        hero_description: heroDescription.trim() || null,
        show_search_on_landing: showSearch,
        show_featured_projects: showFeatured,
        analytics_property_id: analyticsPropertyId.trim() || null,
        copyright: copyright.trim() || null,
        custom_links: socialLinks.trim() || null,
        sidebar_position: sidebarPosition,
        show_toc: showToc,
        code_theme: codeTheme.trim() || null,
        max_content_width: maxContentWidth,
        header_html: headerHtml.trim() || null,
        footer_html: footerHtml.trim() || null,
        landing_blocks: landingBlocks.trim() || null,
      });
      setSlug(updatedOrg.slug || normalizedSlug);
      setDomain((updatedOrg.domain || "").trim().toLowerCase());
      toast({ title: "Saved", description: "Organization settings updated." });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error?.message || "Could not update organization.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-8">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="brand">Branding</TabsTrigger>
              <TabsTrigger value="landing">Landing</TabsTrigger>
              <TabsTrigger value="docs">Docs Site</TabsTrigger>
              <TabsTrigger value="drive">Drive</TabsTrigger>
              <TabsTrigger value="github">GitHub</TabsTrigger>
              <TabsTrigger value="ai">AI</TabsTrigger>
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
                <Input
                  id="org-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  onBlur={() => setSlug(normalizeOrgSlug(slug))}
                />
                <p className="text-xs text-muted-foreground">
                  Public docs URL path: <span className="font-mono">/docs/{normalizeOrgSlug(slug) || "workspace-slug"}</span>
                </p>
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

            <TabsContent value="docs" className="mt-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Published Docs Site</h3>
                <p className="text-xs text-muted-foreground">
                  Control how your published documentation renders for readers.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-sidebar-pos">Sidebar position</Label>
                <Select value={sidebarPosition} onValueChange={(value) => setSidebarPosition(value as "left" | "right")}>
                  <SelectTrigger id="org-sidebar-pos">
                    <SelectValue placeholder="Sidebar position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 p-4">
                <div>
                  <Label>Show table of contents</Label>
                  <div className="text-xs text-muted-foreground">
                    Show section anchors in the right rail while reading a page.
                  </div>
                </div>
                <Switch checked={showToc} onCheckedChange={setShowToc} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-code-theme">Code block theme</Label>
                <Select value={codeTheme} onValueChange={setCodeTheme}>
                  <SelectTrigger id="org-code-theme">
                    <SelectValue placeholder="Code theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="github-dark">GitHub Dark</SelectItem>
                    <SelectItem value="github-light">GitHub Light</SelectItem>
                    <SelectItem value="nord">Nord</SelectItem>
                    <SelectItem value="material-theme">Material</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-content-width">Content width</Label>
                <Select value={maxContentWidth} onValueChange={(value) => setMaxContentWidth(value as "4xl" | "5xl" | "6xl" | "full")}>
                  <SelectTrigger id="org-content-width">
                    <SelectValue placeholder="Content width" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4xl">Standard (4xl)</SelectItem>
                    <SelectItem value="5xl">Wide (5xl)</SelectItem>
                    <SelectItem value="6xl">Extra wide (6xl)</SelectItem>
                    <SelectItem value="full">Full width</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-header-html">Header HTML (optional)</Label>
                <Textarea
                  id="org-header-html"
                  value={headerHtml}
                  onChange={(e) => setHeaderHtml(e.target.value)}
                  rows={3}
                  placeholder="<div>Banner / alert / announcement</div>"
                  className="font-mono text-xs"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-footer-html">Footer HTML (optional)</Label>
                <Textarea
                  id="org-footer-html"
                  value={footerHtml}
                  onChange={(e) => setFooterHtml(e.target.value)}
                  rows={3}
                  placeholder="<div>Copyright and links</div>"
                  className="font-mono text-xs"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-landing-blocks">Landing blocks JSON (optional)</Label>
                <Textarea
                  id="org-landing-blocks"
                  value={landingBlocks}
                  onChange={(e) => setLandingBlocks(e.target.value)}
                  rows={6}
                  placeholder='[{"title":"Get started","description":"Start here","href":"/docs/getting-started"}]'
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Advanced: custom cards/sections for your docs landing page.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-analytics">Google Analytics Property ID</Label>
                <Input
                  id="org-analytics"
                  value={analyticsPropertyId}
                  onChange={(e) => setAnalyticsPropertyId(e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                />
                <p className="text-xs text-muted-foreground">Enables Google Analytics on your published docs site.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-copyright">Copyright Notice</Label>
                <Input
                  id="org-copyright"
                  value={copyright}
                  onChange={(e) => setCopyright(e.target.value)}
                  placeholder="© 2026 Your Name"
                />
                <p className="text-xs text-muted-foreground">Shown in the site footer.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-social">Social Links</Label>
                <Textarea
                  id="org-social"
                  value={socialLinks}
                  onChange={(e) => setSocialLinks(e.target.value)}
                  rows={6}
                  placeholder={`[\n  {\n    "link": "https://github.com/you",\n    "icon": "fontawesome/brands/github",\n    "name": "GitHub"\n  }\n]`}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  JSON array of social links. Each item: <code className="bg-muted px-1 rounded">{"{ link, icon, name }"}</code>.
                  Icons use <a href="https://fontawesome.com/icons" target="_blank" rel="noopener noreferrer" className="underline">FontAwesome</a> names like <code className="bg-muted px-1 rounded">fontawesome/brands/github</code>.
                </p>
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

            <TabsContent value="ai" className="mt-6">
              <AISettingsTab />
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

// ---------------------------------------------------------------------------
// Connect GitHub Dialog — guided PAT flow
// ---------------------------------------------------------------------------

interface ConnectGitHubDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: number;
  onConnected: () => void;
}

function ConnectGitHubDialog({
  open,
  onOpenChange,
  organizationId,
  onConnected,
}: ConnectGitHubDialogProps) {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PAT_URL =
    "https://github.com/settings/tokens/new?scopes=repo&description=AccelDocs+Publishing";

  const handleConnect = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Please paste your GitHub token.");
      return;
    }
    setError(null);
    setConnecting(true);
    try {
      const { data, error: fetchErr } = await apiFetch<{ ok: boolean; error?: string; username?: string }>("/api/github/connect", {
        method: "POST",
        body: JSON.stringify({ organizationId, token: trimmed }),
      });
      if (fetchErr) {
        setError(fetchErr.message || "Connection failed. Please try again.");
        return;
      }
      if (!data?.ok) {
        setError(data?.error || "Connection failed. Please try again.");
        return;
      }
      toast({ title: "GitHub connected", description: `Connected as @${data.username}` });
      setToken("");
      onOpenChange(false);
      onConnected();
    } catch (e: any) {
      setError(e?.message || "Unexpected error. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Connect GitHub Account
          </DialogTitle>
          <DialogDescription>
            Use a Personal Access Token (PAT) to securely connect your GitHub account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Step 1 */}
          <div className="rounded-lg bg-muted/50 border border-border/60 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Step 1 — Create a token on GitHub</p>
            <p className="text-xs text-muted-foreground">
              We need a token with the <code className="bg-muted px-1 rounded text-xs">repo</code> scope so
              we can create and push to repositories on your behalf.
            </p>
            <a
              href={PAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
            >
              Open GitHub → Create token <ExternalLink className="w-3 h-3" />
            </a>
            <p className="text-xs text-muted-foreground">
              On the GitHub page, scroll down and click{" "}
              <strong className="text-foreground">"Generate token"</strong>. Then copy the token — it
              starts with <code className="bg-muted px-1 rounded">ghp_</code>.
            </p>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Step 2 — Paste your token here</p>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setError(null);
                }}
                className="pr-10 font-mono text-sm"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your token is encrypted and stored securely. We never display it again after saving.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={connecting}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={connecting || !token.trim()}>
              {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Github className="w-4 h-4 mr-2" />}
              {connecting ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Create Repo Dialog
// ---------------------------------------------------------------------------

interface CreateRepoDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: number;
  defaultRepoName: string;
  onCreated: () => void;
}

function CreateRepoDialog({
  open,
  onOpenChange,
  organizationId,
  defaultRepoName,
  onCreated,
}: CreateRepoDialogProps) {
  const { toast } = useToast();
  const [repoName, setRepoName] = useState(defaultRepoName);
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync default when parent provides a new value
  useEffect(() => {
    setRepoName(defaultRepoName);
  }, [defaultRepoName]);

  const handleCreate = async () => {
    const name = repoName.trim();
    if (!name) {
      setError("Repository name is required.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const { data, error: fetchErr } = await apiFetch<{
        ok: boolean;
        error?: string;
        repo?: { fullName: string; htmlUrl: string };
        pagesUrl?: string;
      }>("/api/github/create-repo", {
        method: "POST",
        body: JSON.stringify({ organizationId, repoName: name, private: isPrivate }),
      });
      if (fetchErr) {
        setError(fetchErr.message || "Failed to create repository.");
        return;
      }
      if (!data?.ok) {
        setError(data?.error || "Failed to create repository.");
        return;
      }
      toast({
        title: "Repository created",
        description: `${data.repo?.fullName} — GitHub Pages will be live shortly`,
      });
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      setError(e?.message || "Unexpected error.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Documentation Repository</DialogTitle>
          <DialogDescription>
            We'll create a GitHub repository and enable GitHub Pages for your docs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="repo-name">Repository name</Label>
            <Input
              id="repo-name"
              value={repoName}
              onChange={(e) => {
                setRepoName(e.target.value);
                setError(null);
              }}
              placeholder="my-org-docs"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The repo will be created under your GitHub account.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Private repository</p>
              <p className="text-xs text-muted-foreground">GitHub Pages still works on public repos</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !repoName.trim()}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {creating ? "Creating…" : "Create Repository"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main GitHubSettingsTab
// ---------------------------------------------------------------------------

function GitHubSettingsTab({ organizationId }: GitHubSettingsTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [settings, setSettings] = useState<GitHubSettings | null>(null);
  const [customDomain, setCustomDomain] = useState("");
  const [domainVerifying, setDomainVerifying] = useState(false);

  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showCreateRepoDialog, setShowCreateRepoDialog] = useState(false);

  useEffect(() => {
    if (organizationId) loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const { data } = await apiFetch<GitHubSettings & { ok: boolean }>(`/api/github/settings/${organizationId}`);
      if (data?.ok) {
        setSettings(data);
        setCustomDomain(data.customDomain || "");
      }
    } catch (err) {
      console.error("Failed to load GitHub settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!organizationId) return;
    setPublishing(true);
    try {
      const publishHeaders: Record<string, string> = {};
      try {
        const gToken = localStorage.getItem("google_access_token") || null;
        if (gToken) {
          publishHeaders["x-google-token"] = gToken;
        }
      } catch (_) {
        // ignore localStorage errors
      }
      const { data, error } = await apiFetch<{ ok: boolean; error?: string; pagesUrl?: string; published?: number; skipped?: number; errors?: number; pushed?: boolean; pushWarning?: string; contentFetched?: number; totalDocsFound?: number; hasGoogleToken?: boolean; docDetails?: Array<{id: number; title: string; status: string}> }>(
        "/publish/mkdocs",
        { method: "POST", body: JSON.stringify({ organizationId }), headers: publishHeaders }
      );
      // Log full response for debugging
      console.log("[Publish] Full response:", JSON.stringify(data, null, 2));
      if (error || !data?.ok) {
        toast({ title: "Publish failed", description: error?.message || data?.error, variant: "destructive" });
      } else {
        const detail = [
          `Found ${data.totalDocsFound ?? 0} docs`,
          data.published ? `${data.published} committed` : "0 committed",
          data.contentFetched ? `${data.contentFetched} fetched from Drive` : null,
          data.pushed ? "pushed to GitHub" : null,
          data.skipped ? `${data.skipped} skipped` : null,
          data.errors ? `${data.errors} errors` : null,
          data.hasGoogleToken ? "has Drive token" : "no Drive token",
        ].filter(Boolean).join(", ");
        toast({ title: "Published", description: detail });
        // Always show per-doc details so user can see what happened to each doc
        if (data.docDetails && data.docDetails.length > 0) {
          const notPublished = data.docDetails
            .filter((d: {status: string}) => d.status !== "published")
            .slice(0, 8)
            .map((d: {title: string; status: string}) => `${d.title}: ${d.status}`)
            .join("\n");
          if (notPublished) {
            toast({ title: `${data.docDetails.filter((d: {status: string}) => d.status !== "published").length} docs not published`, description: notPublished, variant: "destructive" });
          }
        }
        if (data.pushWarning) {
          toast({ title: "Publish Warning", description: data.pushWarning, variant: "destructive" });
        }
        // Show debug info so we can diagnose build issues
        const dbg = (data as any)?._debug;
        if (dbg) {
          const mdCount = dbg.mdFiles?.length ?? 0;
          const hasToml = !!dbg.zensicalToml;
          const lastCommit = dbg.gitLog?.[0] ?? "none";
          console.log("[Publish] Debug:", dbg);
          toast({
            title: "Build Debug",
            description: `${mdCount} md files, toml: ${hasToml ? "yes" : "no"}, last commit: ${lastCommit}`,
          });
        }
        await loadSettings();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleSetCustomDomain = async () => {
    if (!organizationId || !customDomain.trim()) return;
    setDomainVerifying(true);
    try {
      const { data, error } = await apiFetch<{ ok: boolean; error?: string; cname?: string }>(
        "/api/github/custom-domain",
        { method: "POST", body: JSON.stringify({ organizationId, domain: customDomain.trim() }) }
      );
      if (error || !data?.ok) {
        toast({ title: "Failed", description: error?.message || data?.error, variant: "destructive" });
      } else {
        toast({
          title: "Custom domain saved",
          description: `Add a CNAME record: ${customDomain} → ${data.cname}`,
        });
        await loadSettings();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDomainVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (!organizationId) return;
    if (!confirm("Disconnect GitHub? This will remove the stored token but won't delete the repository.")) return;
    setDisconnecting(true);
    try {
      const { data, error } = await apiFetch<{ ok: boolean; error?: string }>(
        "/api/github/disconnect",
        { method: "DELETE", body: JSON.stringify({ organizationId }) }
      );
      if (error || !data?.ok) {
        toast({ title: "Failed", description: error?.message || data?.error, variant: "destructive" });
      } else {
        toast({ title: "GitHub disconnected" });
        await loadSettings();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading GitHub settings…
      </div>
    );
  }

  // ---- Not connected ----
  if (!settings?.connected) {
    return (
      <>
        <ConnectGitHubDialog
          open={showConnectDialog}
          onOpenChange={setShowConnectDialog}
          organizationId={organizationId!}
          onConnected={loadSettings}
        />
        <div className="rounded-lg border border-border/60 bg-card/50 p-8 text-center space-y-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted mx-auto">
            <Github className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Publish to GitHub Pages</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Connect a GitHub account using a Personal Access Token and we'll host your docs on GitHub Pages — for free.
            </p>
          </div>
          <Button onClick={() => setShowConnectDialog(true)}>
            <Github className="w-4 h-4 mr-2" />
            Connect GitHub
          </Button>
          <p className="text-xs text-muted-foreground">
            Requires a token with the <code className="bg-muted px-1 rounded">repo</code> scope.
          </p>
        </div>
      </>
    );
  }

  // ---- Connected ----
  const safeSlug = (settings.username || "docs").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const defaultRepoName = `${safeSlug}-docs`;

  return (
    <>
      <CreateRepoDialog
        open={showCreateRepoDialog}
        onOpenChange={setShowCreateRepoDialog}
        organizationId={organizationId!}
        defaultRepoName={settings.repoName || defaultRepoName}
        onCreated={loadSettings}
      />

      <div className="space-y-5">
        {/* Connection status */}
        <div className="rounded-lg border border-border/60 bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted">
                <Github className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  @{settings.username}
                </p>
                <p className="text-xs text-muted-foreground">
                  {settings.repoFullName
                    ? `github.com/${settings.repoFullName}`
                    : "No repository created yet"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                <CheckCircle className="w-3 h-3" /> Connected
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
                title="Disconnect GitHub"
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2Off className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Create repo */}
        {!settings.repoName ? (
          <div className="rounded-lg border border-border/60 bg-card/50 p-5 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Create Documentation Repository</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                We'll create a GitHub repo and enable GitHub Pages so your docs have a public URL.
              </p>
            </div>
            <Button onClick={() => setShowCreateRepoDialog(true)}>
              Create Repository
            </Button>
          </div>
        ) : (
          <>
            {/* Publish */}
            <div className="rounded-lg border border-border/60 bg-card/50 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Published Site</h4>
                  {settings.pagesUrl ? (
                    <a
                      href={settings.pagesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      {settings.pagesUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Not published yet</p>
                  )}
                </div>
              </div>
              <Button onClick={handlePublish} disabled={publishing}>
                {publishing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {publishing ? "Publishing…" : "Publish docs"}
              </Button>
              {settings.lastPublishedAt && (
                <p className="text-xs text-muted-foreground">
                  Last published: {new Date(settings.lastPublishedAt).toLocaleString()}
                </p>
              )}
            </div>

            {/* Custom domain */}
            <div className="rounded-lg border border-border/60 bg-card/50 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-foreground">Custom Domain</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Point your own domain at the GitHub Pages site. Enter it below, then add a{" "}
                <strong>CNAME</strong> DNS record at your registrar.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="docs.yourcompany.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                />
                <Button
                  onClick={handleSetCustomDomain}
                  disabled={domainVerifying || !customDomain.trim()}
                  variant="secondary"
                >
                  {domainVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set"}
                </Button>
              </div>
              {settings.customDomain && (
                <div className="flex items-start gap-2 text-xs rounded-md border p-3">
                  {settings.domainVerified ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-green-700">{settings.customDomain} is verified</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-amber-700">
                        <strong>{settings.customDomain}</strong> — DNS not yet verified.{" "}
                        Add a CNAME record pointing to{" "}
                        <code className="bg-muted px-1 rounded">{settings.username?.toLowerCase()}.github.io</code>
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}


// ---------------------------------------------------------------------------
// AI Settings Tab — BYOK (Bring Your Own Key)
// ---------------------------------------------------------------------------

const AI_PROVIDERS: { value: AIProvider; label: string; description: string; needsBaseUrl: boolean }[] = [
  { value: "gemini", label: "Google Gemini", description: "Free tier available (gemini-2.0-flash)", needsBaseUrl: false },
  { value: "anthropic", label: "Anthropic Claude", description: "High quality (claude-sonnet)", needsBaseUrl: false },
  { value: "groq", label: "Groq", description: "Free tier (Llama 4 Scout)", needsBaseUrl: false },
  { value: "openai_compat", label: "OpenAI-compatible", description: "Ollama, vLLM, or any OpenAI API", needsBaseUrl: true },
];

function AISettingsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<AIProvider | "">("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await orgApi.getAISettings();
        setProvider(data.ai_provider || "gemini");
        setHasKey(data.ai_has_key);
        setModel(data.ai_model || "");
        setBaseUrl(data.ai_base_url || "");
      } catch {
        // Not configured yet — that's fine
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!provider) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = { ai_provider: provider };
      if (apiKey.trim()) payload.ai_api_key = apiKey.trim();
      if (model.trim()) payload.ai_model = model.trim();
      if (baseUrl.trim()) payload.ai_base_url = baseUrl.trim();
      const data = await orgApi.updateAISettings(payload);
      setHasKey(data.ai_has_key);
      setApiKey("");
      toast({ title: "AI settings saved" });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remove AI configuration? AI features will be disabled for this workspace.")) return;
    setSaving(true);
    try {
      await orgApi.deleteAISettings();
      setProvider("gemini");
      setApiKey("");
      setModel("");
      setBaseUrl("");
      setHasKey(false);
      toast({ title: "AI settings removed" });
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading AI settings...
      </div>
    );
  }

  const selectedProvider = AI_PROVIDERS.find((p) => p.value === provider);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/60 bg-card/50 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted">
            <Bot className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">AI Agent Configuration</h4>
            <p className="text-xs text-muted-foreground">
              Configure your LLM provider API key to enable AI-powered features (chat agent, inline assistant, template generation).
            </p>
          </div>
        </div>

        {hasKey && (
          <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5 w-fit">
            <CheckCircle className="w-3 h-3" /> API key configured
          </div>
        )}

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as AIProvider)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex flex-col">
                      <span>{p.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProvider && (
              <p className="text-xs text-muted-foreground">{selectedProvider.description}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={hasKey ? "Key saved (enter new key to replace)" : "Enter your API key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10 font-mono text-sm"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your key is encrypted at rest and never exposed via the API.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Model (optional)</Label>
            <Input
              placeholder={
                provider === "gemini" ? "gemini-2.0-flash" :
                provider === "anthropic" ? "claude-sonnet-4-5-20250514" :
                provider === "groq" ? "llama-4-scout-17b-16e-instruct" :
                "model name"
              }
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the default model for the selected provider.
            </p>
          </div>

          {selectedProvider?.needsBaseUrl && (
            <div className="grid gap-2">
              <Label>Base URL</Label>
              <Input
                placeholder="http://localhost:11434/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                The OpenAI-compatible API base URL (e.g. Ollama, vLLM).
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {hasKey && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={saving}>
                <Trash2 className="w-4 h-4 mr-1.5" />
                Remove AI config
              </Button>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving || !provider}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {saving ? "Saving..." : "Save AI Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
