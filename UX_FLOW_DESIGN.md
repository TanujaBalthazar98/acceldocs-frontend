# AccelDocs - UX Flow Design
**Documentation Platform UI/UX Specification**

---

## Design Philosophy

**Core Principles:**
1. **Readers First** - 80% of users just want to read docs fast
2. **Search-Driven** - Make finding information effortless
3. **Clear Hierarchy** - Easy to navigate, hard to get lost
4. **Minimal Friction** - Authoring in Google Docs, publishing is automatic
5. **Trust & Quality** - Review workflow ensures accuracy

---

## Two Separate Applications

### App 1: Public Documentation Site
**URL:** `docs.yourcompany.com`
**Purpose:** Fast, beautiful docs for readers
**Tech:** Static site (MkDocs Material) or React SPA
**Auth:** None required (unless viewing internal docs)

### App 2: Admin Dashboard
**URL:** `admin.yourcompany.com` or `app.yourcompany.com`
**Purpose:** Manage documentation, approve changes
**Tech:** React SPA (your existing frontend)
**Auth:** Google OAuth required

---

## User Flows

### Flow 1: Reader Viewing Documentation (Public Site)

```
┌─────────────────────────────────────────────────┐
│ User lands on docs.yourcompany.com              │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Homepage with:                                  │
│ • Search bar (prominent)                        │
│ • Project selector (if multiple projects)       │
│ • Quick links to popular docs                   │
│ • Version selector (v4.10, v4.9, etc.)         │
└─────────────────────────────────────────────────┘
                    ↓
         User can either:

    [Search]          [Browse]         [Direct Link]
        ↓                ↓                  ↓
  ┌──────────┐    ┌──────────┐      ┌──────────┐
  │ Search   │    │ Sidebar  │      │ Article  │
  │ Results  │    │ Nav      │      │ Page     │
  └──────────┘    └──────────┘      └──────────┘
        ↓                ↓                  ↓
        └────────────────┴──────────────────┘
                         ↓
              ┌────────────────────┐
              │ Article Page       │
              │                    │
              │ • Breadcrumbs      │
              │ • Table of Contents│
              │ • Content          │
              │ • Next/Prev links  │
              │ • Feedback widget  │
              └────────────────────┘
```

**Article Page Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ Header: [Logo] [Search] [Version: v4.10 ▼] [Sign In]    │
├────────┬──────────────────────────────────┬──────────────┤
│        │                                  │              │
│ Sidebar│  Main Content Area               │ On This Page │
│ Nav    │                                  │              │
│        │  Breadcrumb: Home > API > Auth   │ # Contents   │
│ • Docs │                                  │ - Overview   │
│ • API  │  # Authentication                │ - Setup      │
│   - Auth                                  │ - Examples   │
│   - Users  # Overview...                  │              │
│ • Guides   Lorem ipsum dolor sit amet...  │              │
│                                           │              │
│        │  ## Setup                        │              │
│        │  1. Install the package          │              │
│        │  2. Configure...                 │              │
│        │                                  │              │
│        │  ```python                       │              │
│        │  import auth                     │              │
│        │  ```                             │              │
│        │                                  │              │
│        │  [◄ Previous] [Next ►]           │              │
│        │                                  │              │
│        │  Was this helpful? 👍 👎         │              │
└────────┴──────────────────────────────────┴──────────────┘
```

---

### Flow 2: Writer Creating Documentation (Admin Dashboard)

```
┌─────────────────────────────────────────────────┐
│ 1. Writer creates/edits Google Doc              │
│    - Uses template with metadata header         │
│    - Writes content in familiar Google Docs UI  │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Backend auto-syncs from Google Drive         │
│    - Runs every 15 minutes or on webhook        │
│    - Detects new/changed docs                   │
│    - Extracts metadata from doc header          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Document appears in Admin Dashboard          │
│    - Status: DRAFT (not visible to public)      │
│    - Writer can preview changes                 │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Writer marks as "Ready for Review"           │
│    - Status changes to REVIEW                   │
│    - Appears in approval queue                  │
│    - Preview site updated                       │
└─────────────────────────────────────────────────┘
```

**Admin Dashboard - Documents Page:**
```
┌──────────────────────────────────────────────────────────┐
│ AccelDocs Admin                    [👤 tanuja@...] [⚙️]  │
├──────────────────────────────────────────────────────────┤
│ ☰ Sidebar                    Main Area                   │
│                                                           │
│ 📄 Documents        Documents                            │
│ ✓ Approvals (3)     ┌──────────────────────────────────┐│
│ 📊 Analytics        │ [Search] [Filter ▼] [+ New Doc] ││
│ 🔄 Sync             └──────────────────────────────────┘│
│ 👥 Users            ┌──────────────────────────────────┐│
│ ⚙️  Settings        │ Title         Status    Updated  ││
│                     ├──────────────────────────────────┤│
│                     │ □ Getting Started                ││
│                     │   DRAFT       2h ago      [Edit] ││
│                     │ □ API Reference                  ││
│                     │   REVIEW      1d ago    [Review] ││
│                     │ □ Installation Guide             ││
│                     │   APPROVED    3d ago      [View] ││
│                     └──────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

---

### Flow 3: Reviewer Approving Documentation

```
┌─────────────────────────────────────────────────┐
│ 1. Reviewer logs into Admin Dashboard           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Sees notification badge: Approvals (3)       │
│    - Clicks to view approval queue              │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Approval Queue Page                          │
│    - List of docs pending review                │
│    - Preview link for each doc                  │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Reviewer clicks "Preview" for a doc          │
│    - Opens preview site (preview.docs.com)      │
│    - Sees rendered doc as readers will          │
└─────────────────────────────────────────────────┘
                    ↓
         Reviewer decides:

    [Approve]           [Reject]
        ↓                  ↓
┌───────────────┐    ┌──────────────┐
│ Published to  │    │ Back to      │
│ production    │    │ DRAFT        │
│ Status:       │    │ Writer       │
│ APPROVED      │    │ notified     │
└───────────────┘    └──────────────┘
```

**Approval Queue Page:**
```
┌──────────────────────────────────────────────────────────┐
│ Approval Queue (3 pending)                               │
├──────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐   │
│ │ 📄 Getting Started Guide                           │   │
│ │ Project: AccelDocs | Version: v4.10               │   │
│ │ Author: John Doe | Submitted: 2h ago              │   │
│ │                                                    │   │
│ │ [Preview on Preview Site] [View Source Doc]       │   │
│ │                                                    │   │
│ │ Comment (optional):                                │   │
│ │ [_____________________________________]            │   │
│ │                                                    │   │
│ │ [✓ Approve] [✗ Reject] [← Back]                  │   │
│ └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

### Flow 4: Admin Managing the System

```
Admin Dashboard Sections:

1. Documents
   └─ View all docs, filter by status/project/version

2. Approvals
   └─ Review queue, approve/reject workflow

3. Analytics
   └─ Page views, trending docs, user activity

4. Sync Status
   └─ Google Drive sync logs, manual sync trigger

5. Users
   └─ Manage team members, assign roles

6. Settings
   └─ Projects, versions, Google OAuth config
```

---

## Key Pages & Components

### Public Docs Site

#### 1. Homepage
```
Purpose: Entry point, help users find what they need
Components:
  • Hero with tagline
  • Prominent search bar
  • Project selector (if multiple products)
  • Quick links grid (Getting Started, API Reference, etc.)
  • Recent updates
```

#### 2. Article Page
```
Purpose: Display documentation content
Components:
  • Sticky header with search
  • Left sidebar: navigation tree
  • Main content: rendered markdown
  • Right sidebar: table of contents (on this page)
  • Breadcrumbs
  • Previous/Next navigation
  • Feedback widget
  • Last updated timestamp
```

#### 3. Search Results
```
Purpose: Help users find specific information
Components:
  • Search input (auto-suggest)
  • Filters (project, version, section)
  • Results with context snippets
  • Keyboard shortcuts (cmd+K to search)
```

---

### Admin Dashboard

#### 1. Dashboard Home
```
Purpose: Overview of system status
Components:
  • Recent activity feed
  • Approval queue summary (X pending)
  • Sync status indicator
  • Quick stats (total docs, views this week)
  • Quick actions (Sync Now, New Doc)
```

#### 2. Documents List
```
Purpose: Manage all documentation
Components:
  • Search/filter toolbar
  • Bulk actions (approve, reject, delete)
  • Table with: title, status, project, version, last updated
  • Status badges (DRAFT, REVIEW, APPROVED)
  • Actions menu (Edit, Preview, Delete)
```

#### 3. Document Detail / Edit
```
Purpose: View/edit single document metadata
Components:
  • Title, slug, description
  • Project, version, section dropdowns
  • Status selector
  • Visibility (public/internal) toggle
  • Tags input
  • Preview button
  • Google Doc link
  • Sync history
```

#### 4. Approval Queue
```
Purpose: Review and approve pending docs
Components:
  • List of docs pending review
  • Preview button (opens preview site)
  • Approve/Reject buttons
  • Comment field
  • Reviewer history
```

#### 5. Analytics Dashboard
```
Purpose: Track documentation usage
Components:
  • Summary cards (total views, trending)
  • Charts (views over time)
  • Top documents table
  • User activity table
  • Search queries report
```

---

## Navigation Structure

### Public Docs Site Sidebar
```
📚 Documentation
   📖 Getting Started
      • Overview
      • Installation
      • Quick Start
   ⚙️  Configuration
      • Environment Setup
      • API Keys
   🔌 API Reference
      • Authentication
      • Users
      • Documents
   📘 Guides
      • Best Practices
      • Troubleshooting

🔄 Release Notes
   • v4.10.0 (latest)
   • v4.9.0
   • v4.8.0
```

### Admin Dashboard Sidebar
```
📄 Documents        → List all docs
✓ Approvals (3)    → Review queue
📊 Analytics       → Usage stats
🔄 Sync Status     → Drive sync logs
👥 Users           → Team management
⚙️  Settings        → System config
```

---

## Authentication Flow

### Sign In Page
```
┌──────────────────────────────────────┐
│                                      │
│        AccelDocs Admin               │
│                                      │
│  [🔐 Sign in with Google]            │
│                                      │
│  Sign in to manage documentation     │
│                                      │
└──────────────────────────────────────┘
```

**Flow:**
1. User clicks "Sign in with Google"
2. Google OAuth popup/redirect
3. Backend validates Google token
4. Backend issues JWT token
5. Frontend stores JWT in localStorage
6. User redirected to dashboard

**Sign Out:**
- User avatar dropdown → Sign Out
- Clear localStorage JWT
- Redirect to sign in page

---

## State Management

### Authentication States
```
LOADING       → Checking if user has valid session
UNAUTHENTICATED → No session, show sign in
AUTHENTICATED   → Valid session, show dashboard
ERROR         → Auth error, show error message
```

### Document States
```
DRAFT     → Being written, not visible to public
REVIEW    → Ready for approval, visible on preview site
APPROVED  → Published to production site
REJECTED  → Sent back to draft, needs changes
```

---

## Responsive Design

### Mobile Considerations
```
• Collapsible sidebar (hamburger menu)
• Search-first on mobile
• Simplified navigation
• Readable font sizes (16px+ body text)
• Touch-friendly tap targets (44px min)
```

---

## Key UX Patterns

### 1. Search-Driven Discovery
- Search bar always visible
- Keyboard shortcut (Cmd+K / Ctrl+K)
- Auto-suggest as you type
- Show recent searches

### 2. Progressive Disclosure
- Don't overwhelm with options
- Show most common actions first
- Advanced features in dropdowns/modals

### 3. Clear Status Indicators
- Color-coded badges (green=approved, yellow=review, gray=draft)
- Icons for quick recognition
- Timestamps for recency

### 4. Feedback & Confirmation
- Toast notifications for actions
- Confirmation dialogs for destructive actions
- Loading states for async operations
- Success/error messages

---

## Accessibility

- Semantic HTML (nav, main, article)
- ARIA labels for screen readers
- Keyboard navigation support
- High contrast mode
- Skip to content link
- Alt text for images

---

## Performance

- Static site generation for public docs (fast)
- Code splitting for admin dashboard
- Lazy load images
- Search index cached client-side
- Optimistic UI updates

---

## Next Steps

To implement this design:

1. **Public Docs Site**
   - Use MkDocs Material (fastest path)
   - Or build React docs site

2. **Admin Dashboard**
   - Your existing React app
   - Add authentication UI
   - Add document management pages

3. **Backend**
   - Already built (FastAPI)
   - Add Google Drive sync
   - Add publishing pipeline

Would you like me to:
1. Create wireframes for specific pages?
2. Build the admin dashboard UI?
3. Set up the public docs site?
4. All of the above?
