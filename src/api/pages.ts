import { fetchOrThrow } from "./client";
import type { Page } from "./types";

export const pagesApi = {
  list: (sectionId?: number): Promise<{ pages: Page[] }> =>
    fetchOrThrow<{ pages: Page[] }>(
      "/api/pages" + (sectionId !== undefined ? "?section_id=" + sectionId : "")
    ),

  create: (data: {
    google_doc_id: string;
    section_id?: number | null;
    title?: string;
    display_order?: number;
  }): Promise<Page> =>
    fetchOrThrow<Page>("/api/pages", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  get: (id: number): Promise<Page> =>
    fetchOrThrow<Page>("/api/pages/" + id),

  update: (id: number, data: Partial<Pick<Page, "section_id" | "title" | "slug" | "visibility_override" | "display_order">>): Promise<Page> =>
    fetchOrThrow<Page>("/api/pages/" + id, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    fetchOrThrow("/api/pages/" + id, { method: "DELETE" }),

  sync: (id: number): Promise<{ ok: boolean; page: Page }> =>
    fetchOrThrow<{ ok: boolean; page: Page }>("/api/pages/" + id + "/sync", { method: "POST" }),

  publish: (id: number): Promise<{ ok: boolean; page: Page }> =>
    fetchOrThrow<{ ok: boolean; page: Page }>("/api/pages/" + id + "/publish", { method: "POST" }),

  submitReview: (id: number): Promise<{ ok: boolean; page: Page; status?: string }> =>
    fetchOrThrow<{ ok: boolean; page: Page; status?: string }>("/api/pages/" + id + "/submit-review", { method: "POST" }),

  approve: (id: number): Promise<{ ok: boolean; page: Page }> =>
    fetchOrThrow<{ ok: boolean; page: Page }>("/api/pages/" + id + "/approve", { method: "POST" }),

  reject: (id: number): Promise<{ ok: boolean; page: Page }> =>
    fetchOrThrow<{ ok: boolean; page: Page }>("/api/pages/" + id + "/reject", { method: "POST" }),

  unpublish: (id: number): Promise<{ ok: boolean }> =>
    fetchOrThrow<{ ok: boolean }>("/api/pages/" + id + "/unpublish", { method: "POST" }),

  duplicate: (id: number): Promise<Page> =>
    fetchOrThrow<Page>("/api/pages/" + id + "/duplicate", { method: "POST" }),
};
