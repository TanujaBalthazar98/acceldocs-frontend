# Phase 2 — New Architecture Definition (Strapi-Free)

## Goal
Replace Strapi CMS with:
- **Google Docs + Google Drive** as authoring/source of truth
- **Automation backend** for ingestion, conversion, workflow, approvals
- **MkDocs** for static rendering/publishing

No CMS dependency in target design.

---

## 1) Target System Architecture

## Core Components
- **Authoring layer**
  - Google Drive folder tree under:
  - `Documentation/<Project>/<Version>/<Public|Internal>/<Sections...>/<Doc>`
  - Google Docs store editable content.
- **Automation backend (new service)**
  - Drive scanner (recursive)
  - Metadata extractor (Doc header/frontmatter)
  - HTML exporter + Markdown conversion orchestrator
  - Validation + slug generation + workflow state machine
  - Publish queue + Git operations
  - Approval API + audit logs
- **Static docs renderer**
  - MkDocs Material
  - Generated content in repo:
  - `docs/<project>/<version>/<visibility>/<sections>/<page>.md`
  - Auto-generated `mkdocs.yml` navigation.
- **Approval dashboard (minimal UI)**
  - Google OAuth login
  - Pending docs list
  - Preview link
  - Approve / Reject actions
- **Git/Deployment**
  - `docs-preview` branch for REVIEW
  - `main` branch for APPROVED
  - CI deploy hooks per branch

---

## 2) Canonical Content Model (Backend DB)

Store **metadata only** (not full doc bodies).

## Main entities
- `organizations`
- `users`
- `roles` (org + project scopes)
- `projects` (from top-level folders)
- `project_versions` (from version folders)
- `sections` (hierarchical topics/subtopics, unlimited depth)
- `documents`
  - `google_doc_id`
  - `drive_path`
  - `slug`
  - `status` (`DRAFT | REVIEW | APPROVED | REJECTED`)
  - `visibility` (`public | internal`)
  - `last_drive_modified_at`
  - `last_ingested_at`
  - `last_published_commit`
- `document_runs` (ingestion/conversion/publish attempts)
- `approval_events` (approve/reject actions)
- `sync_runs` (root scan jobs, outcomes)

## Key rule
- Source content remains in Google Docs.
- Backend stores only operational metadata + generated artifact references.

---

## 3) Drive Hierarchy Mapping Rules

Given root: `Documentation/`

- Level 1: `<Project>` → project
- Level 2: `<Version>` → version
- Level 3: `<Public|Internal>` → visibility scope
- Level 4+: `<Sections...>` → nested section tree (unbounded depth)
- Leaf Google Doc → page/document

## Navigation
- Section path and folder order define nav grouping.
- Slug path generated from full logical path (stable + collision-safe).

---

## 4) Ingestion Workflow

## Trigger modes
- Scheduled scan (polling)
- Manual “sync now”
- Optional Drive webhook trigger (future)

## Steps
1. Scan Drive recursively from `Documentation/`.
2. Detect Google Docs + folder lineage.
3. Resolve hierarchy to project/version/visibility/section path.
4. Export Doc as HTML via Drive API.
5. Parse metadata header/frontmatter from document top.
6. Validate required fields and policy constraints.
7. Convert HTML → Markdown.
8. Write markdown artifact to docs repo path.
9. Record metadata + sync result.

---

## 5) Markdown + MkDocs Generation

## Markdown path convention
- `docs/<project>/<version>/<visibility>/<sections>/<page>.md`

## Conversion requirements
- Preserve headings hierarchy
- Preserve tables
- Preserve images (download/rewrite to static asset path)
- Normalize links to internal docs routes

## MkDocs config generation
- Build `nav` from folder/section hierarchy + ordering policy.
- Generate visibility-aware nav (public build excludes internal nodes).
- Support multi-version navigation by project.

---

## 6) Review and Approval Workflow

## Status transitions
- `DRAFT` (ingested but not ready)
- `REVIEW` (candidate for preview)
- `APPROVED` (publish to production)
- `REJECTED` (blocked with reason)

## Branch strategy
- On `REVIEW`:
  - Commit generated docs to `docs-preview`
  - Trigger preview deployment
- On `APPROVED`:
  - Cherry-pick/rebuild to `main`
  - Trigger production deployment

## Reject behavior
- Keep source doc untouched in Drive.
- Mark metadata state rejected; include reviewer reason.

---

## 7) Approval Dashboard (Minimal)

## Pages
- `Approval Queue`
  - pending REVIEW docs, diff summary, preview links
- `Logs`
  - ingestion/publish history, errors
- `Settings`
  - Drive root id, branch config, deployment endpoints, role policies

## Auth
- Google OAuth login
- App roles stored in backend DB
- RBAC for approvers/publishers/admins

---

## 8) Reused Business Logic from Strapi (to be extracted next phase)

- slug normalization and consistency rules
- role precedence and permission checks
- publish validation safeguards
- hierarchy normalization rules
- asset/file handling guardrails

No Strapi runtime dependency in extracted modules.

---

## 9) Non-Goals in this phase

- No implementation code yet.
- No UI build yet.
- No Strapi deprecation toggle yet.

Phase 2 output is architecture definition only.
