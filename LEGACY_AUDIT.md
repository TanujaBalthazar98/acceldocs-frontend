# Legacy Code Audit Report

**Date:** 2026-03-24
**Repositories:**
- Frontend: `/Users/tanujaignatius/Development/acceldocs`
- Backend: `/Users/tanujaignatius/Development/acceldocs-backend`

**Methodology:** Static analysis — tracing imports, cross-referencing router registrations, grepping for usages. No code was modified.

---

## Table of Contents

- [Frontend Findings](#frontend-findings)
  - [F1. Unused Library Utilities](#f1-unused-library-utilities)
  - [F2. Unused / Orphaned Components](#f2-unused--orphaned-components)
  - [F3. Test / Experimental Files in Production Tree](#f3-test--experimental-files-in-production-tree)
  - [F4. Dual Authentication System](#f4-dual-authentication-system)
  - [F5. Duplicate ProtectedRoute Implementations](#f5-duplicate-protectedroute-implementations)
  - [F6. Pages with No Navigation Entry Points](#f6-pages-with-no-navigation-entry-points)
  - [F7. Feature Flags](#f7-feature-flags)
  - [F8. API Layer Ambiguity (src/api/ vs src/lib/api/)](#f8-api-layer-ambiguity-srcapi-vs-srclibapi)
- [Backend Findings](#backend-findings)
  - [B1. Unregistered API Routers](#b1-unregistered-api-routers)
  - [B2. Config Variables Used Only by Unregistered Routers](#b2-config-variables-used-only-by-unregistered-routers)
  - [B3. Services with Very Limited Usage](#b3-services-with-very-limited-usage)
  - [B4. Potentially Legacy / Parallel Models](#b4-potentially-legacy--parallel-models)
  - [B5. Server-Rendered UI Routes (ui.py)](#b5-server-rendered-ui-routes-uipy)
  - [B6. app/lib/ Utility Usage](#b6-applib-utility-usage)
- [Cross-Cutting: Frontend ↔ Backend API Alignment](#cross-cutting-frontend--backend-api-alignment)
  - [C1. Backend Endpoints with No Detected Frontend Caller](#c1-backend-endpoints-with-no-detected-frontend-caller)
  - [C2. Frontend Calls That Route Through Function Dispatcher](#c2-frontend-calls-that-route-through-function-dispatcher)
- [Summary Table](#summary-table)

---

## Frontend Findings

### F1. Unused Library Utilities

#### F1-A: `src/lib/templates.ts`
- **Lines:** 553 lines
- **Exports:** `DOC_TEMPLATES` (array of 7 built-in doc templates), `getTemplateById()`, `TEMPLATE_CATEGORIES`
- **Why believed dead:** Grep across all of `src/` finds zero imports of `DOC_TEMPLATES`, `getTemplateById`, or `TEMPLATE_CATEGORIES`. The file is never referenced.
- **Related component:** `src/components/dashboard/TemplatePickerDialog.tsx` exists but calls `POST /api/functions/create-template-page` via the backend function dispatcher — it does not import from `templates.ts`.
- **Confidence: HIGH** — no imports found anywhere in the codebase.

#### F1-B: `src/lib/zipImporter.ts`
- **Lines:** 384 lines
- **Exports:** `parseZipFile(file: File)`, `parseFolderFiles(files: FileList)`, interfaces `ImportedFile`, `ImportConfig`, `ParsedImport`
- **Why believed dead:** Grep across all of `src/` finds zero imports of `zipImporter`, `parseZipFile`, or `parseFolderFiles`. The related component `ZipImportDialog.tsx` (see F2-A) does not import from this file.
- **Confidence: HIGH** — no imports found. The ZIP import feature appears to be deferred (see ZipImportDialog note in F2-A).

---

### F2. Unused / Orphaned Components

#### F2-A: `src/components/dashboard/ZipImportDialog.tsx`
- **Lines:** 28 lines
- **Why believed dead:** The component body renders only a placeholder message: `"Zip import is not available in Strapi mode yet."` It does not import `zipImporter.ts` or implement any real functionality. Grep across `src/` finds **zero imports** of `ZipImportDialog` — it is defined but never used in a parent component or route.
- **Confidence: HIGH** — both the component itself is a stub, and no parent imports it.

#### F2-B: `src/components/auth/ProtectedRoute.tsx` (legacy)
- **File:** `src/components/auth/ProtectedRoute.tsx` (~30 lines)
- **Why believed dead/legacy:** This is an older implementation that imports `useAuth` from `@/contexts/AuthContext` (the legacy Supabase-based auth context). A newer implementation exists at `src/components/ProtectedRoute.tsx` which uses `useAuthNew`. The root-level `App.tsx` imports the new `ProtectedRoute` from `@/components/ProtectedRoute`. The auth/ subfolder version redirects to `/auth` (not `/login`), which is not a defined route in App.tsx.
- **Confidence: MEDIUM** — the newer ProtectedRoute replaces this, but the legacy one could still be imported by a component not checked. Verify no component imports from `@/components/auth/ProtectedRoute`.

---

### F3. Test / Experimental Files in Production Tree

#### F3-A: `src/App-test.tsx`
- **Lines:** 72 lines
- **Why flagged:** Line 2 contains an explicit comment: *"Test App.tsx for new authentication system. TO USE: Rename this to App.tsx"*. This is a parallel App configuration for the in-progress migration to the new auth system. It imports `HomeSimple` (see F3-B) and wires routes using only the new `AuthProvider`.
- **Confidence: HIGH** — self-described as a test file. Not referenced by any build entry point (Vite uses `src/main.tsx` → `src/App.tsx`).

#### F3-B: `src/pages/HomeSimple.tsx`
- **Lines:** 79 lines
- **Why flagged:** A simplified landing page that uses the new `useAuthNew` hook and shows a "System Status" placeholder. It routes authenticated users to `/admin`. The production landing page is `src/pages/Index.tsx`, which is what `App.tsx` uses at the `/` route. `HomeSimple` is only referenced by `App-test.tsx` (see F3-A).
- **Confidence: HIGH** — not referenced from production `App.tsx`; only used by the test config file.

---

### F4. Dual Authentication System

This is the most significant technical debt in the frontend. Two complete auth systems run **simultaneously** in production, both wrapped in `src/App.tsx`:

```tsx
// App.tsx lines 44-45 (approximate)
<AuthProvider>        {/* Legacy: src/contexts/AuthContext.tsx */}
  <NewAuthProvider>   {/* New:    src/hooks/useAuthNew.tsx */}
```

#### Legacy Auth (`src/contexts/AuthContext.tsx`)
- **Lines:** ~535 lines
- **Based on:** Supabase client (`@/lib/api/auth`)
- **Manages:** `provider_token`, `session`, `googleAccessToken`, Drive access
- **Used by (confirmed):** `src/components/landing/Navbar.tsx`, `src/components/landing/Hero.tsx`, `src/components/landing/CTA.tsx`, `src/pages/Index.tsx`, `src/components/dashboard/ApprovalsPanel.tsx`, `src/components/dashboard/DriveReauthListener.tsx`, `src/components/dashboard/NotificationCenter.tsx`, `src/components/dashboard/DocAssistantChat.tsx`, `src/components/docs/PageFeedback.tsx`, `src/components/ProtectedRoute.tsx` (via ProtectedRoute in auth/ subfolder), `src/lib/authSession.ts`, and many more (~20+ files)

#### New Auth (`src/hooks/useAuthNew.tsx` + `src/lib/auth-new.ts`)
- **Lines:** ~98 lines (hook) + separate lib file
- **Based on:** JWT tokens with FastAPI backend (`GET /auth/me`)
- **Manages:** `user`, `loading`, `isAuthenticated`, JWT refresh
- **Used by (confirmed):** `src/App.tsx`, `src/components/ProtectedRoute.tsx` (root level), `src/pages/Dashboard.tsx`, `src/pages/admin/Dashboard.tsx`, `src/pages/LoginNew.tsx`, `src/components/UserMenuNew.tsx`

#### Supporting legacy: `src/lib/authSession.ts`
- **Lines:** ~109 lines
- **Purpose:** Session refresh logic with lock/cooldown mechanism for the legacy auth context
- **Imported by:** `src/contexts/AuthContext.tsx`, `src/hooks/useDriveRecovery.ts`, `src/hooks/usePermissions.ts`, `src/components/dashboard/PageView.tsx`
- **Status:** Active but tied to legacy system — will become dead once legacy auth is removed.
- **Confidence: MEDIUM** — currently active, but is legacy debt.

---

### F5. Duplicate ProtectedRoute Implementations

| File | Auth Source | Redirect Target | Role Checking |
|------|-------------|-----------------|---------------|
| `src/components/ProtectedRoute.tsx` | `useAuthNew` (new) | `/login` | Yes (`hasRole()`) |
| `src/components/auth/ProtectedRoute.tsx` | `AuthContext` (legacy) | `/auth` (invalid route) | No |

- The legacy version redirects to `/auth` which is not a route defined in `App.tsx` (the auth callback is at `/auth/callback`). This suggests the legacy ProtectedRoute may not be working correctly if it's still being invoked.
- **Confidence: MEDIUM** that `src/components/auth/ProtectedRoute.tsx` is dead/broken. Verify by checking which components import from `@/components/auth/ProtectedRoute` specifically.

---

### F6. Pages with No Navigation Entry Points

#### F6-A: `src/pages/ReportIssue.tsx`
- **Route:** `/support/report-issue`
- **Why flagged:** Not linked from `DashboardSidebar.tsx`, `Navbar.tsx`, or `Footer.tsx`. The `/support` page (which could link to it) is itself only mentioned in the Footer as a `/help` link. The route exists and the component renders, but no UI navigation element leads to it.
- **Confidence: MEDIUM** — orphaned from navigation, but accessible if someone knows the URL. Could be linked from email templates or external docs.

#### F6-B: `src/pages/AutomationConsole.tsx`
- **Route:** `/automation` (conditionally enabled by `VITE_USE_AUTOMATION_BACKEND` flag)
- **Why flagged:** Even when the feature flag enables the route, there are no navigation links in `DashboardSidebar.tsx` or any other nav component pointing to `/automation`. Users cannot discover this page through the UI.
- **Confidence: MEDIUM** — the route and component exist and work when the flag is set, but there's no navigation wiring. May be intentionally hidden/WIP.

---

### F7. Feature Flags

**File:** `src/lib/featureFlags.ts` (1 line)

```typescript
export const DRIVE_INTEGRATION_ENABLED = import.meta.env.VITE_DRIVE_INTEGRATION !== "false";
```

**Observations:**
- Only one flag is exported from this file.
- `DRIVE_INTEGRATION_ENABLED` is used in `App.tsx` (guards the `/automation` route) and `DriveStatusIndicator.tsx`.
- **Inconsistency:** The flag is named `DRIVE_INTEGRATION_ENABLED` but guards the `/automation` route in App.tsx, not Drive-specific UI. This naming is misleading.
- The file references `VITE_DRIVE_INTEGRATION` env var; the automation route is separately controlled by `VITE_USE_AUTOMATION_BACKEND` env var (checked directly inline in App.tsx, not via this flags file).
- **Confidence: LOW** — the flag is used, but the naming mismatch and inline env var checks suggest the flags abstraction is incomplete.

---

### F8. API Layer Ambiguity (`src/api/` vs `src/lib/api/`)

Two distinct API layers exist:

| Layer | Path | Purpose | Exports |
|-------|------|---------|---------|
| Business API | `src/api/` | High-level domain operations | `orgApi`, `sectionsApi`, `pagesApi`, `driveApi`, `agentApi`, `searchApi` |
| HTTP Client | `src/lib/api/` | Low-level HTTP utilities + auth | `apiFetch`, `auth`, `invokeFunction`, generic CRUD helpers |

These are **complementary, not duplicates** — the business API layer builds on the HTTP client. However:

- `src/api/client.ts` (in the business API folder) is a separate lightweight client with its own `apiFetch` implementation. This creates **two `apiFetch` implementations**:
  - `src/api/client.ts` — owns its own token management
  - `src/lib/api/client.ts` — the primary client with retry logic and org-id injection

- The business APIs in `src/api/` call their own client (`src/api/client.ts`), not the more robust `src/lib/api/client.ts`. Both inject auth tokens but via different mechanisms.

- **Confidence: MEDIUM** — the duplication is architectural. Not dead code per se, but the two clients could diverge in behavior (e.g., one may lack retry logic or org-id injection that the other has).

---

## Backend Findings

### B1. Unregistered API Routers

Four router files exist in `app/api/` but are **never imported or registered** in `app/main.py`:

#### B1-A: `app/api/settings.py`
- **Lines:** ~239 lines
- **Router variable:** `router` (line 20)
- **Endpoints defined:**
  - `GET /` — Get all application settings (line 68)
  - `PUT /` — Update settings (line 90)
  - `POST /test-drive` — Test Google Drive connection (line 133)
  - `POST /backup-db` — Database backup (line 172)
  - `POST /deploy-netlify` — Trigger Netlify deploy (line 203)
- **Dependencies:** `app/lib/env_manager.py`, `app/lib/rbac.py`, auth middleware
- **Why unregistered is notable:** This is a critical admin module. Without registration, all 5 endpoints are completely inaccessible. There is no other code path for database backup or Netlify deployment.
- **Confidence: HIGH** that these endpoints are dead (unreachable). Whether they were intentionally de-registered or accidentally omitted is unclear.

#### B1-B: `app/api/sync.py`
- **Lines:** 19 lines
- **Endpoint defined:** `POST /trigger` — Triggers `run_full_sync()` from `app/ingestion/sync.py` (line 12)
- **Why unregistered is notable:** The only programmatic way to trigger a full Drive re-sync would be via this endpoint or by calling `run_full_sync()` from another registered route. Neither appears to be exposed.
- **Confidence: HIGH** that the `/trigger` endpoint is unreachable in the current deployment.

#### B1-C: `app/api/publish.py`
- **Lines:** ~449 lines
- **Endpoints defined:**
  - `POST /publish/mkdocs` — Trigger MkDocs site build and publish
  - `GET /publish/debug` — Debug publishing state
- **Dependencies:** `app/publishing/mkdocs_gen.py`, `app/publishing/git_publisher.py`
- **Why unregistered is notable:** The entire publishing-to-git-repo pipeline is inaccessible. The `app/publishing/` module (mkdocs_gen.py, git_publisher.py) is only reachable via this unregistered router.
- **Confidence: HIGH** that these endpoints are unreachable.

#### B1-D: `app/api/github_publish.py`
- **Lines:** ~414 lines
- **Endpoints defined (approximate lines):**
  - GitHub connection/credentials management (line 79)
  - GitHub settings retrieval (line 146)
  - GitHub settings update (line 180)
  - GitHub publish trigger (line 317)
  - GitHub publish status (line 385)
- **Dependencies:** `app/config.py` settings for `NETLIFY_SITE_ID`, `NETLIFY_AUTH_TOKEN`, `DOCS_REPO_PATH`, `DOCS_REPO_URL`
- **Confidence: HIGH** that these endpoints are unreachable. The GitHub publishing feature is entirely inaccessible.

---

### B2. Config Variables Used Only by Unregistered Routers

The following config variables in `app/config.py` are defined but their primary (or only) consumers are the unregistered routers from B1:

| Variable | Config Line | Consumers | Consumer Status |
|----------|-------------|-----------|-----------------|
| `NETLIFY_SITE_ID` | ~56 | `app/api/settings.py`, `app/api/github_publish.py` | Both unregistered |
| `NETLIFY_AUTH_TOKEN` | ~57 | `app/api/settings.py`, `app/api/github_publish.py` | Both unregistered |
| `DOCS_REPO_URL` | ~34 | `app/api/settings.py`, `app/api/github_publish.py` | Both unregistered |
| `DOCS_REPO_PATH` | ~33 | `app/api/documents.py` (registered), `app/api/settings.py`, `app/api/github_publish.py` | Partially active |
| `GOOGLE_OAUTH_TOKEN_FILE` | ~26 | Ingestion flow (not an API endpoint) | Low-level use |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | ~29 | `app/api/settings.py` (unregistered), ingestion | Partially active |

- `NETLIFY_SITE_ID` and `NETLIFY_AUTH_TOKEN` have **no active code paths** — both files that use them are unregistered.
- `DOCS_REPO_URL` is in the same situation.
- **Confidence: HIGH** for NETLIFY_* and DOCS_REPO_URL being effectively unused at runtime. **MEDIUM** for DOCS_REPO_PATH (it has one registered consumer in documents.py).

---

### B3. Services with Very Limited Usage

#### B3-A: `app/services/visibility.py`
- **Imports found:** 1 — only `app/api/public.py`
- **Purpose:** Permission/visibility checks for public documentation access
- **Why flagged:** Only one consumer. The service handles visibility logic but the bulk of RBAC is in `app/lib/rbac.py` (used broadly). May represent a parallel permission system.
- **Confidence: LOW** — it is used, just narrowly. Could be intentional (public.py has unique visibility needs).

#### B3-B: `app/services/email.py`
- **Imports found:** 1 — only `app/api/org.py` (for invitation emails)
- **Purpose:** Email sending via Resend API
- **Why flagged:** Only one consumer despite being a general-purpose service. If invitations are the only email use case, the service is correct but narrow.
- **Confidence: LOW** — actively used, just single-purpose currently.

#### B3-C: `app/services/templates.py`
- **Imports found:** 1 — only `app/api/agent_chat.py`
- **Purpose:** Jinja2 template rendering (likely for agent prompt templates)
- **Why flagged:** Used only for AI agent prompts. Not a shared template system.
- **Confidence: LOW** — active, narrow usage.

---

### B4. Potentially Legacy / Parallel Models

The codebase shows evidence of an architectural migration from a "Document/Section" model to a "Page/Topic" model. Both generations of models coexist in `app/models.py`:

#### B4-A: `Topic` model
- **Definition:** `app/models.py` (line ~162)
- **Why flagged:** The `Topic` model appears to be the predecessor to `Section`. The API layer uses `Section` heavily (149 occurrences across app/api/), while `Topic` has minimal references. The sections API (`app/api/sections.py`) is actively used by the frontend; there is no corresponding "topics API" registered.
- **Confidence: MEDIUM** — Topic may still be used in some migration or legacy path. Verify by searching for `Topic` model queries specifically.

#### B4-B: `DocumentCache` model
- **Definition:** `app/models.py` (line ~247)
- **Usage:** ~4 occurrences across the codebase
- **Why flagged:** Very low usage for what is described as an encrypted cache for document content. The `Page` model (and its content storage) may have superseded this caching mechanism.
- **Confidence: MEDIUM** — low usage, but could be a deliberate optimization layer that's rarely triggered.

#### B4-C: `Document` model (parallel to `Page`)
- **Definition:** `app/models.py` (line ~305)
- **Usage:** ~136 occurrences — actively used
- **Why flagged for awareness (not dead):** The `Document` model coexists with `Page` (line ~474). Based on naming and the migration history (the "clean architecture" migration `e9a1b2c3d4e5`), `Page` is the newer model. The `Approval` model has an `entity_type` field supporting both "document" and "page" entity types (line ~364), confirming both are active.
- **Confidence: LOW** — Document is actively used. Flagged only to note the parallel model situation for eventual consolidation.

---

### B5. Server-Rendered UI Routes (`app/api/ui.py`)

`app/api/ui.py` is registered in `main.py` (line 167) but serves **server-rendered HTML pages** (not JSON API responses), unlike every other registered router:

- `GET /` — Dashboard HTML
- `GET /documents` — Documents HTML
- `GET /projects` — Projects HTML
- `GET /approvals` — Approvals HTML
- `GET /sync` — Sync HTML
- `GET /users` — Users HTML
- `GET /settings` — Settings HTML
- `GET /onboarding` — Onboarding HTML
- `GET /drive` — Drive HTML
- `GET /analytics` — Analytics HTML
- `GET /documents/{doc_id}/preview` — Document preview HTML

**Why flagged:** These routes appear to be a legacy server-rendered admin panel that predates the React frontend. The frontend now handles all of these views via React routes under `/dashboard/*`. Whether these HTML endpoints are still actively visited by any user or system is unclear.

- **Confidence: MEDIUM** — the routes are registered and technically reachable, but they may render stale UI. They conflict with the React SPA at `/dashboard/*` conceptually.

---

### B6. `app/lib/` Utility Usage

| Utility | Primary Consumers | Status |
|---------|-------------------|--------|
| `rbac.py` | Multiple API files, `app/api/settings.py` | ACTIVE (note: settings.py is unregistered) |
| `env_manager.py` | `app/api/settings.py` (unregistered), `app/ingestion/sync.py` | PARTIALLY ACTIVE — main consumer is unregistered |
| `html_normalize.py` | `app/lib/markdown_import.py`, `app/conversion/html_to_md.py` | ACTIVE (internal pipeline) |
| `markdown.py` | `app/lib/markdown_import.py`, `app/services/agent.py` | ACTIVE |
| `markdown_import.py` | Various | ACTIVE |
| `sanitize.py` | `app/conversion/html_to_md.py` | ACTIVE |
| `slugify.py` | Multiple API files | ACTIVE |

**B6-A: `app/lib/env_manager.py`**
- **Primary consumer:** `app/api/settings.py` — which is unregistered (B1-A)
- **Secondary consumer:** `app/ingestion/sync.py`
- **Why flagged:** The primary use case for env_manager (runtime env var mutation via settings API) is inaccessible. The ingestion/sync.py usage may be minimal.
- **Confidence: MEDIUM** — functionally used by sync, but the main intended consumer is a dead router.

---

## Cross-Cutting: Frontend ↔ Backend API Alignment

### C1. Backend Endpoints with No Detected Frontend Caller

The following registered backend endpoints were not found in any frontend API call (checked in `src/api/` and `src/lib/api/`):

| Backend Endpoint | File | Notes |
|-----------------|------|-------|
| `GET /api/analytics/*` | `app/api/analytics.py` | Analytics endpoints exist; no matching calls found in frontend API files. May be called directly from a dashboard component not in the checked files. |
| `GET/POST /api/approvals/*` | `app/api/approvals.py` | REST endpoints exist; frontend uses function dispatcher (`/api/functions/approvals-*`) instead. Both paths may work. |
| `GET/POST /api/documents/*` | `app/api/documents.py` | Legacy document API. Frontend uses `pages` API. Unclear if documents endpoints are still called anywhere. |
| `GET/POST /api/projects/*` | `app/api/projects.py` | Legacy project API. Frontend sections/pages API may have replaced this. |
| `GET /api/org/invitations` | `app/api/org.py` | Invitation listing; not found in `src/api/org.ts`. May be called by a component directly. |
| `POST /api/org/invitations` | `app/api/org.py` | Invitation creation; not found in frontend API files. |
| `POST /api/org/invitations/accept` | `app/api/org.py` | Invitation accept; not found in frontend API files. |
| `GET /api/users/*` | `app/api/users.py` | User management endpoints; not found in frontend API files. |
| `GET /api/external-access/*` | `app/api/external_access.py` | External sharing grants; not found in frontend API files checked. |

**Important caveat:** The frontend analysis only checked files in `src/api/` and `src/lib/api/`. Some dashboard components may call endpoints directly (e.g., via `useDashboardActions.ts` or `useDashboardData.ts`) without going through the API layer files. Verify before treating these as confirmed dead.

### C2. Frontend Calls That Route Through Function Dispatcher

The following frontend operations use `invokeFunction("name", ...)` → `POST /api/functions/{name}` and are dispatched to services inside `app/api/functions.py`:

| Frontend Function Name | Backend Service Handler | Status |
|-----------------------|------------------------|--------|
| `jira-status` | `app/services/agent.py` | Active |
| `jira-connect` | `app/services/agent.py` | Active |
| `jira-disconnect` | `app/services/agent.py` | Active |
| `jira-get-ticket` | `app/services/agent.py` | Active |
| `agent-generate-doc` | `app/services/agent.py` | Active |
| `create-template-page` | `app/api/pages.py` or services | Active |
| `ensure-workspace` | `app/services/workspace.py` | Active |
| `get-organization` | `app/services/workspace.py` | Active |
| `update-organization` | `app/services/workspace.py` | Active |
| `search-organizations` | `app/services/workspace.py` | Active |

Note: `app/services/workspace.py` appeared to have no direct API consumers but is actively used via the function dispatcher — it is **not dead code**.

---

## Summary Table

### Frontend

| ID | Finding | File(s) | Confidence | Type |
|----|---------|---------|------------|------|
| F1-A | `templates.ts` — exported but never imported | `src/lib/templates.ts` | **HIGH** | Unused utility (553 lines) |
| F1-B | `zipImporter.ts` — exported but never imported | `src/lib/zipImporter.ts` | **HIGH** | Unused utility (384 lines) |
| F2-A | `ZipImportDialog.tsx` — stub component, never imported | `src/components/dashboard/ZipImportDialog.tsx` | **HIGH** | Orphaned stub component |
| F2-B | `ProtectedRoute.tsx` (auth/) — legacy, redirects to invalid route | `src/components/auth/ProtectedRoute.tsx` | **MEDIUM** | Legacy duplicate |
| F3-A | `App-test.tsx` — explicitly marked as test file | `src/App-test.tsx` | **HIGH** | Test file in src/ |
| F3-B | `HomeSimple.tsx` — test page, only used by App-test.tsx | `src/pages/HomeSimple.tsx` | **HIGH** | Test page in src/ |
| F4 | Dual auth systems running simultaneously | `src/contexts/AuthContext.tsx` + `src/hooks/useAuthNew.tsx` | **MEDIUM** | Tech debt / migration incomplete |
| F4-b | `authSession.ts` — tied to legacy auth | `src/lib/authSession.ts` | **LOW** | Will become dead when legacy auth removed |
| F5 | Two ProtectedRoute implementations | See F2-B | **MEDIUM** | Duplicate |
| F6-A | `ReportIssue.tsx` — routed but no nav links | `src/pages/ReportIssue.tsx` | **MEDIUM** | Navigation orphan |
| F6-B | `AutomationConsole.tsx` — feature-flagged, no nav | `src/pages/AutomationConsole.tsx` | **MEDIUM** | Navigation orphan / WIP |
| F7 | `DRIVE_INTEGRATION_ENABLED` flag guards wrong route | `src/lib/featureFlags.ts` | **LOW** | Misleading flag name |
| F8 | Two separate `apiFetch` implementations | `src/api/client.ts` vs `src/lib/api/client.ts` | **MEDIUM** | Potential behavioral divergence |

### Backend

| ID | Finding | File(s) | Confidence | Type |
|----|---------|---------|------------|------|
| B1-A | `settings.py` router — unregistered in main.py | `app/api/settings.py` | **HIGH** | Dead router (5 endpoints unreachable) |
| B1-B | `sync.py` router — unregistered in main.py | `app/api/sync.py` | **HIGH** | Dead router (1 endpoint unreachable) |
| B1-C | `publish.py` router — unregistered in main.py | `app/api/publish.py` | **HIGH** | Dead router (MkDocs pipeline unreachable) |
| B1-D | `github_publish.py` router — unregistered in main.py | `app/api/github_publish.py` | **HIGH** | Dead router (GitHub publishing unreachable) |
| B2 | NETLIFY_*, DOCS_REPO_URL config vars — only used by dead routers | `app/config.py` lines ~34, ~56-57 | **HIGH** | Config vars with no active consumers |
| B3-A | `visibility.py` — single consumer | `app/services/visibility.py` | **LOW** | Narrow service |
| B3-B | `email.py` — single consumer | `app/services/email.py` | **LOW** | Narrow service |
| B3-C | `templates.py` — single consumer | `app/services/templates.py` | **LOW** | Narrow service |
| B4-A | `Topic` model — minimal usage, likely superseded by Section | `app/models.py` | **MEDIUM** | Potentially legacy model |
| B4-B | `DocumentCache` model — ~4 usages | `app/models.py` | **MEDIUM** | Potentially superseded |
| B4-C | `Document` model parallel to `Page` | `app/models.py` | **LOW** (note only) | Dual-model architecture |
| B5 | `ui.py` server-rendered routes — legacy admin panel | `app/api/ui.py` | **MEDIUM** | Legacy server-rendered UI |
| B6-A | `env_manager.py` — primary consumer is dead router | `app/lib/env_manager.py` | **MEDIUM** | Utility whose main use case is inaccessible |

### Cross-Cutting

| ID | Finding | Confidence | Type |
|----|---------|------------|------|
| C1 | `app/api/analytics.py` endpoints — no frontend callers detected | **MEDIUM** | Potential dead API (verify in dashboard components) |
| C1 | `app/api/documents.py` endpoints — legacy, frontend uses pages API | **MEDIUM** | Potentially legacy API |
| C1 | `app/api/projects.py` endpoints — legacy, frontend uses sections | **MEDIUM** | Potentially legacy API |
| C1 | Invitation endpoints in org.py — not in frontend API files | **MEDIUM** | Verify in component-level calls |

---

*This audit is a static analysis snapshot. Dynamic dispatch patterns (function dispatcher, string-based imports, external scripts) may reveal additional consumers not captured here. All HIGH-confidence findings were verified by grepping the entire `src/` directory for imports. MEDIUM and LOW findings require human verification before any action is taken.*
