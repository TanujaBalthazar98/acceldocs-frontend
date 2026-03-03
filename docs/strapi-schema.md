# Strapi Schema Plan (Draft)

This document defines the initial Strapi content types, relations, and API routes needed to replace the current Supabase-backed CMS. It is intentionally minimal and focuses on the core content model and required workflows.

## 1) Content Types

### Organization
- `name` (string)
- `slug` (string, unique)
- `domain` (string, unique)
- `custom_docs_domain` (string, nullable)
- `logo_url` (string, nullable)
- `tagline` (string, nullable)
- `primary_color` (string)
- `secondary_color` (string)
- `accent_color` (string)
- `font_heading` (string)
- `font_body` (string)
- `custom_css` (text, nullable)
- `hero_title` (string, nullable)
- `hero_description` (text, nullable)
- `show_search_on_landing` (boolean)
- `show_featured_projects` (boolean)
- `mcp_enabled` (boolean, nullable)
- `openapi_spec_json` (json, nullable)
- `openapi_spec_url` (string, nullable)
- `drive_folder_id` (string, nullable)
- `drive_permissions_last_synced_at` (datetime, nullable)
- `owner` (relation: User)

### User (Strapi Users & Permissions)
- Use Strapi user model.
- Add fields:
  - `full_name` (string, nullable)
  - `organization` (relation: Organization, nullable)
  - `account_type` (enum: individual|team|enterprise)
  - `google_refresh_token_encrypted` (text, nullable)
  - `google_refresh_token_present` (boolean)

### OrgRole (User ↔ Organization)
- `organization` (relation: Organization)
- `user` (relation: User)
- `role` (enum: owner|admin|editor|viewer)

### Project
- `name` (string)
- `slug` (string, unique within org)
- `organization` (relation: Organization)
- `parent` (relation: Project, nullable)
- `visibility` (enum: internal|external|public)
- `is_published` (boolean)
- `drive_folder_id` (string, nullable)
- `created_by` (relation: User)
- `show_version_switcher` (boolean, default true)

### ProjectVersion
- `project` (relation: Project)
- `name` (string)
- `slug` (string)
- `is_default` (boolean)
- `is_published` (boolean)
- `semver_major` (number)
- `semver_minor` (number)
- `semver_patch` (number)

### Topic
- `name` (string)
- `slug` (string)
- `project` (relation: Project)
- `project_version` (relation: ProjectVersion, nullable)
- `parent` (relation: Topic, nullable)
- `display_order` (number, nullable)
- `drive_folder_id` (string, nullable)

### Document
- `title` (string)
- `slug` (string)
- `project` (relation: Project)
- `project_version` (relation: ProjectVersion, nullable)
- `topic` (relation: Topic, nullable)
- `google_doc_id` (string)
- `visibility` (enum: internal|external|public)
- `is_published` (boolean)
- `content_html` (text, nullable)
- `published_content_html` (text, nullable)
- `content_id` (string, nullable)
- `published_content_id` (string, nullable)
- `video_url` (string, nullable)
- `video_title` (string, nullable)
- `owner` (relation: User, nullable)
- `display_order` (number, nullable)
- `last_synced_at` (datetime, nullable)
- `google_modified_at` (datetime, nullable)

### Domain
- `organization` (relation: Organization)
- `project` (relation: Project, nullable)
- `domain` (string)
- `domain_type` (enum: custom|subdomain)
- `is_primary` (boolean)
- `is_verified` (boolean)
- `verification_token` (string, nullable)
- `ssl_status` (enum: pending|provisioning|active|failed)

### Invitation
- `organization` (relation: Organization)
- `email` (string)
- `role` (enum: owner|admin|editor|viewer)
- `token` (uuid)
- `invited_by` (relation: User)
- `accepted_at` (datetime, nullable)
- `expires_at` (datetime, nullable)

### JoinRequest
- `organization` (relation: Organization)
- `user` (relation: User)
- `message` (text, nullable)
- `status` (enum: pending|approved|rejected)
- `created_at` (datetime)

### ProjectMember
- `project` (relation: Project)
- `user` (relation: User)
- `role` (enum: admin|editor|reviewer|viewer)

### SlugHistory
- `entity_type` (enum: project|topic|document)
- `entity_id` (uuid/string)
- `old_slug` (string)
- `new_slug` (string)
- `created_at` (datetime)

### PageFeedback
- `document` (relation: Document)
- `user` (relation: User, nullable)
- `user_name` (string, nullable)
- `user_email` (string, nullable)
- `content` (text)
- `feedback_type` (enum: rating|comment|suggestion|issue)
- `issue_type` (string, nullable)
- `rating` (number, nullable)
- `is_resolved` (boolean)

### AuditLog
- `user` (relation: User)
- `action` (string)
- `entity_type` (string)
- `entity_id` (string, nullable)
- `project` (relation: Project, nullable)
- `metadata` (json, nullable)
- `success` (boolean)
- `error_message` (string, nullable)

### DocumentCache (encrypted)
- `document` (relation: Document)
- `organization` (relation: Organization)
- `content_html_encrypted` (text, nullable)
- `content_text_encrypted` (text, nullable)
- `headings_encrypted` (text, nullable)
- `published_content_html_encrypted` (text, nullable)
- `updated_at` (datetime)

## 2) Custom Endpoints (Strapi)

### Functions (REST)
- `POST /api/functions/google-drive`
- `POST /api/functions/convert-markdown-to-gdoc`
- `POST /api/functions/import-markdown`
- `POST /api/functions/document-cache`
- `POST /api/functions/ensure-workspace`
- `POST /api/functions/sync-drive-permissions`
- `POST /api/functions/repair-hierarchy`
- `POST /api/functions/normalize-structure`
- `POST /api/functions/extract-website-styles`
- `POST /api/functions/send-invitation-email`

### RPC (REST)
- `POST /api/rpc/can_edit_project`
- `POST /api/rpc/promote_version_to_default`
- `POST /api/rpc/duplicate_project_version`
- `POST /api/rpc/approve_join_request`
- `POST /api/rpc/reject_join_request`

## 3) Permissions

Strapi RBAC should mirror existing behavior:
- Org roles: owner/admin/editor/viewer
- Project roles: admin/editor/reviewer/viewer
- Default viewer access for published public content

## 4) Migration Notes

When bootstrapping Strapi:
- Create content types and relations first.
- Add custom controllers for function + rpc routes.
- Implement encryption service for tokens + cache fields.
- Implement Drive service and worker for sync/imports.

