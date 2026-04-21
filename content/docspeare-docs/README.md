# Docspeare-on-Docspeare

These are the source drafts for Docspeare's own public documentation
(Help, Privacy, Terms, etc.). The plan is to **dogfood** — publish these
docs through Docspeare itself, so every visitor to `docspeare.com/docs/*`
is implicitly a live demo of the product.

## The workflow

```
  This folder (draft markdown)
           │
           │   copy content into
           ▼
  Google Drive folder: "Docspeare Docs"
           │
           │   synced by Docspeare
           ▼
  Docspeare workspace: "Docspeare"
           │
           │   approved & published
           ▼
  docspeare.com/docs/help, /docs/privacy, /docs/terms
```

## What to do with these files

1. **Create a Google Drive folder** you'll use as the Docspeare workspace root.
   Suggested name: `Docspeare Docs`.

2. **Create one Google Doc per file** in that folder. Use titles that
   will become the URL slug:

   | File          | Google Doc title | Final URL                    |
   | ------------- | ---------------- | ---------------------------- |
   | `help.md`     | `Help`           | `docspeare.com/docs/help`    |
   | `privacy.md`  | `Privacy`        | `docspeare.com/docs/privacy` |
   | `terms.md`    | `Terms`          | `docspeare.com/docs/terms`   |

3. **Paste the content** from each markdown file into the matching Google Doc.
   Google Docs will roughly preserve headings/lists if you use
   *File → Import* on the `.md`, or just paste and re-apply heading styles.

4. **Sign up on Docspeare** with the Google account that owns the folder.
   Create an organization called `Docspeare` and connect it to the
   `Docspeare Docs` Drive folder as the root.

5. **Sync from Drive** so the tool picks up the three docs, then
   **review → approve → publish** each one.

6. **Point `docspeare.com`** at the app (Vercel custom domain) and configure
   the `Docspeare` organization to serve its public portal at the apex
   domain. Once that's wired up, the footer links (already pointing at
   `/docs/help`, `/docs/privacy`, `/docs/terms`) will resolve to the real
   published docs.

## Why keep the drafts in-repo?

- **Recovery**: if the Google Docs ever get corrupted or accidentally
  deleted, the repo version is the source of truth.
- **Review in PRs**: legal and copy changes become diffable.
- **Bootstrap**: lets new teammates spin up a mirror of the Docspeare
  docs on a staging workspace.

> Keep the repo copy and the Google Doc copy in sync. Treat the repo as
> the canonical draft; when content is edited in Drive, mirror the change
> back here.

## Legal disclaimer

`privacy.md` and `terms.md` are **drafts authored without legal review**.
They are structured to cover the services Docspeare actually uses
(Google APIs, PostHog, Resend, Vercel, multiple AI providers) but they
have **not** been vetted by counsel. **Have a lawyer review before
publishing**, and tailor retention windows, jurisdiction, and liability
caps to your business and where your users live.
