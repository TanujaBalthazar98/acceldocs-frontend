import { useState, useEffect } from "react";
import { agentApi } from "@/api/agent";
import { pagesApi } from "@/api/pages";
import type { Section } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink,
  Loader2,
  Sparkles,
  Trash2,
  ClipboardCheck,
  Unplug,
  Link2,
  ArrowLeft,
  Menu,
} from "lucide-react";

type AgentStep = "loading" | "setup" | "ready" | "ticket-loaded" | "generating" | "preview";

interface JiraTicketData {
  key: string;
  summary: string;
  description_text: string;
  status: string;
  issue_type: string;
  labels: string[];
}

interface GeneratedDraft {
  page_id: number;
  title: string;
  google_doc_id: string;
  preview_html: string;
}

interface AgentPanelProps {
  sections: Section[];
  onPageCreated: (pageId: number) => void;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

export function AgentPanel({ sections, onPageCreated, isMobile, onOpenSidebar }: AgentPanelProps) {
  const { toast } = useToast();

  const [step, setStep] = useState<AgentStep>("loading");
  const [error, setError] = useState<string | null>(null);

  // Jira setup
  const [jiraDomain, setJiraDomain] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraToken, setJiraToken] = useState("");
  const [jiraConnected, setJiraConnected] = useState(false);
  const [connectedDomain, setConnectedDomain] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Ticket fetch
  const [ticketKey, setTicketKey] = useState("");
  const [fetching, setFetching] = useState(false);
  const [ticket, setTicket] = useState<JiraTicketData | null>(null);

  // Generation
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [titleOverride, setTitleOverride] = useState("");
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);

  // Check Jira status on mount
  useEffect(() => {
    (async () => {
      const { data } = await agentApi.jiraStatus();
      if (data?.connected) {
        setJiraConnected(true);
        setConnectedDomain(data.domain || "");
        setStep("ready");
      } else {
        setStep("setup");
      }
    })();
  }, []);

  const handleJiraConnect = async () => {
    setConnecting(true);
    setError(null);
    const { data } = await agentApi.jiraConnect(jiraDomain, jiraEmail, jiraToken);
    setConnecting(false);

    if (data?.ok) {
      setJiraConnected(true);
      setConnectedDomain(data.domain || jiraDomain);
      setJiraToken("");
      setStep("ready");
      toast({ title: "Jira connected", description: `Connected to ${data.domain}` });
    } else {
      setError((data as any)?.error || "Failed to connect to Jira");
    }
  };

  const handleJiraDisconnect = async () => {
    await agentApi.jiraDisconnect();
    setJiraConnected(false);
    setConnectedDomain("");
    setStep("setup");
    toast({ title: "Jira disconnected" });
  };

  const handleFetchTicket = async () => {
    if (!ticketKey.trim()) return;
    setFetching(true);
    setError(null);

    const { data } = await agentApi.jiraGetTicket(ticketKey.trim());
    setFetching(false);

    if (data?.ok) {
      setTicket(data as JiraTicketData);
      setStep("ticket-loaded");
    } else {
      setError((data as any)?.error || "Failed to fetch ticket");
    }
  };

  const handleGenerate = async () => {
    if (!ticket) return;
    setStep("generating");
    setError(null);

    const sectionId = selectedSectionId ? parseInt(selectedSectionId) : null;
    const { data } = await agentApi.generateDoc(ticket.key, sectionId, titleOverride || undefined);

    if (data?.ok) {
      setDraft({
        page_id: data.page_id,
        title: data.title,
        google_doc_id: data.google_doc_id,
        preview_html: data.preview_html,
      });
      setStep("preview");
    } else {
      setError((data as any)?.error || "Generation failed");
      setStep("ticket-loaded");
    }
  };

  const handleSubmitForReview = async () => {
    if (!draft) return;
    try {
      await pagesApi.submitReview(draft.page_id);
      toast({ title: "Submitted for review", description: `"${draft.title}" is now pending review` });
      onPageCreated(draft.page_id);
      resetToReady();
    } catch {
      toast({ title: "Error", description: "Failed to submit for review", variant: "destructive" });
    }
  };

  const handleDiscard = async () => {
    if (!draft) return;
    try {
      await pagesApi.delete(draft.page_id);
      toast({ title: "Draft discarded" });
    } catch {
      // Page may already be deleted
    }
    resetToReady();
  };

  const resetToReady = () => {
    setTicket(null);
    setDraft(null);
    setTicketKey("");
    setTitleOverride("");
    setError(null);
    setStep("ready");
  };

  // Flatten sections for the dropdown
  const flatSections = sections.flatMap(function flatten(s: Section): { id: number; name: string; depth: number }[] {
    const result = [{ id: s.id, name: s.name, depth: 0 }];
    for (const child of s.children || []) {
      result.push(...flatten(child).map((c) => ({ ...c, depth: c.depth + 1 })));
    }
    return result;
  });

  if (step === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-2xl mx-auto p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              {isMobile && onOpenSidebar && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onOpenSidebar}>
                  <Menu className="h-4 w-4" />
                </Button>
              )}
              <Sparkles className="h-5 w-5 text-primary" />
              Documentation Agent
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Generate documentation drafts from Jira tickets
            </p>
          </div>
          {jiraConnected && step !== "setup" && (
            <Badge variant="outline" className="gap-1.5">
              <Link2 className="h-3 w-3" />
              {connectedDomain}
            </Badge>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step: Jira Setup */}
        {step === "setup" && (
          <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
            <div>
              <h3 className="font-medium text-base">Connect Jira</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your Jira Cloud credentials to fetch tickets.{" "}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Create an API token
                </a>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="jira-domain">Jira domain</Label>
                <Input
                  id="jira-domain"
                  placeholder="yourcompany.atlassian.net"
                  value={jiraDomain}
                  onChange={(e) => setJiraDomain(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="jira-email">Email</Label>
                <Input
                  id="jira-email"
                  type="email"
                  placeholder="you@company.com"
                  value={jiraEmail}
                  onChange={(e) => setJiraEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="jira-token">API token</Label>
                <Input
                  id="jira-token"
                  type="password"
                  placeholder="Paste your Jira API token"
                  value={jiraToken}
                  onChange={(e) => setJiraToken(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleJiraConnect}
              disabled={connecting || !jiraDomain || !jiraEmail || !jiraToken}
              className="w-full"
            >
              {connecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Connect Jira
            </Button>
          </div>
        )}

        {/* Step: Ready — ticket input */}
        {step === "ready" && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
              <div>
                <Label htmlFor="ticket-key">Jira ticket key</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="ticket-key"
                    placeholder="PROJ-123"
                    value={ticketKey}
                    onChange={(e) => setTicketKey(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFetchTicket()}
                    className="font-mono"
                  />
                  <Button onClick={handleFetchTicket} disabled={fetching || !ticketKey.trim()}>
                    {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="section-select">Target section</Label>
                <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                  <SelectTrigger id="section-select" className="mt-1">
                    <SelectValue placeholder="Select a section (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {flatSections.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {"  ".repeat(s.depth)}{s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={handleJiraDisconnect} className="text-muted-foreground">
              <Unplug className="h-3.5 w-3.5 mr-1.5" />
              Disconnect Jira
            </Button>
          </div>
        )}

        {/* Step: Ticket loaded */}
        {step === "ticket-loaded" && ticket && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">{ticket.key}</Badge>
                    <Badge variant="outline" className="text-xs">{ticket.issue_type}</Badge>
                    <Badge variant="outline" className="text-xs">{ticket.status}</Badge>
                  </div>
                  <h3 className="font-medium mt-2">{ticket.summary}</h3>
                </div>
              </div>

              {ticket.description_text && (
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <div className="mt-1 rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {ticket.description_text}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="title-override">Page title (optional override)</Label>
                <Input
                  id="title-override"
                  placeholder={ticket.summary}
                  value={titleOverride}
                  onChange={(e) => setTitleOverride(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleGenerate} className="flex-1">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Draft
                </Button>
                <Button variant="outline" onClick={resetToReady}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Generating */}
        {step === "generating" && (
          <div className="rounded-xl border bg-card p-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Generating documentation draft...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Analyzing ticket and existing docs, writing with Claude
              </p>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && draft && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{draft.title}</h3>
                <Badge variant="secondary">Draft</Badge>
              </div>

              <div
                className="rounded-lg border bg-background p-4 prose prose-sm dark:prose-invert max-w-none max-h-[50vh] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: draft.preview_html }}
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(`https://docs.google.com/document/d/${draft.google_doc_id}/edit`, "_blank")
                  }
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Google Docs
                </Button>
                <Button onClick={handleSubmitForReview} className="flex-1">
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Submit for Review
                </Button>
                <Button variant="ghost" onClick={handleDiscard} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Discard
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
