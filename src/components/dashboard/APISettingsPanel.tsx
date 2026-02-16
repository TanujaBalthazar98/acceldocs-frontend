import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Upload, 
  Link as LinkIcon, 
  FileJson, 
  Check, 
  X, 
  Loader2, 
  ExternalLink,
  Globe,
  Eye,
  Send,
  RefreshCw,
} from "lucide-react";
import yaml from "js-yaml";
import { useToast } from "@/hooks/use-toast";
import { getById, update } from "@/lib/api/queries";

// Recursively sanitize object to remove unsupported Unicode escape sequences
const sanitizeForJson = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    return obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJson);
  }
  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeForJson(value);
    }
    return sanitized;
  }
  return obj;
};

interface APISettingsPanelProps {
  organizationId: string;
  orgSlug?: string | null;
  onBack: () => void;
}

export const APISettingsPanel = ({ organizationId, orgSlug, onBack }: APISettingsPanelProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openApiUrl, setOpenApiUrl] = useState("");
  const [openApiSpec, setOpenApiSpec] = useState<object | null>(null);
  const [specFileName, setSpecFileName] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  // Fetch existing settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await getById<any>("organizations", organizationId, {
        select: "openapi_spec_url,openapi_spec_json",
      });
      if (data && !error) {
        setOpenApiUrl((data as any).openapi_spec_url ?? "");
        if ((data as any).openapi_spec_json) {
          setOpenApiSpec((data as any).openapi_spec_json as object);
          setIsPublished(true);
        }
      }
      setLoading(false);
    };
    fetchSettings();
  }, [organizationId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidating(true);
    setValidationError(null);

    try {
      const text = await file.text();
      let parsed;

      if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) {
        parsed = yaml.load(text) as object;
      } else {
        parsed = JSON.parse(text);
      }

      if (!parsed.openapi && !parsed.swagger) {
        throw new Error("Invalid OpenAPI specification");
      }

      setOpenApiSpec(parsed);
      setSpecFileName(file.name);
      setOpenApiUrl("");
      toast({ title: "Spec loaded", description: `${file.name} is ready to publish.` });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Invalid file");
    } finally {
      setValidating(false);
    }
  };

  const handleUrlLoad = async () => {
    if (!openApiUrl.trim()) return;

    setValidating(true);
    setValidationError(null);

    try {
      const response = await fetch(openApiUrl);
      if (!response.ok) throw new Error("Failed to fetch spec");

      const parsed = await response.json();

      if (!parsed.openapi && !parsed.swagger) {
        throw new Error("Invalid OpenAPI specification");
      }

      setOpenApiSpec(parsed);
      setSpecFileName(null);
      toast({ title: "Spec loaded", description: "OpenAPI spec is ready to publish." });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to load spec");
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    if (!openApiSpec) {
      toast({ title: "No spec", description: "Upload or load an OpenAPI spec first.", variant: "destructive" });
      return;
    }

    setSaving(true);

    let sanitizedSpec: object | null = null;
    try {
      sanitizedSpec = sanitizeForJson(openApiSpec) as object;
    } catch {
      toast({
        title: "Error",
        description: "OpenAPI spec contains invalid data.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    const { error } = await update("organizations", organizationId, {
      openapi_spec_url: openApiUrl || null,
      openapi_spec_json: sanitizedSpec as any,
    });

    setSaving(false);

    if (error) {
      console.error("Save API settings error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to publish API docs.",
        variant: "destructive",
      });
    } else {
      setIsPublished(true);
      toast({ title: "Published", description: "API Reference is now live." });
    }
  };

  const handleUnpublish = async () => {
    setSaving(true);

    const { error } = await update("organizations", organizationId, {
      openapi_spec_url: null,
      openapi_spec_json: null,
    });

    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to unpublish.",
        variant: "destructive",
      });
    } else {
      setIsPublished(false);
      setOpenApiSpec(null);
      setOpenApiUrl("");
      setSpecFileName(null);
      toast({ title: "Unpublished", description: "API Reference is no longer live." });
    }
  };

  const clearSpec = () => {
    setOpenApiSpec(null);
    setSpecFileName(null);
    setOpenApiUrl("");
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewSlug = orgSlug || organizationId;

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">API Reference</h1>
          </div>
          {isPublished && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
              Published
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPublished && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/${previewSlug}`, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Live
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Current Status */}
          {isPublished && openApiSpec && (
            <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground">
                    {(openApiSpec as any).info?.title || "API Documentation"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    v{(openApiSpec as any).info?.version} • Live at /api/{previewSlug}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePublish}
                  disabled={saving}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Republish
                </Button>
              </div>
            </div>
          )}

          {/* Upload Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">OpenAPI Specification</h2>
              <p className="text-xs text-muted-foreground">
                Upload your OpenAPI spec to generate beautiful API documentation.
              </p>
            </div>

            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="gap-2 text-xs">
                  <Upload className="w-3 h-3" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="url" className="gap-2 text-xs">
                  <LinkIcon className="w-3 h-3" />
                  From URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {validating ? (
                    <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                  ) : specFileName ? (
                    <>
                      <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm font-medium text-foreground">{specFileName}</p>
                      <p className="text-xs text-muted-foreground">Click to replace</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Drop your OpenAPI JSON or YAML file here
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or click to browse
                      </p>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="url" className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://api.example.com/openapi.json"
                    value={openApiUrl}
                    onChange={(e) => setOpenApiUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    onClick={handleUrlLoad}
                    disabled={!openApiUrl.trim() || validating}
                  >
                    {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
                  </Button>
                </div>
                {openApiSpec && !specFileName && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Check className="h-4 w-4" />
                    <span>Spec loaded from URL</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {validationError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <X className="h-4 w-4" />
                <span>{validationError}</span>
              </div>
            )}

            {openApiSpec && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {(openApiSpec as any).info?.title || "API Specification"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    v{(openApiSpec as any).info?.version}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSpec}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            {!isPublished ? (
              <Button 
                onClick={handlePublish} 
                disabled={saving || !openApiSpec} 
                className="flex-1 gap-2"
              >
                <Send className="w-4 h-4" />
                {saving ? "Publishing..." : "Publish API Reference"}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleUnpublish}
                  disabled={saving}
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {saving ? "..." : "Unpublish"}
                </Button>
                <Button 
                  onClick={() => window.open(`/api/${previewSlug}`, '_blank')}
                  className="flex-1 gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View API Reference
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
