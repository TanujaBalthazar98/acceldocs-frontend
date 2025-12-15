import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Palette,
  Type,
  Image,
  Layout,
  Code,
  Upload,
  X,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface BrandingSettingsProps {
  onBack: () => void;
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

export const BrandingSettings = ({ onBack }: BrandingSettingsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgDomain, setOrgDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
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
    const fetchOrgData = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id);

        const { data: org } = await supabase
          .from("organizations")
          .select("name, domain, logo_url, tagline, primary_color, secondary_color, accent_color, font_heading, font_body, custom_css, hero_title, hero_description, show_search_on_landing, show_featured_projects")
          .eq("id", profile.organization_id)
          .single();

        if (org) {
          setOrgName(org.name);
          setOrgDomain(org.domain);
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
        }
      }
    };

    fetchOrgData();
  }, [user]);

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
      const { error } = await supabase.storage
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

  const handleSave = async () => {
    if (!organizationId) return;

    setSaving(true);

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

    setSaving(false);
  };

  const updateBranding = <K extends keyof BrandingData>(key: K, value: BrandingData[K]) => {
    setBranding(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Documentation Branding</h1>
          <p className="text-muted-foreground mt-1">
            Customize how your published documentation looks to visitors
          </p>
        </div>

        <div className="space-y-10">
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
                  <p className="text-xs text-muted-foreground">Display search bar prominently</p>
                </div>
                <Switch
                  checked={branding.show_search_on_landing}
                  onCheckedChange={(checked) => updateBranding("show_search_on_landing", checked)}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Show Featured Projects</Label>
                  <p className="text-xs text-muted-foreground">Display project cards on landing</p>
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
              <div className="space-y-2">
                <Label htmlFor="custom_css">Additional Styles</Label>
                <Textarea
                  id="custom_css"
                  value={branding.custom_css || ""}
                  onChange={(e) => updateBranding("custom_css", e.target.value)}
                  placeholder={`/* Custom CSS for your docs */\n.prose h1 {\n  font-size: 2.5rem;\n}`}
                  className="font-mono text-sm"
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Add custom CSS to further customize the documentation appearance.
                </p>
              </div>
            </div>
          </section>

          {/* Preview Link */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Preview your branded docs</p>
                <p className="text-sm text-muted-foreground">
                  See how your documentation will look to visitors
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href={`/docs/${orgDomain}`} target="_blank" rel="noopener noreferrer">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
