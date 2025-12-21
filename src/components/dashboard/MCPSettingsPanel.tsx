import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  FileJson, 
  Loader2, 
  ExternalLink,
  Globe,
  Eye,
  Send,
  Code,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MCPSettingsPanelProps {
  organizationId: string;
  orgSlug?: string | null;
  onBack: () => void;
}

export const MCPSettingsPanel = ({ organizationId, orgSlug, onBack }: MCPSettingsPanelProps) => {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mcpEnabled, setMcpEnabled] = useState(false);

  // Fetch existing settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("mcp_enabled")
        .eq("id", organizationId)
        .single();

      if (data && !error) {
        setMcpEnabled((data as any).mcp_enabled ?? false);
      }
      setLoading(false);
    };
    fetchSettings();
  }, [organizationId]);

  const handleTogglePublish = async () => {
    setSaving(true);
    const newState = !mcpEnabled;

    const { error } = await supabase
      .from("organizations")
      .update({
        mcp_enabled: newState,
      } as any)
      .eq("id", organizationId);

    setSaving(false);

    if (error) {
      console.error("Save MCP settings error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update MCP settings.",
        variant: "destructive",
      });
    } else {
      setMcpEnabled(newState);
      toast({ 
        title: newState ? "Published" : "Unpublished", 
        description: newState ? "MCP Documentation is now live." : "MCP Documentation is no longer live." 
      });
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
            <Code className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">MCP Protocol</h1>
          </div>
          {mcpEnabled && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
              Published
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mcpEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/mcp/${previewSlug}`, '_blank')}
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
          <div className={`p-4 rounded-xl border ${mcpEnabled ? 'border-green-500/20 bg-green-500/5' : 'border-border bg-secondary/30'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mcpEnabled ? 'bg-green-500/10' : 'bg-secondary'}`}>
                <Globe className={`w-5 h-5 ${mcpEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">
                  MCP Documentation
                </h3>
                <p className="text-xs text-muted-foreground">
                  {mcpEnabled ? `Live at /mcp/${previewSlug}` : 'Not published'}
                </p>
              </div>
              <Switch 
                checked={mcpEnabled} 
                onCheckedChange={handleTogglePublish}
                disabled={saving}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">About MCP</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Model Context Protocol (MCP) enables AI assistants like Claude to interact with your documentation 
              and tools programmatically. When enabled, your MCP documentation will be accessible to AI models 
              that support the protocol.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">When enabled:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>AI models can discover and use your documentation</li>
                <li>Provides structured access to your API and content</li>
                <li>Enables conversational interactions with your docs</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            {!mcpEnabled ? (
              <Button 
                onClick={handleTogglePublish} 
                disabled={saving} 
                className="flex-1 gap-2"
              >
                <Send className="w-4 h-4" />
                {saving ? "Publishing..." : "Publish MCP Documentation"}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleTogglePublish}
                  disabled={saving}
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {saving ? "..." : "Unpublish"}
                </Button>
                <Button 
                  onClick={() => window.open(`/mcp/${previewSlug}`, '_blank')}
                  className="flex-1 gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View MCP Documentation
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
