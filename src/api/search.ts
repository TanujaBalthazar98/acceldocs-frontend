import { fetchOrThrow } from "./client";

export interface SearchResultItem {
  page_id: number;
  title: string;
  slug: string;
  section_name: string | null;
  snippet: string;
  score: number;
}

export const searchApi = {
  search: (params: {
    q: string;
    org_slug: string;
    audience?: string;
    limit?: number;
  }): Promise<{ results: SearchResultItem[] }> =>
    fetchOrThrow<{ results: SearchResultItem[] }>("/api/docs/search", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};
