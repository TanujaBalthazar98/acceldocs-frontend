import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Play,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  ChevronRight,
  ChevronDown,
  ArrowRightLeft,
  Settings,
  Info,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { migrationApi, type DiscoverResponse, type MigrationNode, type StatusResponse, type MigrationHistoryItem } from "@/api/migration";
import { sectionsApi } from "@/api/sections";
import { formatDistanceToNow } from "date-fns";

function extractProductName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const skipWords = ["docs", "documentation", "doc", "v1", "v2", "v3", "latest", "current", "user-guide", "installation-guide", "api", "reference", "guides"];
    const productPart = pathParts.find(p => 
      !skipWords.includes(p.toLowerCase()) && !p.match(/^pulse-\d+\.\d+/)
    ) || pathParts[0] || "Documentation";
    return productPart
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  } catch {
    return "Documentation";
  }
}

interface Props {
  onClose?: () => void;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

function TreeNode({ node, depth = 0 }: { node: MigrationNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <button
        className="flex items-center gap-1.5 w-full text-left hover:bg-accent/50 rounded px-2 py-1 transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setExpanded((v) => !v)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <span className="w-3.5" />
        )}
        <span className="text-sm truncate">{node.title}</span>
        {node.url && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />}
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    case "running":
    case "pending":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{status}</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200"><AlertTriangle className="h-3 w-3 mr-1" />Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function PhaseIndicator({ progress }: { progress: StatusResponse["progress"] }) {
  const phases = [
    { key: "discovering", label: "Discovering structure" },
    { key: "fetching", label: "Fetching pages" },
    { key: "rewriting_links", label: "Rewriting links" },
    { key: "importing", label: "Importing into AccelDocs" },
    { key: "completed", label: "Completed" },
  ];

  const currentIdx = phases.findIndex((p) => p.key === progress.phase);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{progress.message}</p>
      <div className="flex gap-1">
        {phases.map((phase, idx) => (
          <div
            key={phase.key}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              idx < currentIdx
                ? "bg-emerald-500"
                : idx === currentIdx
                  ? "bg-blue-500 animate-pulse"
                  : "bg-muted"
            }`}
            title={phase.label}
          />
        ))}
      </div>
    </div>
  );
}

export function MigrationPanel({ onClose, isMobile, onOpenSidebar }: Props) {
  const { toast } = useToast();

  const [sourceUrl, setSourceUrl] = useState("https://docs.acceldata.io/pulse/");
  const [product, setProduct] = useState("pulse");
  const [usePlaywright, setUsePlaywright] = useState(true);
  const [maxPages, setMaxPages] = useState(0);
  const [activeMigrationId, setActiveMigrationId] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<number | null>(null);

  // Product auto-detection state
  const [detectedProductName, setDetectedProductName] = useState<string>("Pulse");
  const [productId, setProductId] = useState<number | null>(null);
  const [productExists, setProductExists] = useState<boolean | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Check if product exists in workspace
  const checkProductExists = useCallback(async (name: string): Promise<{ exists: boolean; id: number | null }> => {
    try {
      const data = await sectionsApi.list();
      const existingProduct = data.sections.find(
        s => s.parent_id === null && s.name.toLowerCase() === name.toLowerCase()
      );
      if (existingProduct) {
        return { exists: true, id: existingProduct.id };
      }
      return { exists: false, id: null };
    } catch {
      return { exists: false, id: null };
    }
  }, []);

  // Create product section
  const handleCreateProduct = async () => {
    if (!detectedProductName) return;
    setIsCreatingProduct(true);
    try {
      const newProduct = await sectionsApi.create({
        name: detectedProductName,
        parent_id: null,
        section_type: "section",
      });
      setProductId(newProduct.id);
      setProductExists(true);
      // Also update localStorage for the migration API
      localStorage.setItem("acceldocs_product_id", String(newProduct.id));
      localStorage.setItem("acceldocs_current_product_id", String(newProduct.id));
      toast({ title: "Product created", description: `"${detectedProductName}" has been created` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to create product", variant: "destructive" });
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const [discoverResult, setDiscoverResult] = useState<DiscoverResponse | null>(null);

  const discoverMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`http://localhost:8000/api/migration/discover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("acceldocs_auth_token")}`,
          "X-Org-Id": localStorage.getItem("acceldocs_current_org_id") || "",
        },
        body: JSON.stringify({ source_url: sourceUrl, product, use_playwright: usePlaywright }),
        signal: AbortSignal.timeout(600_000),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || resp.statusText);
      }
      return resp.json() as Promise<DiscoverResponse>;
    },
    onSuccess: (data) => {
      setDiscoverResult(data);
    },
    onError: (err: Error) => {
      toast({ title: "Discovery failed", description: err.message, variant: "destructive" });
    },
  });

  const historyQuery = useQuery({
    queryKey: ["migration", "history"],
    queryFn: () => migrationApi.getHistory(),
    refetchInterval: 30000,
  });

  const statusQuery = useQuery({
    queryKey: ["migration", "status", activeMigrationId],
    queryFn: () => migrationApi.getStatus(activeMigrationId!),
    enabled: !!activeMigrationId,
    refetchInterval: pollInterval ?? 3000,
  });

  useEffect(() => {
    if (statusQuery.data?.status === "completed" || statusQuery.data?.status === "failed" || statusQuery.data?.status === "cancelled") {
      setPollInterval(null);
      historyQuery.refetch();
    }
  }, [statusQuery.data?.status]);

  const startMutation = useMutation({
    mutationFn: (data: Parameters<typeof migrationApi.start>[0]) => migrationApi.start(data),
    onSuccess: (res) => {
      setActiveMigrationId(res.migration_id);
      setPollInterval(3000);
      toast({ title: "Migration started", description: `ID: ${res.migration_id}` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to start migration", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => migrationApi.cancel(id),
    onSuccess: () => {
      setPollInterval(null);
      toast({ title: "Migration cancelled" });
      historyQuery.refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
    },
  });

  const handleDiscover = () => {
    discoverQuery.refetch();
  };

  const handleStartMigration = () => {
    const token = localStorage.getItem("acceldocs_auth_token");
    const orgId = localStorage.getItem("acceldocs_current_org_id");
    const productId = localStorage.getItem("acceldocs_product_id") || localStorage.getItem("acceldocs_current_product_id");

    if (!token) {
      toast({ title: "Not authenticated", description: "Please sign in first.", variant: "destructive" });
      return;
    }

    startMutation.mutate({
      source_url: sourceUrl,
      product,
      backend_url: "http://localhost:8000",
      api_token: token,
      org_id: Number(orgId) || 1,
      product_id: Number(productId) || 1,
      use_playwright: usePlaywright,
      create_drive_docs: false,
      max_pages: maxPages,
    });
  };

  const handleCancel = () => {
    if (activeMigrationId) {
      cancelMutation.mutate(activeMigrationId);
    }
  };

  const isRunning = statusQuery.data?.status === "running" || statusQuery.data?.status === "pending";
  const isActive = isRunning || statusQuery.data?.status === "pending";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isMobile && onOpenSidebar && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onOpenSidebar}>
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          )}
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">Migration</h2>
            <p className="text-[11px] text-muted-foreground">Import docs from external sources</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-6">
        {/* Info banner */}
        <div className="flex gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800 dark:text-blue-300">
            <p className="font-medium">DeveloperHub Migration</p>
            <p className="mt-1">Import documentation from docs.acceldata.io into AccelDocs. The source site will be discovered, pages fetched and converted, then imported as sections and pages in your workspace.</p>
          </div>
        </div>

        {/* Config form */}
        <div className="rounded-xl border bg-background shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Source Configuration</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-url">Source URL</Label>
            <Input
              id="source-url"
              placeholder="https://docs.example.com/product/"
              value={sourceUrl}
              onChange={(e) => {
                setSourceUrl(e.target.value);
                const name = extractProductName(e.target.value);
                setDetectedProductName(name);
                checkProductExists(name).then(result => {
                  setProductExists(result.exists);
                  setProductId(result.id);
                  if (result.id) {
                    localStorage.setItem("acceldocs_product_id", String(result.id));
                    localStorage.setItem("acceldocs_current_product_id", String(result.id));
                  }
                });
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="product">Target Product</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-muted">
                  {detectedProductName || "Enter URL to detect"}
                </div>
                {!productExists && detectedProductName && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCreateProduct}
                    disabled={isCreatingProduct}
                  >
                    {isCreatingProduct ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Create "{detectedProductName}"</>
                    )}
                  </Button>
                )}
                {productExists && productId && (
                  <span className="text-xs text-muted-foreground px-2">
                    ID: {productId}
                  </span>
                )}
              </div>
              {productExists === false && detectedProductName && (
                <p className="text-xs text-amber-600">Product not found. Click "Create" to add it.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-pages">Max Pages (safety limit)</Label>
              <Input
                id="max-pages"
                type="number"
                min={0}
                placeholder="0 = unlimited"
                value={maxPages || ""}
                onChange={(e) => setMaxPages(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="playwright" className="text-sm">Use Playwright (JavaScript rendering)</Label>
              <p className="text-[11px] text-muted-foreground">Required for Angular SPA sites — renders JS to extract sidebar</p>
            </div>
            <Switch
              id="playwright"
              checked={usePlaywright}
              onCheckedChange={setUsePlaywright}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => discoverMutation.mutate()}
              disabled={!sourceUrl || discoverMutation.isPending}
            >
              {discoverMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Discover
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleStartMigration}
              disabled={!sourceUrl || startMutation.isPending || isActive}
            >
              {startMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Start Migration
            </Button>
          </div>
        </div>

        {/* Discovery results */}
        {discoverResult && (
          <div className="rounded-xl border bg-background shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Discovery Results</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{discoverResult.total_pages} pages found</span>
                <span>·</span>
                <span>{discoverResult.source_type}</span>
                <span>·</span>
                <span>{discoverResult.hierarchy.length} sections</span>
              </div>
            </div>

            {discoverResult.hierarchy.length > 0 && (
              <div className="rounded-lg border bg-muted/30 max-h-80 overflow-y-auto">
                {discoverResult.hierarchy.map((node, i) => (
                  <TreeNode key={i} node={node} />
                ))}
              </div>
            )}

            {discoverResult.hierarchy.length === 0 && (
              <p className="text-sm text-muted-foreground">No hierarchy discovered. Try adjusting the source URL or enabling Playwright.</p>
            )}
          </div>
        )}

        {discoverMutation.error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 dark:text-red-300">
              Discovery failed: {discoverMutation.error.message}
            </p>
          </div>
        )}

        {/* Active migration */}
        {(isActive || statusQuery.data) && (
          <div className="rounded-xl border bg-background shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Active Migration</h3>
                {statusQuery.data && <StatusBadge status={statusQuery.data.status} />}
              </div>
              {isRunning && (
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelMutation.isPending}>
                  {cancelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  Cancel
                </Button>
              )}
            </div>

            {statusQuery.data && (
              <PhaseIndicator progress={statusQuery.data.progress} />
            )}

            {!statusQuery.data && isRunning && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading status...
              </div>
            )}

            {statusQuery.data?.errors && statusQuery.data.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Errors ({statusQuery.data.errors.length})</p>
                <div className="rounded border bg-red-50 dark:bg-red-950/20 max-h-32 overflow-y-auto">
                  {statusQuery.data.errors.map((err, i) => (
                    <div key={i} className="px-3 py-1.5 text-xs border-b last:border-0 border-red-100 dark:border-red-900">
                      <span className="font-mono text-muted-foreground">{err.url}</span>
                      <span className="text-red-700 dark:text-red-400 ml-2">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {statusQuery.data?.result && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 p-3">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Pages Imported</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{statusQuery.data.result.pages_imported}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Sections Created</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{statusQuery.data.result.sections_created}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <Tabs defaultValue="history">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-3">
            {historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : historyQuery.data && historyQuery.data.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Source</th>
                      <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Product</th>
                      <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Started</th>
                      <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyQuery.data.map((item) => (
                      <tr key={item.migration_id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                        <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                        <td className="px-3 py-2 max-w-[200px] truncate text-xs text-muted-foreground" title={item.source_url}>
                          {new URL(item.source_url).pathname}
                        </td>
                        <td className="px-3 py-2 text-xs">{item.product}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {item.started_at
                            ? formatDistanceToNow(new Date(item.started_at), { addSuffix: true })
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {item.result
                            ? `${item.result.pages_imported} pages`
                            : item.error
                              ? <span className="text-red-600 dark:text-red-400">{item.error.slice(0, 40)}...</span>
                              : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No migrations yet. Configure a source above and click "Start Migration".</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
