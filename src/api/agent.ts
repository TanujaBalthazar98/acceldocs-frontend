import { invokeFunction } from "@/lib/api/functions";
import { API_BASE_URL, getAuthToken, ORG_ID_KEY } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Jira API types (existing)
// ---------------------------------------------------------------------------

export interface JiraStatus {
  ok: boolean;
  connected: boolean;
  domain?: string;
  email?: string;
}

export interface JiraTicket {
  ok: boolean;
  key: string;
  summary: string;
  description_text: string;
  status: string;
  issue_type: string;
  labels: string[];
  error?: string;
}

export interface GenerateResult {
  ok: boolean;
  page_id: number;
  title: string;
  slug: string;
  google_doc_id: string;
  preview_html: string;
  error?: string;
}

export type InlineOperation = "rewrite" | "expand" | "summarize" | "simplify" | "translate" | "fix_grammar";

export interface InlineAssistResult {
  ok: boolean;
  result: string;
  operation: string;
}

export const agentApi = {
  jiraStatus: () =>
    invokeFunction<JiraStatus>("jira-status", { body: {} }),

  jiraConnect: (domain: string, email: string, apiToken: string) =>
    invokeFunction<{ ok: boolean; domain: string; email: string; error?: string }>(
      "jira-connect",
      { body: { domain, email, api_token: apiToken } },
    ),

  jiraDisconnect: () =>
    invokeFunction<{ ok: boolean }>("jira-disconnect", { body: {} }),

  jiraGetTicket: (ticketKey: string) =>
    invokeFunction<JiraTicket>("jira-get-ticket", { body: { ticket_key: ticketKey } }),

  generateDoc: (ticketKey: string, sectionId: number | null, titleOverride?: string) =>
    invokeFunction<GenerateResult>("agent-generate-doc", {
      body: { ticket_key: ticketKey, section_id: sectionId, title_override: titleOverride },
    }),

  listConversations: async (): Promise<ConversationSummary[]> => {
    const token = getAuthToken();
    const orgId = localStorage.getItem(ORG_ID_KEY);
    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (orgId) headers["X-Org-Id"] = orgId;
    const resp = await fetch(`${baseUrl}/api/agent/conversations`, { headers });
    if (!resp.ok) throw new Error("Failed to list conversations");
    return resp.json();
  },

  getConversation: async (id: number): Promise<ConversationFull> => {
    const token = getAuthToken();
    const orgId = localStorage.getItem(ORG_ID_KEY);
    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (orgId) headers["X-Org-Id"] = orgId;
    const resp = await fetch(`${baseUrl}/api/agent/conversations/${id}`, { headers });
    if (!resp.ok) throw new Error("Failed to get conversation");
    return resp.json();
  },

  deleteConversation: async (id: number): Promise<void> => {
    const token = getAuthToken();
    const orgId = localStorage.getItem(ORG_ID_KEY);
    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (orgId) headers["X-Org-Id"] = orgId;
    await fetch(`${baseUrl}/api/agent/conversations/${id}`, { method: "DELETE", headers });
  },

  inlineAssist: async (params: {
    operation: InlineOperation;
    selected_text: string;
    context?: string;
    language?: string;
  }): Promise<InlineAssistResult> => {
    const token = getAuthToken();
    const orgId = localStorage.getItem(ORG_ID_KEY);
    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (orgId) headers["X-Org-Id"] = orgId;
    const resp = await fetch(`${baseUrl}/api/agent/inline`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Inline assist failed: ${resp.status} ${text}`);
    }
    return resp.json();
  },
};

// ---------------------------------------------------------------------------
// Streaming chat types
// ---------------------------------------------------------------------------

export interface ChatSSEEvent {
  type: "text_delta" | "tool_start" | "tool_result" | "draft_created" | "done" | "error" | "conversation_saved";
  text?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  success?: boolean;
  data?: Record<string, unknown>;
  page_id?: number;
  title?: string;
  google_doc_id?: string;
  message?: string;
  conversation_id?: number;
}

export interface ConversationSummary {
  id: number;
  title: string;
  updated_at: string;
}

export interface ConversationFull {
  id: number;
  title: string;
  messages: string;
  history: string;
  created_at: string;
  updated_at: string;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Streaming chat function
// ---------------------------------------------------------------------------

function getApiBaseUrl(): string {
  const base = API_BASE_URL;
  if (typeof window === "undefined") return base;
  const isLocalHttps =
    window.location.protocol === "https:" &&
    /^(http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(base);
  return isLocalHttps ? "" : base;
}

export async function* streamAgentChat(
  message: string,
  history: ChatHistoryMessage[],
  conversationId?: number | null,
): AsyncGenerator<ChatSSEEvent, void, unknown> {
  const token = getAuthToken();
  const orgId = localStorage.getItem(ORG_ID_KEY);
  const baseUrl = getApiBaseUrl();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (orgId) headers["X-Org-Id"] = orgId;

  const response = await fetch(`${baseUrl}/api/agent/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, history, conversation_id: conversationId ?? null }),
  });

  if (!response.ok) {
    const text = await response.text();
    yield { type: "error", message: `Server error: ${response.status} ${text}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: "error", message: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        yield JSON.parse(jsonStr) as ChatSSEEvent;
      } catch {
        // Skip malformed lines
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim().startsWith("data:")) {
    const jsonStr = buffer.trim().slice(5).trim();
    if (jsonStr && jsonStr !== "[DONE]") {
      try {
        yield JSON.parse(jsonStr) as ChatSSEEvent;
      } catch {
        // Skip
      }
    }
  }
}
