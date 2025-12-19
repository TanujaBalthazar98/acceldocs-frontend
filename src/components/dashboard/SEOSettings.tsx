import { useState, useEffect } from "react";
import { Bot, Search, Globe, Shield, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SEOSettingsProps {
  projectId: string;
}

export const SEOSettings = ({ projectId }: SEOSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // robots.txt settings
  const [allowIndexing, setAllowIndexing] = useState(true);
  const [disallowedPaths, setDisallowedPaths] = useState<string[]>([]);
  const [newPath, setNewPath] = useState("");
  
  // llms.txt settings
  const [allowLlmTraining, setAllowLlmTraining] = useState(false);
  const [allowLlmSummarization, setAllowLlmSummarization] = useState(true);
  const [allowLlmCrawlers, setAllowLlmCrawlers] = useState<string[]>([]);
  const [newCrawler, setNewCrawler] = useState("");

  useEffect(() => {
    fetchSettings();
  }, [projectId]);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("allow_indexing, disallowed_paths, allow_llm_training, allow_llm_summarization, allow_llm_crawlers")
      .eq("id", projectId)
      .single();

    if (data && !error) {
      setAllowIndexing(data.allow_indexing ?? true);
      setDisallowedPaths(data.disallowed_paths ?? []);
      setAllowLlmTraining(data.allow_llm_training ?? false);
      setAllowLlmSummarization(data.allow_llm_summarization ?? true);
      setAllowLlmCrawlers(data.allow_llm_crawlers ?? []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        allow_indexing: allowIndexing,
        disallowed_paths: disallowedPaths,
        allow_llm_training: allowLlmTraining,
        allow_llm_summarization: allowLlmSummarization,
        allow_llm_crawlers: allowLlmCrawlers,
      })
      .eq("id", projectId);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to save SEO settings.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "SEO & crawler settings updated." });
    }
  };

  const addPath = () => {
    if (newPath.trim() && !disallowedPaths.includes(newPath.trim())) {
      setDisallowedPaths([...disallowedPaths, newPath.trim()]);
      setNewPath("");
    }
  };

  const removePath = (path: string) => {
    setDisallowedPaths(disallowedPaths.filter(p => p !== path));
  };

  const addCrawler = () => {
    if (newCrawler.trim() && !allowLlmCrawlers.includes(newCrawler.trim())) {
      setAllowLlmCrawlers([...allowLlmCrawlers, newCrawler.trim()]);
      setNewCrawler("");
    }
  };

  const removeCrawler = (crawler: string) => {
    setAllowLlmCrawlers(allowLlmCrawlers.filter(c => c !== crawler));
  };

  if (loading) {
    return <div className="py-4 text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* robots.txt Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Search Engine Indexing (robots.txt)</h3>
        </div>
        
        <div className="space-y-4 pl-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Allow Search Engine Indexing</p>
              <p className="text-xs text-muted-foreground">Allow Google, Bing, and other search engines to index your docs</p>
            </div>
            <Switch checked={allowIndexing} onCheckedChange={setAllowIndexing} />
          </div>

          {allowIndexing && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Blocked Paths</p>
              <p className="text-xs text-muted-foreground">These paths will be disallowed in robots.txt</p>
              
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">/drafts/</Badge>
                <Badge variant="secondary" className="text-xs">/internal/</Badge>
                {disallowedPaths.map(path => (
                  <Badge key={path} variant="outline" className="text-xs gap-1">
                    {path}
                    <button onClick={() => removePath(path)} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="/custom-path"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addPath()}
                />
                <Button variant="outline" size="sm" onClick={addPath} className="gap-1">
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* llms.txt Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">AI/LLM Access (llms.txt)</h3>
        </div>
        
        <div className="space-y-4 pl-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Allow AI Training</p>
              <p className="text-xs text-muted-foreground">Allow LLMs to use your content for training data</p>
            </div>
            <Switch checked={allowLlmTraining} onCheckedChange={setAllowLlmTraining} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Allow Summarization</p>
              <p className="text-xs text-muted-foreground">Allow AI to summarize and reference your content</p>
            </div>
            <Switch checked={allowLlmSummarization} onCheckedChange={setAllowLlmSummarization} />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Allowed Crawlers</p>
            <p className="text-xs text-muted-foreground">Specific AI crawlers to allow (empty = allow all)</p>
            
            <div className="flex flex-wrap gap-2">
              {allowLlmCrawlers.length === 0 ? (
                <Badge variant="outline" className="text-xs text-muted-foreground">All crawlers allowed</Badge>
              ) : (
                allowLlmCrawlers.map(crawler => (
                  <Badge key={crawler} variant="outline" className="text-xs gap-1">
                    {crawler}
                    <button onClick={() => removeCrawler(crawler)} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="GPTBot, Anthropic-AI"
                value={newCrawler}
                onChange={(e) => setNewCrawler(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addCrawler()}
              />
              <Button variant="outline" size="sm" onClick={addCrawler} className="gap-1">
                <Plus className="w-3 h-3" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Generated Files Preview</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-xs font-medium text-foreground mb-1">robots.txt</p>
            <code className="text-[10px] text-muted-foreground block whitespace-pre-wrap">
              {`User-agent: *\n${allowIndexing ? 'Allow: /' : 'Disallow: /'}`}
            </code>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-xs font-medium text-foreground mb-1">llms.txt</p>
            <code className="text-[10px] text-muted-foreground block whitespace-pre-wrap">
              {`${allowLlmTraining ? 'Train: /docs/' : 'No-Train: *'}\n${allowLlmSummarization ? 'Summarize: /docs/' : 'No-Summarize: *'}`}
            </code>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save SEO Settings"}
      </Button>
    </div>
  );
};
