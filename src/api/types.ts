/** Shared TypeScript types for the clean-arch AccelDocs API. */

export interface Org {
  id: number;
  name: string;
  slug: string | null;
  hierarchy_mode: "product" | "flat";
  logo_url: string | null;
  primary_color: string | null;
  tagline: string | null;
  domain: string | null;
  drive_folder_id: string | null;
  has_drive_connected: boolean;
  user_role: "owner" | "admin" | "editor" | "viewer";
  member_count: number;
  created_at: string;
}

export interface OrgMember {
  id: number;
  user_id: number;
  email: string | null;
  name: string | null;
  role: "owner" | "admin" | "editor" | "viewer";
  joined_at: string | null;
}

export interface Section {
  id: number;
  organization_id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  section_type: "section" | "tab";
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
  status: "draft" | "published";
  display_order: number;
  drive_modified_at: string | null;
  last_synced_at: string | null;
  owner_id: number | null;
  created_at: string;
  updated_at: string;
  /** Only present when fetched individually */
  html_content?: string;
  published_html?: string;
}

export interface DriveStatus {
  connected: boolean;
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

export type ImportTargetType = "product" | "tab" | "section";

export interface LocalImportResult {
  ok: boolean;
  target_section_id: number;
  target_type: ImportTargetType;
  mode: "files" | "folder";
  uploaded_files: number;
  sections_created: number;
  pages_created: number;
  pages_updated: number;
}

export interface SyncResult {
  ok: boolean;
  synced: number;
  skipped: number;
  errors: number;
}
