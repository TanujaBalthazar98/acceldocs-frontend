# Help

Welcome to Docspeare — the docs platform for teams who live in Google
Drive. This guide walks you from signup to your first published page.

If anything here is unclear, email [hello@docspeare.com](mailto:hello@docspeare.com)
and we'll fix it.

---

## What Docspeare does

Docspeare turns a Google Drive folder into a production documentation
site. Your team keeps writing in Google Docs; Docspeare handles:

- **Continuous sync** from Drive into a structured knowledge base.
- **Structured review and approval** — draft → in review → approved.
- **Role-based access control** — admins, reviewers, writers, viewers.
- **Public and private portals** on your own domain.
- **Ask AI about any page** (beta) — bring your own key and chat with
  the page you're reading. A fuller drafting and restructuring agent is
  in active development.

No migration. No duplicate sources of truth. No learning a new editor.

---

## Quickstart

1. **Sign up.** Go to `docspeare.com` and click *Get started*. Sign in
   with the Google account whose Drive you want to connect.
2. **Create (or join) a workspace.** Workspaces are tenants — one per
   company, team, or product. You become the *owner* of any workspace
   you create.
3. **Connect your Drive.** Paste the Drive folder ID that will serve as
   the root of your docs. Docspeare will mirror its structure.
4. **Invite your team.** From *Settings → Team*, add teammates by
   email and assign a role (admin, reviewer, writer, viewer). Share
   the workspace link with them so they can sign in with Google.
5. **Write in Google Docs.** Open the connected folder in Drive, create
   a Google Doc, and start writing. Docspeare picks it up on the next sync.
6. **Review and publish.** Move the doc through the approval flow, then
   hit *Publish* — it appears in your portal within seconds.

---

## Drive folder conventions

Docspeare reads the shape of your Drive folder literally. A folder
becomes a *project* or *topic*; a Google Doc becomes a *page*.

```
Docspeare Docs/                  ← workspace root
├── Getting started/             ← project
│   ├── Installation             ← page
│   └── First project            ← page
├── API/                         ← project
│   └── Reference/               ← nested topic
│       ├── Authentication       ← page
│       └── Webhooks             ← page
└── Release notes/               ← project
    ├── v1.0                     ← page
    └── v1.1                     ← page
```

Tips:

- **Rename freely.** Drive folder names become section titles verbatim.
- **Hide a doc** by moving it out of the connected folder or giving it
  a name that starts with `_`.
- **Order pages** by prefixing titles with a number (`01 Intro`,
  `02 Setup`). Docspeare strips the prefix when rendering.

---

## Writing docs

Write in Google Docs exactly as you normally would. On sync, Docspeare
converts:

| Google Docs element                 | Rendered as                       |
| ----------------------------------- | --------------------------------- |
| Heading 1 / 2 / 3                   | `<h1>` / `<h2>` / `<h3>`          |
| Bulleted & numbered lists           | Lists                             |
| **Bold**, *italic*, ~~strikethrough~~ | Same                              |
| Inline code (`Courier New`)         | Inline `<code>`                   |
| Block quote                         | Blockquote                        |
| Tables                              | Responsive HTML tables            |
| Embedded images                     | Optimized & hosted from the portal |
| Links                               | Same                              |

**Useful conventions**

- Use H1 once at the top of the page — that becomes the page title.
- Use H2/H3 for structure. Docspeare auto-builds a right-side table of
  contents from them.
- Paste code into a block formatted with `Courier New` and Docspeare
  will render it as a code block with syntax highlighting.

---

## Review and approval

Every page has a status: **draft**, **in review**, or **approved**.

1. A writer finishes a page and clicks *Submit for review*.
2. Reviewers get a notification with a direct link. They can comment in
   the original Google Doc — comments round-trip back into Docspeare's
   audit history.
3. A reviewer (or admin) clicks *Approve*. The page now shows as
   approved in your workspace.
4. An admin publishes — approved pages become visible on your portal.

Each decision is logged: who approved, when, and on what revision.
Open *Activity* on any page to see the full trail.

---

## Publishing

Publishing is a deliberate action, not automatic. You choose:

- **Public portal** — served on your root domain (e.g. `docs.acme.com`)
  and indexed by search engines.
- **Private portal** — served on a separate subdomain and gated by SSO.
  Visible only to people with a workspace role.

You can unpublish at any time. Unpublishing removes the page from the
portal but keeps the draft + approval history intact.

---

## Custom domains

1. Go to *Settings → Domain*.
2. Enter the domain you want (e.g. `docs.acme.com`).
3. Add the DNS records Docspeare shows you (a `CNAME`, one `TXT` for
   verification).
4. Click *Verify*. Once DNS propagates, the portal is live on your
   domain with auto-provisioned HTTPS.

---

## AI features

> 🧪 **Beta — we're still building this.** The pieces below are the
> ones that work today. A broader agent that drafts, restructures, and
> cleans up docs across a whole workspace is coming soon.

Docspeare's AI runs in *bring-your-own-key* mode. Set your provider and
key under *Settings → AI* and pick from:

- **Anthropic** (Claude)
- **Google** (Gemini)
- **Groq**
- **OpenAI-compatible** — any endpoint that speaks the OpenAI Chat
  Completions API (Ollama, vLLM, LiteLLM, etc.)

### Available today

- **Ask AI about any page.** Open a published page and use *Ask AI* to
  chat with the page's contents — useful for summarising, explaining a
  section, or turning a long doc into a quick answer.
- **Docs assistant in the dashboard.** A chat panel in your workspace
  that uses your configured provider to answer questions grounded in
  your synced Google Docs.

### Coming soon

- A full drafting agent that can create new pages from a prompt.
- Restructuring & cleanup across an entire project (fixing headings,
  splitting long pages, enforcing a style).
- Inline writing assistance while you edit in Google Docs.

We never use your content to train a shared model. Requests go directly
from Docspeare to the provider you chose under your own API key and
their terms.

---

## Roles and access

| Role     | Can do                                                         |
| -------- | -------------------------------------------------------------- |
| Owner    | Everything. Billing, delete workspace.                         |
| Admin    | Manage projects, team, publishing, domains.                    |
| Reviewer | Approve/reject pages in review. Cannot delete projects.        |
| Writer   | Create and edit drafts. Submit for review.                     |
| Viewer   | Read-only access to the workspace.                             |

Invite someone from *Settings → Team → Invite*. You can change a role
or revoke access at any time.

---

## Troubleshooting

**A new Google Doc isn't showing up.**
Docspeare syncs incrementally — hit *Sync from Drive* at the top of the
project. If that fails, check that the doc is inside the connected
folder and that Docspeare's Google account still has access.

**I see "Drive access required".**
Your OAuth token expired or was revoked. Go to *Settings → Integrations
→ Google Drive* and click *Reconnect*.

**Publishing failed.**
Check *Activity* for the specific error. Most publish failures are
temporary network issues — retry after a minute. If it persists,
contact us.

**Custom domain won't verify.**
DNS can take up to 24 hours to propagate. Double-check the `CNAME`
points at the host Docspeare gave you. You can verify with
`dig CNAME docs.acme.com`.

---

## Getting help

- **Email** — [hello@docspeare.com](mailto:hello@docspeare.com)
- **Status** — [status.docspeare.com](https://status.docspeare.com)
  *(once live)*

We read every email and typically respond within one business day.
