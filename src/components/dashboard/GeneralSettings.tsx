import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  FolderOpen,
  ExternalLink,
  Users,
  AlertTriangle,
  Building2,
  Trash2,
  Palette,
  Type,
  Image,
  Layout,
  Code,
  Upload,
  X,
  Sun,
  Moon,
  Monitor,
  Globe,
  Loader2,
  Wand2,
  UserPlus,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { JoinRequestsPanel } from "./JoinRequestsPanel";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { DomainSettings } from "./DomainSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import docspeareIcon from "@/assets/docspeare-icon.png";

interface GeneralSettingsProps {
  onBack: () => void;
}

interface Member {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface BrandingData {
  logo_url: string | null;
  tagline: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  custom_css: string | null;
  hero_title: string | null;
  hero_description: string | null;
  show_search_on_landing: boolean;
  show_featured_projects: boolean;
}

const fontOptions = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Source Sans Pro",
  "Nunito",
  "Raleway",
  "Work Sans",
  "DM Sans",
  "Plus Jakarta Sans",
  "Space Grotesk",
  "IBM Plex Sans",
];

export const GeneralSettings = ({ onBack }: GeneralSettingsProps) => {
  const { user, profileOrganizationId, profileLoading, requestDriveAccess } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [orgSubdomain, setOrgSubdomain] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [customDocsDomain, setCustomDocsDomain] = useState("");
  const [savingCustomDomain, setSavingCustomDomain] = useState(false);
  const [rootFolderId, setRootFolderId] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractingStyles, setExtractingStyles] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [inviteMemberOpen, setInviteMemberOpen] = useState(false);
  const [reconnectingDrive, setReconnectingDrive] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const [branding, setBranding] = useState<BrandingData>({
    logo_url: null,
    tagline: null,
    primary_color: "#3B82F6",
    secondary_color: "#1E40AF",
    accent_color: "#F59E0B",
    font_heading: "Inter",
    font_body: "Inter",
    custom_css: null,
    hero_title: null,
    hero_description: null,
    show_search_on_landing: true,
    show_featured_projects: true,
  });

  useEffect(() => {
    let active = true;

    const fetchOrgData = async () => {
      if (!user) {
        if (!active) return;
        setIsLoading(false);
        return;
      }

      // Wait for AuthContext to finish loading the user's profile/org
      if (profileLoading) {
        if (!active) return;
        setIsLoading(true);
        return;
      }

      const orgId = profileOrganizationId;

      if (!orgId) {
        if (!active) return;
        setOrganizationId(null);
        setOrgName("");
        setDomain("");
        setMembers([]);
        setIsLoading(false);
        return;
      }

      if (!active) return;
      setIsLoading(true);

      try {
        setOrganizationId(orgId);

        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select(
            "name, domain, slug, subdomain, drive_folder_id, custom_docs_domain, logo_url, tagline, primary_color, secondary_color, accent_color, font_heading, font_body, custom_css, hero_title, hero_description, show_search_on_landing, show_featured_projects"
          )
          .eq("id", orgId)
          .maybeSingle();

        if (!active) return;

        if (orgError) {
          console.error("Error fetching organization:", orgError);
          toast({
            title: "Couldn't load settings",
            description: orgError.message,
            variant: "destructive",
          });
          return;
        }

        if (!org) {
          toast({
            title: "Organization not found",
            description: "Your account isn't connected to an organization yet.",
            variant: "destructive",
          });
          return;
        }

        setOrgName(org.name);
        setOrgSlug(org.slug || null);
        setOrgSubdomain(org.subdomain || null);
        setDomain(org.domain);
        setCustomDocsDomain(org.custom_docs_domain || "");
        setRootFolderId(org.drive_folder_id || "");
        setBranding({
          logo_url: org.logo_url,
          tagline: org.tagline,
          primary_color: org.primary_color || "#3B82F6",
          secondary_color: org.secondary_color || "#1E40AF",
          accent_color: org.accent_color || "#F59E0B",
          font_heading: org.font_heading || "Inter",
          font_body: org.font_body || "Inter",
          custom_css: org.custom_css,
          hero_title: org.hero_title,
          hero_description: org.hero_description,
          show_search_on_landing: org.show_search_on_landing ?? true,
          show_featured_projects: org.show_featured_projects ?? true,
        });

        // Get team members - use user_roles as source of truth for org membership
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("organization_id", orgId);

        if (!active) return;

        if (roles && roles.length > 0) {
          // Fetch profiles for all users in user_roles
          const userIds = roles.map((r) => r.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email, full_name")
            .in("id", userIds);

          if (!active) return;

          if (profiles) {
            const memberList = roles.map((r) => {
              const profile = profiles.find((p) => p.id === r.user_id);
              return {
                id: r.user_id,
                email: profile?.email || "Unknown",
                full_name: profile?.full_name || null,
                role: r.role,
              };
            });
            setMembers(memberList);
          }
        } else {
          setMembers([]);
        }
      } catch (error) {
        console.error("Error in fetchOrgData:", error);
        toast({
          title: "Couldn't load settings",
          description: "Please refresh and try again.",
          variant: "destructive",
        });
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchOrgData();

    return () => {
      active = false;
    };
  }, [user?.id, profileOrganizationId, profileLoading, toast]);

  const handleSaveCustomDomain = async () => {
    if (!organizationId) return;

    setSavingCustomDomain(true);

    // Validate domain format
    const domainValue = customDocsDomain.trim().toLowerCase();
    if (domainValue && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(domainValue)) {
      toast({
        title: "Invalid domain format",
        description: "Please enter a valid domain (e.g., docs.company.com)",
        variant: "destructive",
      });
      setSavingCustomDomain(false);
      return;
    }

    const { error } = await supabase
      .from("organizations")
      .update({ custom_docs_domain: domainValue || null })
      .eq("id", organizationId);

    if (error) {
      toast({
        title: "Error saving custom domain",
        description: error.message.includes("duplicate") 
          ? "This domain is already in use by another organization"
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Custom domain saved",
        description: domainValue 
          ? "Your documentation domain has been configured. Set up DNS to point to Lovable."
          : "Custom domain has been removed.",
      });
    }

    setSavingCustomDomain(false);
  };

  const handleSaveRootFolder = async () => {
    if (!organizationId || !rootFolderId.trim()) return;

    setIsSavingFolder(true);

    const { error } = await supabase
      .from("organizations")
      .update({ drive_folder_id: rootFolderId.trim() })
      .eq("id", organizationId);

    if (error) {
      toast({
        title: "Error saving root folder",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Root folder saved",
        description: "Your Google Drive root folder has been configured.",
      });
    }

    setIsSavingFolder(false);
  };

  const handleReconnectDrive = async () => {
    setReconnectingDrive(true);
    try {
      const { error } = await requestDriveAccess();
      if (error) {
        toast({
          title: "Error reconnecting",
          description: error.message,
          variant: "destructive",
        });
        setReconnectingDrive(false);
      }
      // If successful, the page will redirect for OAuth
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reconnect Google Drive",
        variant: "destructive",
      });
      setReconnectingDrive(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    if (!organizationId || memberId === user?.id) return;

    setUpdatingRole(memberId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as "owner" | "admin" | "editor" | "viewer" })
        .eq("user_id", memberId)
        .eq("organization_id", organizationId);

      if (error) throw error;

      setMembers(prev => prev.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));

      toast({
        title: "Role updated",
        description: `Member role changed to ${newRole}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating role",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId) return;

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${organizationId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("org-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("org-logos")
        .getPublicUrl(fileName);

      setBranding(prev => ({ ...prev, logo_url: publicUrl }));
      
      toast({
        title: "Logo uploaded",
        description: "Your logo has been uploaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!organizationId) return;

    try {
      await supabase.storage
        .from("org-logos")
        .remove([`${organizationId}/logo.png`, `${organizationId}/logo.jpg`, `${organizationId}/logo.svg`]);

      setBranding(prev => ({ ...prev, logo_url: null }));
      
      toast({
        title: "Logo removed",
        description: "Your logo has been removed.",
      });
    } catch (error: any) {
      console.error("Error removing logo:", error);
    }
  };

  const handleSaveBranding = async () => {
    if (!organizationId) return;

    setSavingBranding(true);

    const { error } = await supabase
      .from("organizations")
      .update({
        logo_url: branding.logo_url,
        tagline: branding.tagline,
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
        accent_color: branding.accent_color,
        font_heading: branding.font_heading,
        font_body: branding.font_body,
        custom_css: branding.custom_css,
        hero_title: branding.hero_title,
        hero_description: branding.hero_description,
        show_search_on_landing: branding.show_search_on_landing,
        show_featured_projects: branding.show_featured_projects,
      })
      .eq("id", organizationId);

    if (error) {
      toast({
        title: "Error saving branding",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Branding saved",
        description: "Your documentation branding has been updated.",
      });
    }

    setSavingBranding(false);
  };

  const updateBranding = <K extends keyof BrandingData>(key: K, value: BrandingData[K]) => {
    setBranding(prev => ({ ...prev, [key]: value }));
  };

  const handleExtractStyles = async () => {
    if (!websiteUrl.trim()) {
      toast({
        title: "Website URL required",
        description: "Please enter your company website URL to extract styles.",
        variant: "destructive",
      });
      return;
    }

    setExtractingStyles(true);

    try {
      const { data, error } = await supabase.functions.invoke("extract-website-styles", {
        body: { websiteUrl: websiteUrl.trim() },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        setBranding(prev => ({
          ...prev,
          primary_color: data.data.primary_color || prev.primary_color,
          secondary_color: data.data.secondary_color || prev.secondary_color,
          accent_color: data.data.accent_color || prev.accent_color,
          font_heading: data.data.font_heading || prev.font_heading,
          font_body: data.data.font_body || prev.font_body,
        }));

        toast({
          title: "Styles extracted!",
          description: "Brand colors and fonts have been applied. Don't forget to save.",
        });
      } else {
        throw new Error(data?.error || "Failed to extract styles");
      }
    } catch (error: any) {
      console.error("Error extracting styles:", error);
      toast({
        title: "Extraction failed",
        description: error.message || "Could not extract styles from the website.",
        variant: "destructive",
      });
    } finally {
      setExtractingStyles(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden shadow-glow animate-pulse">
            <img src={docspeareIcon} alt="Loading" className="w-full h-full object-cover" />
          </div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization, branding, and preferences
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="domains">Domains</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-10">
            {/* Organization */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Organization</h2>
              </div>
              
              <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Domain
                  </label>
                  <div className="px-4 py-2.5 rounded-lg bg-secondary/50 border border-border text-sm text-muted-foreground">
                    {domain}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Users with this email domain automatically join your organization.
                  </p>
                </div>
              </div>
            </section>

            {/* Root Folder */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Google Drive Root Folder</h2>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter your Google Drive folder ID. All projects and pages will be created within this folder.
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Root Folder ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={rootFolderId}
                      onChange={(e) => setRootFolderId(e.target.value)}
                      placeholder="e.g., 1abc123XYZ..."
                      className="flex-1 px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <Button 
                      onClick={handleSaveRootFolder}
                      disabled={isSavingFolder || !rootFolderId.trim()}
                    >
                      {isSavingFolder ? "Saving..." : "Save"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Find this in your Google Drive folder URL: drive.google.com/drive/folders/<strong>FOLDER_ID</strong>
                  </p>
                </div>

                {rootFolderId && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
                    <FolderOpen className="w-5 h-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Root folder configured
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {rootFolderId}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(`https://drive.google.com/drive/folders/${rootFolderId}`, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Reconnect Drive */}
                <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Having trouble creating folders or files?
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        If you're getting permission errors, reconnect Google Drive to grant write access.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={handleReconnectDrive}
                        disabled={reconnectingDrive}
                      >
                        {reconnectingDrive ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Reconnecting...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Reconnect Google Drive
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Team Members */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
                </div>
                <Button variant="outline" size="sm" onClick={() => setInviteMemberOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="divide-y divide-border">
                  {members.length === 0 ? (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      No team members yet
                    </div>
                  ) : (
                    members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {(member.full_name || member.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {member.full_name || member.email.split("@")[0]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </div>
                        {member.role === "owner" || member.id === user?.id ? (
                          <span className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground bg-secondary capitalize">
                            {member.role}
                            {member.id === user?.id && " (you)"}
                          </span>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 gap-1 text-xs capitalize"
                                disabled={updatingRole === member.id}
                              >
                                {updatingRole === member.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    {member.role}
                                    <ChevronDown className="w-3 h-3" />
                                  </>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {["admin", "editor", "viewer"].map((role) => (
                                <DropdownMenuItem
                                  key={role}
                                  onClick={() => handleUpdateMemberRole(member.id, role)}
                                  className="capitalize"
                                >
                                  {role}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Join Requests */}
            {organizationId && (
              <section className="space-y-4">
                <JoinRequestsPanel organizationId={organizationId} />
              </section>
            )}

            {/* Danger Zone */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
              </div>

              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-4">
                <div className="flex items-start gap-3">
                  <Trash2 className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">
                      Delete Organization
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This will permanently delete your organization and all projects.
                      Documents in Google Drive will not be affected.
                    </p>
                    <Button variant="destructive" size="sm" className="mt-3">
                      Delete Organization
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>

          {/* Domains Tab */}
          <TabsContent value="domains" className="space-y-6">
            {organizationId && (
              <DomainSettings
                organizationId={organizationId}
                organizationName={orgName}
                organizationSlug={orgSlug}
                currentSubdomain={orgSubdomain}
                onSubdomainChange={(subdomain) => setOrgSubdomain(subdomain)}
              />
            )}
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-10">
            <div className="flex justify-end">
              <Button onClick={handleSaveBranding} disabled={savingBranding}>
                {savingBranding ? "Saving..." : "Save Branding"}
              </Button>
            </div>

            {/* Extract from Website */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Auto-Extract from Website</h2>
              </div>
              
              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter your company website and we'll extract your brand colors and fonts automatically.
                </p>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourcompany.com"
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={handleExtractStyles}
                    disabled={extractingStyles || !websiteUrl.trim()}
                    variant="secondary"
                  >
                    {extractingStyles ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Extract Styles
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </section>

            {/* Logo & Identity */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Image className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Logo & Identity</h2>
              </div>
              
              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <div className="space-y-2">
                  <Label>Organization Logo</Label>
                  <div className="flex items-center gap-4">
                    {branding.logo_url ? (
                      <div className="relative">
                        <img 
                          src={branding.logo_url} 
                          alt="Logo" 
                          className="h-16 w-auto max-w-32 object-contain rounded-lg border border-border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={handleRemoveLogo}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-16 w-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                        No logo
                      </div>
                    )}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? "Uploading..." : "Upload Logo"}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, or SVG. Max 2MB.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={branding.tagline || ""}
                    onChange={(e) => updateBranding("tagline", e.target.value)}
                    placeholder="e.g., Developer Documentation"
                  />
                </div>
              </div>
            </section>

            {/* Colors */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Colors</h2>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary_color">Primary</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="primary_color"
                        value={branding.primary_color}
                        onChange={(e) => updateBranding("primary_color", e.target.value)}
                        className="h-10 w-10 rounded-lg border border-border cursor-pointer"
                      />
                      <Input
                        value={branding.primary_color}
                        onChange={(e) => updateBranding("primary_color", e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondary_color">Secondary</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="secondary_color"
                        value={branding.secondary_color}
                        onChange={(e) => updateBranding("secondary_color", e.target.value)}
                        className="h-10 w-10 rounded-lg border border-border cursor-pointer"
                      />
                      <Input
                        value={branding.secondary_color}
                        onChange={(e) => updateBranding("secondary_color", e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accent_color">Accent</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="accent_color"
                        value={branding.accent_color}
                        onChange={(e) => updateBranding("accent_color", e.target.value)}
                        className="h-10 w-10 rounded-lg border border-border cursor-pointer"
                      />
                      <Input
                        value={branding.accent_color}
                        onChange={(e) => updateBranding("accent_color", e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
                  <p className="text-xs text-muted-foreground">Preview</p>
                  <div className="flex gap-2">
                    <div 
                      className="h-8 w-20 rounded text-white text-xs flex items-center justify-center font-medium"
                      style={{ backgroundColor: branding.primary_color }}
                    >
                      Primary
                    </div>
                    <div 
                      className="h-8 w-20 rounded text-white text-xs flex items-center justify-center font-medium"
                      style={{ backgroundColor: branding.secondary_color }}
                    >
                      Secondary
                    </div>
                    <div 
                      className="h-8 w-20 rounded text-white text-xs flex items-center justify-center font-medium"
                      style={{ backgroundColor: branding.accent_color }}
                    >
                      Accent
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Typography */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Typography</h2>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="font_heading">Heading Font</Label>
                    <select
                      id="font_heading"
                      value={branding.font_heading}
                      onChange={(e) => updateBranding("font_heading", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
                    >
                      {fontOptions.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="font_body">Body Font</Label>
                    <select
                      id="font_body"
                      value={branding.font_body}
                      onChange={(e) => updateBranding("font_body", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
                    >
                      {fontOptions.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* Landing Page */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Layout className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Landing Page</h2>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hero_title">Hero Title</Label>
                  <Input
                    id="hero_title"
                    value={branding.hero_title || ""}
                    onChange={(e) => updateBranding("hero_title", e.target.value)}
                    placeholder={`e.g., Welcome to ${orgName} Documentation`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use: "{orgName} Documentation"
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hero_description">Hero Description</Label>
                  <Textarea
                    id="hero_description"
                    value={branding.hero_description || ""}
                    onChange={(e) => updateBranding("hero_description", e.target.value)}
                    placeholder="Describe what visitors will find in your documentation..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Show Search on Landing</Label>
                    <p className="text-xs text-muted-foreground">
                      Display a search bar on the landing page
                    </p>
                  </div>
                  <Switch
                    checked={branding.show_search_on_landing}
                    onCheckedChange={(checked) => updateBranding("show_search_on_landing", checked)}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Show Featured Projects</Label>
                    <p className="text-xs text-muted-foreground">
                      Display featured projects on the landing page
                    </p>
                  </div>
                  <Switch
                    checked={branding.show_featured_projects}
                    onCheckedChange={(checked) => updateBranding("show_featured_projects", checked)}
                  />
                </div>
              </div>
            </section>

            {/* Custom CSS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Custom CSS</h2>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add custom CSS to further customize your documentation appearance.
                </p>
                <Textarea
                  value={branding.custom_css || ""}
                  onChange={(e) => updateBranding("custom_css", e.target.value)}
                  placeholder={`.docs-header {\n  /* Your custom styles */\n}`}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
            </section>
          </TabsContent>


          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-10">
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Theme</h2>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choose your preferred appearance for the dashboard.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setTheme("light")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      theme === "light" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                        <Sun className="w-6 h-6 text-amber-600" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Light</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setTheme("dark")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      theme === "dark" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                        <Moon className="w-6 h-6 text-slate-300" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Dark</span>
                    </div>
                  </button>
                </div>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite Member Dialog */}
      {organizationId && (
        <InviteMemberDialog
          open={inviteMemberOpen}
          onOpenChange={setInviteMemberOpen}
          organizationId={organizationId}
          organizationName={orgName}
        />
      )}
    </div>
  );
};
