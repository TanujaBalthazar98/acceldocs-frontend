import { useState, useRef, useEffect, useCallback } from "react";
import { streamAgentChat, agentApi, type ChatHistoryMessage, type ChatSSEEvent } from "@/api/agent";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Send,
  Loader2,
  FileText,
  Search,
  List,
  BookOpen,
  Link2,
  Unplug,
  ExternalLink,
  ChevronDown,
  Bot,
  User,
  AlertCircle,
  FilePlus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextMessage {
  role: "user" | "assistant";
  content: string;
}

interface ToolEvent {
  type: "tool";
  toolName: string;
  friendlyName: string;
  success?: boolean;
}

interface DraftEvent {
  type: "draft";
  pageId: number;
  title: string;
  googleDocId: string;
}

interface ErrorEvent {
  type: "error";
  message: string;
}

type ChatItem = TextMessage | ToolEvent | DraftEvent | ErrorEvent;

const TOOL_ICONS: Record<string, React.ReactNode> = {
  list_sections: <List className="h-3.5 w-3.5" />,
  list_pages: <List className="h-3.5 w-3.5" />,
  read_page: <BookOpen className="h-3.5 w-3.5" />,
  search_docs: <Search className="h-3.5 w-3.5" />,
  create_draft: <FilePlus className="h-3.5 w-3.5" />,
  fetch_jira_ticket: <FileText className="h-3.5 w-3.5" />,
  search_confluence: <Search className="h-3.5 w-3.5" />,
};

const TOOL_LABELS: Record<string, string> = {
  list_sections: "Browsing sections",
  list_pages: "Listing pages",
  read_page: "Reading page",
  search_docs: "Searching documentation",
  create_draft: "Creating draft",
  fetch_jira_ticket: "Fetching Jira ticket",
  search_confluence: "Searching Confluence",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToolBubble({ item }: { item: ToolEvent }) {
  const icon = TOOL_ICONS[item.toolName] ?? <Sparkles className="h-3.5 w-3.5" />;
  const label = TOOL_LABELS[item.toolName] ?? item.friendlyName;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5 pl-10">
      <span className="text-muted-foreground/60">{icon}</span>
      <span className={item.success === false ? "text-destructive" : ""}>{label}</span>
      {item.success === true && (
        <span className="text-emerald-500 text-[10px]">✓</span>
      )}
      {item.success === false && (
        <span className="text-destructive text-[10px]">✗</span>
      )}
    </div>
  );
}

function DraftCard({ item, onOpen }: { item: DraftEvent; onOpen: (pageId: number) => void }) {
  return (
    <div className="ml-10 mr-2 rounded-xl border bg-primary/5 border-primary/20 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <FilePlus className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">Draft created</span>
        <Badge variant="secondary" className="text-xs ml-auto">Draft</Badge>
      </div>
      <p className="text-sm font-medium leading-snug">{item.title}</p>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() =>
            window.open(`https://docs.google.com/document/d/${item.googleDocId}/edit`, "_blank")
          }
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open in Google Docs
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => onOpen(item.pageId)}
        >
          View in Workspace
        </Button>
      </div>
    </div>
  );
}

function AssistantMessage({ text }: { text: string }) {
  // Simple markdown-lite rendering: bold, code, line breaks
  const lines = text.split("\n");
  return (
    <div className="flex gap-3 items-start">
      <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 text-sm leading-relaxed whitespace-pre-wrap break-words min-w-0">
        {lines.map((line, i) => {
          // Render headings
          if (line.startsWith("### ")) {
            return <p key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(4)}</p>;
          }
          if (line.startsWith("## ")) {
            return <p key={i} className="font-semibold text-lg mt-4 mb-1">{line.slice(3)}</p>;
          }
          if (line.startsWith("# ")) {
            return <p key={i} className="font-bold text-xl mt-4 mb-2">{line.slice(2)}</p>;
          }
          // Render list items
          if (line.match(/^[-*] /)) {
            return (
              <div key={i} className="flex gap-2 leading-relaxed">
                <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                <span>{renderInline(line.slice(2))}</span>
              </div>
            );
          }
          if (line.match(/^\d+\. /)) {
            const match = line.match(/^(\d+)\. (.*)/);
            if (match) {
              return (
                <div key={i} className="flex gap-2 leading-relaxed">
                  <span className="text-muted-foreground shrink-0">{match[1]}.</span>
                  <span>{renderInline(match[2])}</span>
                </div>
              );
            }
          }
          // Empty line
          if (line === "") return <div key={i} className="h-2" />;
          // Regular paragraph
          return <p key={i}>{renderInline(line)}</p>;
        })}
      </div>
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold**, `code`
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1 py-0.5 rounded text-xs bg-muted font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Jira setup mini-form
// ---------------------------------------------------------------------------
interface JiraSetupProps {
  onConnected: (domain: string) => void;
}
function JiraSetupForm({ onConnected }: JiraSetupProps) {
  const { toast } = useToast();
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    const { data } = await agentApi.jiraConnect(domain, email, token);
    setLoading(false);
    if (data?.ok) {
      toast({ title: "Jira connected", description: `Connected to ${data.domain}` });
      onConnected(data.domain || domain);
    } else {
      setError((data as { error?: string })?.error || "Failed to connect");
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3 mx-2">
      <div>
        <p className="text-sm font-medium">Connect Jira to unlock ticket-based docs</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter your Jira Cloud credentials.{" "}
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Create an API token →
          </a>
        </p>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Input
          placeholder="yourcompany.atlassian.net"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          type="password"
          placeholder="Jira API token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <Button
        size="sm"
        disabled={loading || !domain || !email || !token}
        onClick={handleConnect}
        className="w-full"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
        Connect Jira
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------
const SUGGESTED_PROMPTS = [
  "What sections do we have in our documentation?",
  "Generate a doc for ticket PROJ-123",
  "Search for existing content about authentication",
  "Create a getting started guide",
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AgentChatPanelProps {
  onPageCreated: (pageId: number) => void;
}

export function AgentChatPanel({ onPageCreated }: AgentChatPanelProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [history, setHistory] = useState<ChatHistoryMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [jiraConnected, setJiraConnected] = useState<boolean | null>(null); // null = loading
  const [jiraDomain, setJiraDomain] = useState("");
  const [showJiraSetup, setShowJiraSetup] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Check Jira status on mount
  useEffect(() => {
    agentApi.jiraStatus().then(({ data }) => {
      if (data?.connected) {
        setJiraConnected(true);
        setJiraDomain(data.domain || "");
      } else {
        setJiraConnected(false);
      }
    });
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items]);

  const handleDisconnectJira = async () => {
    await agentApi.jiraDisconnect();
    setJiraConnected(false);
    setJiraDomain("");
    toast({ title: "Jira disconnected" });
  };

  const appendItem = (item: ChatItem) => {
    setItems((prev) => [...prev, item]);
  };

  const updateLastAssistantText = (delta: string) => {
    setItems((prev) => {
      const last = prev[prev.length - 1];
      if (last && "role" in last && last.role === "assistant") {
        return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
      }
      // Start a new assistant message
      return [...prev, { role: "assistant", content: delta }];
    });
  };

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;

      const userMessage = text.trim();
      setInput("");
      appendItem({ role: "user", content: userMessage });
      setStreaming(true);

      const newHistory: ChatHistoryMessage[] = [
        ...history,
        { role: "user", content: userMessage },
      ];

      let assistantText = "";

      try {
        const gen = streamAgentChat(userMessage, history);

        for await (const event of gen) {
          if (event.type === "text_delta" && event.text) {
            assistantText += event.text;
            updateLastAssistantText(event.text);
          } else if (event.type === "tool_start") {
            appendItem({
              type: "tool",
              toolName: event.tool_name || "",
              friendlyName: TOOL_LABELS[event.tool_name || ""] || event.tool_name || "",
            });
          } else if (event.type === "tool_result") {
            // Update the last tool item with success/failure
            setItems((prev) => {
              const lastTool = [...prev].reverse().find(
                (i) => "type" in i && i.type === "tool" && (i as ToolEvent).toolName === event.tool_name,
              );
              if (!lastTool) return prev;
              const idx = prev.lastIndexOf(lastTool);
              const updated = [...prev];
              updated[idx] = { ...(lastTool as ToolEvent), success: event.success };
              return updated;
            });
          } else if (event.type === "draft_created") {
            appendItem({
              type: "draft",
              pageId: event.page_id!,
              title: event.title!,
              googleDocId: event.google_doc_id!,
            });
          } else if (event.type === "error") {
            appendItem({ type: "error", message: event.message || "Unknown error" });
          }
        }

        // Update history for next turn
        const updatedHistory: ChatHistoryMessage[] = [
          ...newHistory,
          ...(assistantText ? [{ role: "assistant" as const, content: assistantText }] : []),
        ];
        setHistory(updatedHistory.slice(-40)); // Keep last 40 messages
      } catch (err) {
        appendItem({ type: "error", message: String(err) });
      } finally {
        setStreaming(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [history, streaming],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = items.length === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3 flex items-center justify-between gap-3 bg-background">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Documentation Agent</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Powered by Claude</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {jiraConnected === null && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {jiraConnected === true && (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="gap-1 text-xs h-6">
                <Link2 className="h-2.5 w-2.5" />
                {jiraDomain}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleDisconnectJira}
              >
                <Unplug className="h-3 w-3" />
              </Button>
            </div>
          )}
          {jiraConnected === false && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowJiraSetup((v) => !v)}
            >
              <Link2 className="h-3 w-3 mr-1" />
              Connect Jira
              <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showJiraSetup ? "rotate-180" : ""}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Jira setup dropdown */}
      {showJiraSetup && jiraConnected === false && (
        <div className="shrink-0 border-b py-3 bg-muted/30">
          <JiraSetupForm
            onConnected={(domain) => {
              setJiraConnected(true);
              setJiraDomain(domain);
              setShowJiraSetup(false);
            }}
          />
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center p-8 gap-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Documentation Agent</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                I can help you create and explore documentation. Connect Jira to generate docs from tickets, or just ask me anything.
              </p>
            </div>
            <div className="w-full max-w-sm space-y-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left text-sm px-4 py-2.5 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 max-w-3xl mx-auto w-full">
            {items.map((item, i) => {
              // User message
              if ("role" in item && item.role === "user") {
                return (
                  <div key={i} className="flex gap-3 items-start justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed">
                      {item.content}
                    </div>
                    <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mt-0.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              }

              // Assistant message
              if ("role" in item && item.role === "assistant") {
                return (
                  <div key={i} className="max-w-[90%]">
                    <AssistantMessage text={item.content} />
                  </div>
                );
              }

              // Tool use
              if ("type" in item && item.type === "tool") {
                return <ToolBubble key={i} item={item} />;
              }

              // Draft created
              if ("type" in item && item.type === "draft") {
                return (
                  <DraftCard
                    key={i}
                    item={item}
                    onOpen={(pageId) => {
                      onPageCreated(pageId);
                    }}
                  />
                );
              }

              // Error
              if ("type" in item && item.type === "error") {
                return (
                  <div key={i} className="flex items-center gap-2 text-sm text-destructive ml-10">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {item.message}
                  </div>
                );
              }

              return null;
            })}

            {/* Streaming indicator */}
            {streaming && (
              <div className="flex gap-3 items-center pl-10">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-3 bg-background">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to create docs, search content, or fetch a Jira ticket…"
            disabled={streaming}
            className="flex-1 min-w-0 h-10 rounded-xl border border-input bg-background px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:opacity-50"
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl shrink-0"
            disabled={!input.trim() || streaming}
            onClick={() => sendMessage(input)}
          >
            {streaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Agent may make mistakes. Review drafts before publishing.
        </p>
      </div>
    </div>
  );
}
