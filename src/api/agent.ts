import { invokeFunction } from "@/lib/api/functions";
import { getAuthToken } from "@/lib/api/client";

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
};

// ---------------------------------------------------------------------------
// Streaming chat types
// ---------------------------------------------------------------------------

export interface ChatSSEEvent {
  type: "text_delta" | "tool_start" | "tool_result" | "draft_created" | "done" | "error";
  text?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  success?: boolean;
  data?: Record<string, unknown>;
  page_id?: number;
  title?: string;
  google_doc_id?: string;
  message?: string;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Streaming chat function
// ---------------------------------------------------------------------------

function getApiBaseUrl(): string {
  const configuredUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
  const productionUrl = "https://acceldocs-backend.vercel.app";
  const base = configuredUrl || (import.meta.env.PROD ? productionUrl : "http://localhost:8000");

  if (typeof window === "undefined") return base;
  const isLocalHttps =
    window.location.protocol === "https:" &&
    /^(http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(base);
  return isLocalHttps ? "" : base;
}

export async function* streamAgentChat(
  message: string,
  history: ChatHistoryMessage[],
): AsyncGenerator<ChatSSEEvent, void, unknown> {
  const token = getAuthToken();
  const orgId = localStorage.getItem("acceldocs_current_org_id");
  const baseUrl = getApiBaseUrl();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (orgId) headers["X-Org-Id"] = orgId;

  const response = await fetch(`${baseUrl}/api/agent/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, history }),
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
