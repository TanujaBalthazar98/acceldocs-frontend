import { useState, useRef, useEffect } from "react";
import { Upload, Link as LinkIcon, FileJson, Check, X, Loader2, ExternalLink } from "lucide-react";
import yaml from "js-yaml";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

interface OrgAPISettingsProps {
  organizationId: string;
  orgSlug?: string | null;
}

export const OrgAPISettings = ({ organizationId, orgSlug }: OrgAPISettingsProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [openApiUrl, setOpenApiUrl] = useState("");
  const [openApiSpec, setOpenApiSpec] = useState<object | null>(null);
  const [specFileName, setSpecFileName] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch existing settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("mcp_enabled, openapi_spec_url, openapi_spec_json")
        .eq("id", organizationId)
        .single();

      if (data && !error) {
        setMcpEnabled((data as any).mcp_enabled ?? false);
        setOpenApiUrl((data as any).openapi_spec_url ?? "");
        if ((data as any).openapi_spec_json) {
          setOpenApiSpec((data as any).openapi_spec_json as object);
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
      toast({ title: "Spec loaded", description: `${file.name} is ready to save.` });
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
      toast({ title: "Spec loaded", description: "OpenAPI spec is ready to save." });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to load spec");
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    let sanitizedSpec: object | null = null;
    if (openApiSpec) {
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
    }

    const { error } = await supabase
      .from("organizations")
      .update({
        mcp_enabled: mcpEnabled,
        openapi_spec_url: openApiUrl || null,
        openapi_spec_json: sanitizedSpec as any,
      } as any)
      .eq("id", organizationId);

    setSaving(false);

    if (error) {
      console.error("Save API settings error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save API settings.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Saved", description: "Organization API documentation settings updated." });
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
    return <div className="py-4 text-sm text-muted-foreground">Loading settings...</div>;
  }

  const previewSlug = orgSlug || organizationId;

  return (
    <div className="space-y-6">
      {/* MCP Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">MCP Integration</h3>
        </div>
        
        <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Enable MCP Documentation</p>
            <p className="text-xs text-muted-foreground">
              Expose Model Context Protocol docs at /mcp/{previewSlug}
            </p>
          </div>
          <Switch checked={mcpEnabled} onCheckedChange={setMcpEnabled} />
        </div>

        {mcpEnabled && (
          <a 
            href={`/mcp/${previewSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Preview MCP Documentation
          </a>
        )}
      </div>

      {/* OpenAPI Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">OpenAPI Specification</h3>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Add your OpenAPI spec to auto-generate API documentation at /api/{previewSlug}
        </p>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-2 text-xs">
              <Upload className="w-3 h-3" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2 text-xs">
              <LinkIcon className="w-3 h-3" />
              URL
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
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
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
                    Drop your OpenAPI JSON or YAML file here or click to browse
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

        {openApiSpec && (
          <a 
            href={`/api/${previewSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Preview API Documentation
          </a>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save API Settings"}
      </Button>
    </div>
  );
};
