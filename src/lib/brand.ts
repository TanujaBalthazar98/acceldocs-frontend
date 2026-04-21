/**
 * Centralized brand constants.
 *
 * Docspeare's own public content (Help, Privacy, Terms) is published through
 * Docspeare itself — the source lives in a Google Drive folder owned by
 * Docspeare, gets synced through the product, and is served on
 * docspeare.com/docs/*.
 *
 * Flip any of these URLs in exactly one place when the underlying docs move.
 */

export const BRAND = {
  name: "Docspeare",
  displayName: "docspeare",
  tagline: "Ship docs as fast as you ship product",
  domain: "docspeare.com",

  /** The org slug used to publish Docspeare's own docs through Docspeare. */
  selfOrgSlug: "docspeare",

  /** Hostnames that serve the Docspeare org as a custom domain. On those
   *  hosts, `/docs/help` resolves directly; everywhere else we prefix with
   *  the org slug so the same link still works in dev / staging / preview. */
  customDocsHosts: ["docspeare.com", "www.docspeare.com"],

  /** Public-facing URLs in their *custom-domain* shape. Pass them through
   *  `resolveBrandUrl()` before rendering so they work on every host. */
  urls: {
    help: "/docs/help",
    privacy: "/docs/privacy",
    terms: "/docs/terms",
    changelog: "/docs/changelog",
    contact: "mailto:hello@docspeare.com",
  },

  social: {
    twitter: "https://twitter.com/docspeare",
    linkedin: "https://linkedin.com/company/docspeare",
  },
} as const;

export type BrandUrls = typeof BRAND.urls;

/**
 * Make a BRAND.urls entry safe to render on any host.
 *
 * On the production apex (`docspeare.com`), the Docspeare org is mapped via
 * `custom_docs_domain`, so `/docs/help` resolves straight to the Help page.
 *
 * Anywhere else (localhost, preview URLs, Vercel default hostnames), the
 * router expects the org slug in the path. We prefix `/docs/<slug>` paths
 * with `/docs/docspeare/<slug>` so footer links still land on the right
 * page without the user needing to know which host they're on.
 *
 * Non-`/docs/*` values (mailto:, https://) are returned untouched.
 */
export const resolveBrandUrl = (path: string): string => {
  if (!path.startsWith("/docs/")) return path;
  if (typeof window === "undefined") return path;

  const host = window.location.hostname.toLowerCase();
  const isCustomDomain = (BRAND.customDocsHosts as readonly string[]).includes(host);
  if (isCustomDomain) return path;

  return path.replace(/^\/docs\//, `/docs/${BRAND.selfOrgSlug}/`);
};
