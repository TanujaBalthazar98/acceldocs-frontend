import { z } from "zod";
import { fetchOrThrow } from "./client";
import { invokeFunction } from "@/lib/api/functions";
import type { EngagementOverview, Page, PageEngagementDetail } from "./types";

export const PageSchema = z.object({
  id: z.number(),
  organization_id: z.number(),
  section_id: z.number().nullable(),
  google_doc_id: z.string(),
  title: z.string(),
  slug: z.string(),
  slug_locked: z.boolean().optional(),
  visibility_override: z.enum(["public", "internal", "external"]).nullable().optional(),
  is_published: z.boolean(),
  status: z.enum(["draft", "review", "published", "rejected"]),
  display_order: z.number(),
  drive_modified_at: z.string().nullable(),
  last_synced_at: z.string().nullable(),
  owner_id: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  hide_toc: z.boolean(),
  full_width: z.boolean(),
  page_custom_css: z.string().nullable(),
  featured_image_url: z.string().nullable(),
  html_content: z.string().optional(),
  published_html: z.string().optional(),
});

const PageListResponseSchema = z.object({ pages: z.array(PageSchema) });

export const pagesApi = {
  list: async (sectionId?: number): Promise<{ pages: Page[] }> => {
    const raw = await fetchOrThrow<{ pages: Page[] }>(
      "/api/pages" + (sectionId !== undefined ? "?section_id=" + sectionId : "")
    );
    const result = PageListResponseSchema.safeParse(raw);
    if (!result.success) {
      console.warn("[pagesApi.list] schema validation issues:", result.error.issues);
    }
    return raw;
  },

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

  update: (id: number, data: Partial<Pick<Page, "section_id" | "title" | "slug" | "visibility_override" | "display_order" | "hide_toc" | "full_width" | "page_custom_css" | "featured_image_url">>): Promise<Page> =>
    fetchOrThrow<Page>("/api/pages/" + id, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<{ ok: boolean; drive_trashed: boolean; drive_error: string | null }> =>
    fetchOrThrow<{ ok: boolean; drive_trashed: boolean; drive_error: string | null }>("/api/pages/" + id, { method: "DELETE" }),

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

  engagementOverview: (limit = 10): Promise<EngagementOverview> =>
    fetchOrThrow<EngagementOverview>("/api/pages/engagement/overview?limit=" + limit),

  engagementDetail: (id: number, limit = 20): Promise<PageEngagementDetail> =>
    fetchOrThrow<PageEngagementDetail>("/api/pages/" + id + "/engagement?limit=" + limit),

  createFromTemplate: (data: {
    title: string;
    content: string;
    section_id?: number | null;
  }): Promise<{ ok: boolean; page_id: number; title: string; slug: string; google_doc_id: string; error?: string }> =>
    invokeFunction<{ ok: boolean; page_id: number; title: string; slug: string; google_doc_id: string; error?: string }>(
      "create-template-page",
      { body: data },
    ).then(({ data, error }) => {
      if (error) throw new Error(error.message || "Failed to create page from template");
      if (!data) throw new Error("No response from server");
      return data;
    }),
};
