import { fetchOrThrow, getAuthToken } from "./client";
import { API_BASE_URL } from "@/lib/api/client";

export interface DiscoverRequest {
  source_url: string;
  product: string;
  use_playwright: boolean;
}

export interface DiscoverResponse {
  source_url: string;
  source_type: string;
  products: { name: string; versions: string[] }[];
  total_pages: number;
  hierarchy: MigrationNode[];
}

export interface MigrationNode {
  title: string;
  url: string | null;
  depth: number;
  children?: MigrationNode[];
  _section_type?: string;
}

export interface StartRequest {
  source_url: string;
  product: string;
  backend_url: string;
  api_token: string;
  org_id: number;
  product_id: number;
  use_playwright: boolean;
  create_drive_docs: boolean;
  max_pages: number;
}

export interface StatusResponse {
  status: string;
  progress: {
    phase: string;
    message: string;
    fetched?: number;
    total?: number;
    imported?: number;
  };
  errors: { url?: string; error: string }[];
  started_at: string | null;
  completed_at: string | null;
}

export interface MigrationHistoryItem {
  migration_id: string;
  status: string;
  source_url: string;
  product: string;
  progress: { phase: string; message: string };
  started_at: string | null;
  completed_at: string | null;
  result?: { pages_imported: number; sections_created: number };
  error?: string;
}

export function getApiBaseUrl(): string {
  if (API_BASE_URL && !API_BASE_URL.includes("localhost")) {
    return API_BASE_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return API_BASE_URL;
}

export const migrationApi = {
  discover: (body: DiscoverRequest): Promise<DiscoverResponse> =>
    fetchOrThrow<DiscoverResponse>("/api/migration/discover", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  start: (body: StartRequest): Promise<{ migration_id: string; status: string; message: string }> =>
    fetchOrThrow<{ migration_id: string; status: string; message: string }>("/api/migration/start", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getStatus: (migrationId: string): Promise<StatusResponse> =>
    fetchOrThrow<StatusResponse>(`/api/migration/status/${migrationId}`),

  cancel: (migrationId: string): Promise<{ status: string; message: string }> =>
    fetchOrThrow<{ status: string; message: string }>(`/api/migration/cancel/${migrationId}`, {
      method: "POST",
    }),

  getHistory: (): Promise<MigrationHistoryItem[]> =>
    fetchOrThrow<MigrationHistoryItem[]>("/api/migration/history"),
};
