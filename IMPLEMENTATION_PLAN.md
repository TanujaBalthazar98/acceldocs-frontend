# AccelDocs - Implementation Plan
**Single Unified React App**

## Architecture Decision: Combined App

**One React app at `app.yourcompany.com` with:**
- Public documentation viewing (no auth required)
- Admin dashboard (auth required)
- Smooth transition between modes

**Route Structure:**
```
/                  → Landing page with search
/docs/:slug        → Public documentation pages
/admin             → Admin dashboard (auth required)
/admin/docs        → Document management
/admin/approvals   → Approval queue
/admin/analytics   → Analytics
/admin/users       → User management
/admin/settings    → Settings
```

---

## Tech Stack

**Frontend:** React + TypeScript + Tailwind CSS (keep existing)
**Backend:** FastAPI (acceldocs-backend - already built)
**Auth:** Google OAuth → JWT tokens
**Database:** PostgreSQL (via FastAPI backend)
**Docs Rendering:** Markdown → React components
**Deployment:** Netlify (frontend) + Railway (backend)

---

## Phase 1: Authentication Foundation ✓ START HERE

### Goal
Get sign in/sign out working properly with Google OAuth

### Tasks
1. ✅ Backend OAuth endpoint (already exists in FastAPI)
2. ⏳ Create OAuth callback handler in React
3. ⏳ Build sign in page UI
4. ⏳ Implement JWT token storage
5. ⏳ Add protected route wrapper
6. ⏳ Create user profile dropdown
7. ⏳ Test full auth flow

### Files to Create/Modify
```
src/lib/auth.ts           → Auth utilities (login, logout, token)
src/components/AuthButton.tsx  → Sign in with Google button
src/components/UserMenu.tsx    → User profile dropdown
src/hooks/useAuth.ts      → Auth state management
src/pages/Login.tsx       → Sign in page
src/App.tsx               → Add route protection
```

### Implementation Details

**Backend Auth Flow (FastAPI):**
```python
# Already exists in acceldocs-backend/app/auth/routes.py
POST /auth/google        → Exchange Google code for JWT
GET  /auth/me            → Get current user
POST /auth/refresh       → Refresh JWT token
POST /auth/logout        → Invalidate token
```

**Frontend Auth Flow (React):**
```
User clicks "Sign in with Google"
  ↓
Redirect to Google OAuth
  ↓
Google redirects back with code
  ↓
Frontend sends code to backend /auth/google
  ↓
Backend validates with Google, creates user, returns JWT
  ↓
Frontend stores JWT in localStorage
  ↓
Frontend fetches user details
  ↓
Redirect to dashboard
```

**JWT Storage:**
```typescript
// Store token
localStorage.setItem('auth_token', jwt);

// Add to all API requests
headers: {
  'Authorization': `Bearer ${jwt}`
}

// Auto-refresh before expiry
if (tokenExpiresIn < 5 minutes) {
  refreshToken();
}
```

---

## Phase 2: Public Docs Experience

### Goal
Beautiful, fast documentation reading experience

### Tasks
1. ⏳ Create docs layout component
2. ⏳ Build sidebar navigation
3. ⏳ Implement search
4. ⏳ Render markdown content
5. ⏳ Add table of contents
6. ⏳ Previous/next navigation
7. ⏳ Mobile responsive

### Files to Create
```
src/layouts/DocsLayout.tsx     → Main docs layout
src/components/DocsSidebar.tsx → Navigation tree
src/components/DocsContent.tsx → Article content
src/components/DocsSearch.tsx  → Search bar
src/components/DocsTOC.tsx     → Table of contents
src/pages/DocsPage.tsx         → Docs route handler
```

### Page Structure
```tsx
<DocsLayout>
  <DocsSidebar navigation={nav} />
  <main>
    <DocsSearch />
    <DocsContent markdown={content} />
  </main>
  <DocsTOC headings={headings} />
</DocsLayout>
```

---

## Phase 3: Admin Dashboard

### Goal
Complete admin interface for managing docs

### Tasks
1. ⏳ Dashboard home page
2. ⏳ Documents list with filters
3. ⏳ Approval queue
4. ⏳ Document detail/edit
5. ⏳ Analytics dashboard
6. ⏳ User management
7. ⏳ Settings page

### Files to Create
```
src/layouts/AdminLayout.tsx        → Admin dashboard layout
src/pages/admin/Dashboard.tsx      → Admin home
src/pages/admin/Documents.tsx      → Document management
src/pages/admin/Approvals.tsx      → Approval queue
src/pages/admin/Analytics.tsx      → Analytics
src/pages/admin/Users.tsx          → User management
src/pages/admin/Settings.tsx       → Settings
src/components/admin/DocumentCard.tsx
src/components/admin/ApprovalCard.tsx
src/components/admin/StatsCard.tsx
```

### Admin Layout
```tsx
<AdminLayout>
  <Sidebar>
    <NavLink to="/admin">Dashboard</NavLink>
    <NavLink to="/admin/docs">Documents</NavLink>
    <NavLink to="/admin/approvals">Approvals (3)</NavLink>
    <NavLink to="/admin/analytics">Analytics</NavLink>
    <NavLink to="/admin/users">Users</NavLink>
  </Sidebar>
  <main>
    <Outlet /> {/* Route content */}
  </main>
</AdminLayout>
```

---

## Phase 4: Google Drive Integration

### Goal
Auto-sync docs from Google Drive

### Tasks
1. ⏳ Google Drive service account setup
2. ⏳ Folder scanner (recursive)
3. ⏳ Document metadata extraction
4. ⏳ HTML to Markdown conversion
5. ⏳ Sync scheduler (cron job)
6. ⏳ Webhook handler (real-time sync)
7. ⏳ Sync status UI

### Backend Components (FastAPI)
```python
# Already partially implemented
app/ingestion/drive.py       → Drive API client
app/conversion/html_to_md.py → HTML to Markdown
app/publishing/               → Publishing pipeline
```

### Sync Flow
```
1. Scan Google Drive folder
2. Find new/modified docs (by modifiedTime)
3. Export as HTML
4. Convert to Markdown
5. Extract metadata from frontmatter
6. Store in database
7. Update status (draft/review/approved)
```

---

## API Integration

### Backend Endpoints (Already Built)
```
Auth:
POST   /auth/google              → Google OAuth login
GET    /auth/me                  → Current user

Documents:
GET    /api/documents            → List docs (with filters)
GET    /api/documents/:id        → Get single doc
POST   /api/documents/:id/status → Update status
POST   /api/documents/bulk       → Bulk operations

Approvals:
GET    /api/approvals/pending    → Approval queue
POST   /api/approvals/action     → Approve/reject

Analytics:
GET    /api/analytics/summary    → Overall stats
GET    /api/analytics/documents/trending
GET    /api/analytics/users/activity

Users:
GET    /api/users                → List users
GET    /api/users/me             → Current user
POST   /api/users                → Create user
```

### Frontend API Client
```typescript
// src/lib/api.ts
const api = {
  auth: {
    login: (googleCode: string) => POST('/auth/google', { code: googleCode }),
    me: () => GET('/auth/me'),
    logout: () => POST('/auth/logout'),
  },

  documents: {
    list: (filters) => GET('/api/documents', filters),
    get: (id) => GET(`/api/documents/${id}`),
    updateStatus: (id, status) => POST(`/api/documents/${id}/status`, { status }),
  },

  approvals: {
    pending: () => GET('/api/approvals/pending'),
    approve: (docId, comment) => POST('/api/approvals/action', {
      document_id: docId, action: 'approve', comment
    }),
    reject: (docId, comment) => POST('/api/approvals/action', {
      document_id: docId, action: 'reject', comment
    }),
  },

  analytics: {
    summary: () => GET('/api/analytics/summary'),
    trending: () => GET('/api/analytics/documents/trending'),
  }
};
```

---

## State Management

**Use React Query (TanStack Query) for:**
- API data fetching
- Caching
- Automatic refetching
- Optimistic updates

```bash
npm install @tanstack/react-query
```

**Example:**
```typescript
// Fetch documents
const { data: documents, isLoading } = useQuery({
  queryKey: ['documents', filters],
  queryFn: () => api.documents.list(filters)
});

// Approve document
const approveMutation = useMutation({
  mutationFn: ({ id, comment }) => api.approvals.approve(id, comment),
  onSuccess: () => {
    queryClient.invalidateQueries(['approvals']);
    toast.success('Document approved!');
  }
});
```

---

## UI Components Library

**Keep existing shadcn/ui components:**
- Button, Card, Input, Table
- Dialog, Dropdown, Toast
- Badge, Tabs, Pagination

**Add new components:**
- Sidebar navigation
- Document card
- Search with autocomplete
- Status badge
- User avatar

---

## Deployment

### Frontend (React)
**Platform:** Netlify
```bash
# Build command
npm run build

# Environment variables
VITE_API_URL=https://api.yourcompany.com
VITE_GOOGLE_CLIENT_ID=your-client-id
```

### Backend (FastAPI)
**Platform:** Railway
```bash
# Already configured in DEPLOYMENT_GUIDE.md
DATABASE_URL=postgresql://...
SECRET_KEY=strong-random-key
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Development Workflow

### Local Development
```bash
# Terminal 1: Backend
cd acceldocs-backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd acceldocs
npm run dev
```

**Frontend `.env.development`:**
```
VITE_API_URL=http://localhost:8000
```

---

## Testing Strategy

### Frontend Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

### Backend Tests
```bash
# Already implemented (49 tests)
cd acceldocs-backend
pytest tests/test_e2e_*.py
```

---

## Timeline Estimate

**Phase 1: Auth** → 2-3 hours
**Phase 2: Docs** → 3-4 hours
**Phase 3: Admin** → 4-5 hours
**Phase 4: Drive Sync** → 3-4 hours

**Total:** ~15 hours for MVP
**Polish & Testing:** +5 hours
**Deployment:** +2 hours

**Complete working system:** ~22 hours (3 days)

---

## Success Metrics

**After Phase 1:**
✅ Users can sign in with Google
✅ JWT tokens working
✅ Protected routes functional

**After Phase 2:**
✅ Users can read documentation
✅ Search works
✅ Mobile responsive

**After Phase 3:**
✅ Admins can manage documents
✅ Approval workflow functional
✅ Analytics visible

**After Phase 4:**
✅ Google Docs auto-sync
✅ Publishing pipeline works
✅ Full end-to-end flow operational

---

## Next Steps

**RIGHT NOW - Start Phase 1:**

1. Set up Google OAuth credentials
2. Implement auth backend endpoints
3. Build sign in UI
4. Test auth flow
5. Deploy and verify

**I'm ready to start building. Which component should I create first?**

Options:
A. Auth utilities and sign in page
B. Backend OAuth endpoint setup
C. Complete Phase 1 in sequence
D. Show me working code for all of Phase 1

Choose and I'll start coding immediately!
