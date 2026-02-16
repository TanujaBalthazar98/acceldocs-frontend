import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/api/functions";
import { useAuth } from "@/contexts/AuthContext";

interface GeneralSettingsProps {
  onBack: () => void;
}

interface OrgMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export const GeneralSettings = ({ onBack }: GeneralSettingsProps) => {
  const { toast } = useToast();
  const { googleAccessToken, requestDriveAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
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

  useEffect(() => {
    const storedAuto = localStorage.getItem("drive_auto_reconnect");
    if (storedAuto !== null) {
      setAutoReconnectDrive(storedAuto === "1");
    }
    const load = async () => {
      setLoading(true);
      try {
        const { data: workspace, error: workspaceError } = await invokeFunction("ensure-workspace", {
          body: {},
        });
        if (workspaceError || !workspace?.organizationId) {
          throw workspaceError || new Error(workspace?.error || "Failed to load workspace");
        }
        const orgId = String(workspace.organizationId);
        setOrganizationId(orgId);

        const { data: orgRes, error: orgError } = await invokeFunction<{
          ok?: boolean;
          organization?: any;
          error?: string;
        }>("get-organization");
        if (orgError || !orgRes?.ok) {
          throw orgError || new Error(orgRes?.error || "Failed to load organization");
        }
        const org = orgRes.organization || {};
        setName(org.name || "");
        setSlug(org.slug || "");
        setDomain(org.domain || "");
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
  }, [toast]);

  const handleSave = async () => {
    if (!organizationId) return;
    setSaving(true);
    const { data: updated, error } = await invokeFunction<{
      ok?: boolean;
      error?: string;
    }>("update-organization", {
      body: {
        organizationId,
        data: {
          name: name.trim(),
          slug: slug.trim() || null,
          domain: domain.trim() || null,
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
        },
      },
    });
    setSaving(false);
    if (error || (updated && updated.ok === false)) {
      toast({
        title: "Save failed",
        description: error?.message || updated?.error || "Could not update organization.",
        variant: "destructive",
      });
      return;
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
              onClick={() => requestDriveAccess()}
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
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="brand">Branding</TabsTrigger>
              <TabsTrigger value="landing">Landing</TabsTrigger>
              <TabsTrigger value="drive">Drive</TabsTrigger>
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
                <Input id="org-domain" value={domain} onChange={(e) => setDomain(e.target.value)} />
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
                <Button onClick={() => requestDriveAccess()}>
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
