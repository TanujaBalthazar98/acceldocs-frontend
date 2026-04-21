import { fetchOrThrow } from "./client";
import type { AISettings, BrandExtractResult, Org, OrgMember } from "./types";

export const orgApi = {
  get: (orgId?: number): Promise<Org> =>
    fetchOrThrow<Org>(orgId ? `/api/org?org_id=${orgId}` : "/api/org"),

  listOrgs: (): Promise<{ ok: boolean; organizations: { id: number; name: string; slug: string; logo_url: string | null; domain: string | null; user_role: string }[] }> =>
    fetchOrThrow("/api/org/list"),

  update: (data: Partial<Pick<
    Org,
    | "name"
    | "drive_folder_id"
    | "logo_url"
    | "primary_color"
    | "secondary_color"
    | "accent_color"
    | "font_heading"
    | "font_body"
    | "custom_css"
    | "tagline"
    | "hierarchy_mode"
    | "custom_docs_domain"
    | "hero_title"
    | "hero_description"
    | "show_search_on_landing"
    | "show_featured_projects"
    | "analytics_property_id"
    | "copyright"
    | "custom_links"
    | "sidebar_position"
    | "show_toc"
    | "code_theme"
    | "max_content_width"
    | "header_html"
    | "footer_html"
    | "landing_blocks"
  >>): Promise<Org> =>
    fetchOrThrow<Org>("/api/org", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listMembers: (): Promise<{ members: OrgMember[] }> =>
    fetchOrThrow<{ members: OrgMember[] }>("/api/org/members"),

  updateMemberRole: (memberId: number, role: OrgMember["role"]): Promise<void> =>
    fetchOrThrow("/api/org/members/" + memberId + "/role", {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  removeMember: (memberId: number): Promise<void> =>
    fetchOrThrow("/api/org/members/" + memberId, { method: "DELETE" }),

  extractBrand: (url: string): Promise<BrandExtractResult> =>
    fetchOrThrow<BrandExtractResult>("/api/org/brand-extract", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  getAISettings: (): Promise<AISettings> =>
    fetchOrThrow<AISettings>("/api/org/ai-settings"),

  updateAISettings: (data: {
    ai_provider?: string;
    ai_api_key?: string;
    ai_model?: string;
    ai_base_url?: string;
  }): Promise<AISettings> =>
    fetchOrThrow<AISettings>("/api/org/ai-settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteAISettings: (): Promise<{ ok: boolean }> =>
    fetchOrThrow<{ ok: boolean }>("/api/org/ai-settings", { method: "DELETE" }),
};
