
import { LucideIcon } from "lucide-react";

export type VisibilityLevel = "internal" | "external" | "public";

export interface Project {
    id: string;
    name: string;
    slug: string | null;
    drive_folder_id: string | null;
    drive_parent_id?: string | null;
    visibility: VisibilityLevel;
    is_published: boolean;
    parent_id: string | null;
    organization_id: string;
    mcp_enabled?: boolean | null;
    openapi_spec_json?: any;
    openapi_spec_url?: string | null;
    show_version_switcher?: boolean;
}

export interface ProjectVersion {
    id: string;
    project_id: string;
    name: string;
    slug: string;
    is_default: boolean;
    is_published: boolean;
    semver_major: number;
    semver_minor: number;
    semver_patch: number;
}

export interface Topic {
    id: string;
    name: string;
    drive_folder_id: string;
    project_id: string;
    project_version_id: string | null;
    parent_id: string | null;
    display_order: number | null;
}

export interface Document {
    id: string;
    title: string;
    google_doc_id: string;
    project_id: string | null;
    project_version_id: string | null;
    topic_id: string | null;
    display_order: number | null;
    google_modified_at: string | null;
    created_at: string;
    updated_at: string;
    visibility: VisibilityLevel;
    is_published: boolean;
    owner_id: string | null;
    owner_name?: string;
    content_html: string | null;
    published_content_html: string | null;
    content_id: string | null;
    published_content_id: string | null;
    video_url?: string | null;
    video_title?: string | null;
}

export interface SidebarSection {
    title?: string;
    items: SidebarItem[];
}

export interface SidebarItem {
    title: string;
    icon: LucideIcon;
    variant: "default" | "ghost";
    onClick: () => void;
    active?: boolean;
}
