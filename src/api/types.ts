/** Shared TypeScript types for the clean-arch AccelDocs API. */

export type AIProvider = "gemini" | "anthropic" | "groq" | "openai_compat";

export interface AISettings {
  ai_provider: AIProvider | null;
  ai_has_key: boolean;
  ai_model: string | null;
  ai_base_url: string | null;
}

export interface Org {
  id: number;
  name: string;
  slug: string | null;
  hierarchy_mode: "product" | "flat";
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_heading: string | null;
  font_body: string | null;
  custom_css: string | null;
  tagline: string | null;
  domain: string | null;
  custom_docs_domain: string | null;
  hero_title: string | null;
  hero_description: string | null;
  show_search_on_landing: boolean;
  show_featured_projects: boolean;
  analytics_property_id: string | null;
  copyright: string | null;
  custom_links: string | null;
  sidebar_position: "left" | "right";
  show_toc: boolean;
  code_theme: string | null;
  max_content_width: "4xl" | "5xl" | "6xl" | "full";
  header_html: string | null;
  footer_html: string | null;
  landing_blocks: string | null;
  drive_folder_id: string | null;
  has_drive_connected: boolean;
  ai_provider: AIProvider | null;
  ai_has_key: boolean;
  ai_model: string | null;
  ai_base_url: string | null;
  user_role: "owner" | "admin" | "editor" | "reviewer" | "viewer";
  member_count: number;
  created_at: string;
}

export interface OrgMember {
  id: number;
  user_id: number;
  email: string | null;
  name: string | null;
  role: "owner" | "admin" | "editor" | "reviewer" | "viewer";
  joined_at: string | null;
}

export interface BrandExtractResult {
  name: string | null;
  tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_heading: string | null;
  font_body: string | null;
}

export interface Section {
  id: number;
  organization_id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  section_type: "section" | "tab" | "version";
  visibility?: "public" | "internal" | "external";
  drive_folder_id: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  /** UI-only: child sections (populated client-side) */
  children?: Section[];
  /** UI-only: pages in this section (populated client-side) */
  pages?: Page[];
}

export interface Page {
  id: number;
  organization_id: number;
  section_id: number | null;
  google_doc_id: string;
  title: string;
  slug: string;
  slug_locked?: boolean;
  visibility_override?: "public" | "internal" | "external" | null;
  is_published: boolean;
  status: "draft" | "review" | "published" | "rejected";
  display_order: number;
  drive_modified_at: string | null;
  last_synced_at: string | null;
  owner_id: number | null;
  created_at: string;
  updated_at: string;
  /** Per-page display settings */
  hide_toc: boolean;
  full_width: boolean;
  page_custom_css: string | null;
  featured_image_url: string | null;
  /** Only present when fetched individually */
  html_content?: string;
  published_html?: string;
  /** Present for review workflow metadata */
  review_submitted_by_id?: number | null;
  review_submitted_by_name?: string | null;
  review_submitted_at?: string | null;
}

export interface PageEngagementStats {
  page_id: number;
  page_title: string;
  page_slug: string;
  up: number;
  down: number;
  total_feedback: number;
  total_comments: number;
  helpful_ratio: number | null;
  last_feedback_at: string | null;
  last_comment_at: string | null;
  last_activity_at: string | null;
}

export interface PageCommentInsight {
  id: number;
  page_id: number;
  page_title?: string;
  display_name: string;
  user_email: string | null;
  body: string;
  source: "public" | "internal" | "external" | null;
  created_at: string | null;
}

export interface PageFeedbackInsightItem {
  id: number;
  vote: "up" | "down";
  message: string | null;
  user_email: string | null;
  source: "public" | "internal" | "external" | null;
  created_at: string | null;
}

export interface EngagementOverview {
  summary: {
    total_feedback: number;
    helpful: number;
    not_helpful: number;
    total_comments: number;
    pages_with_feedback: number;
    commented_pages: number;
  };
  pages: PageEngagementStats[];
  recent_comments: PageCommentInsight[];
}

export interface PageEngagementDetail {
  page: {
    id: number;
    title: string;
    slug: string;
  };
  feedback: {
    up: number;
    down: number;
    total: number;
    items: PageFeedbackInsightItem[];
  };
  comments: PageCommentInsight[];
}

export interface DriveStatus {
  connected: boolean;
  has_write_access: boolean;
  drive_folder_id: string | null;
  last_refreshed_at: string | null;
}

export interface ScanResult {
  ok: boolean;
  folder_name: string;
  sections_created: number;
  pages_created: number;
  pages_updated: number;
}

export type ImportTargetType = "product" | "version" | "tab" | "section";

export interface LocalImportResult {
  ok: boolean;
  target_section_id: number;
  target_type: ImportTargetType;
  mode: "files" | "folder";
  uploaded_files: number;
  skipped_files?: number;
  skipped_file_paths?: string[];
  failed_files?: number;
  failed_file_paths?: string[];
  failed_file_errors?: string[];
  settings_manifest_file?: string | null;
  settings_manifest_rules?: number;
  settings_manifest_applied?: number;
  settings_manifest_warnings?: string[];
  sections_created: number;
  pages_created: number;
  pages_updated: number;
}

export interface SyncResult {
  ok: boolean;
  synced: number;
  skipped: number;
  errors: number;
  removed_pages: number;
  removed_sections: number;
}
