import { useState, useRef, useEffect } from "react";
import { Upload, Link as LinkIcon, FileJson, Check, X, Loader2 } from "lucide-react";
import yaml from "js-yaml";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Recursively sanitize object to remove unsupported Unicode escape sequences
const sanitizeForJson = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    // Remove problematic control characters (U+0000 to U+001F except \t, \n, \r)
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

interface APISettingsProps {
  projectId: string;
}

export const APISettings = ({ projectId }: APISettingsProps) => {
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
      setLoading(false);
    };
    fetchSettings();
  }, [projectId]);

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
        // Default to JSON
        parsed = JSON.parse(text);
      }

      // Basic OpenAPI validation
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
    setSaving(false);
    toast({
      title: "Not available",
      description: "Project API settings are not available yet.",
      variant: "destructive",
    });
    return;

    // Deep sanitize to remove unsupported Unicode escape sequences
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

    setSaving(false);
    toast({
      title: "Unavailable",
      description: "API settings are not available in Strapi mode yet.",
      variant: "destructive",
    });
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
              Expose Model Context Protocol docs at /docs/mcp
            </p>
          </div>
          <Switch checked={mcpEnabled} onCheckedChange={setMcpEnabled} />
        </div>
      </div>

      {/* OpenAPI Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">OpenAPI Specification</h3>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Add your OpenAPI spec to auto-generate API documentation at /docs/api
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
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save API Settings"}
      </Button>
    </div>
  );
};
