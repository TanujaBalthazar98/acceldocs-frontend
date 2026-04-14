/**
 * SEO utilities for dynamic <head> tag management.
 * Sets document.title and meta description/OG tags at runtime.
 */

export interface SeoProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  noindex?: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>> | null;
}

const DEFAULT_TITLE = "Knowledge Workspace — Google Docs to Production Docs";
const DEFAULT_DESCRIPTION =
  "Turn your Google Drive into a production documentation system with structured approvals, version control, and AI-powered drafting.";
const DEFAULT_OG_IMAGE = "https://acceldocs.vercel.app/og-image.png";
const JSON_LD_SCRIPT_ID = "acceldocs-jsonld-primary";
const CANONICAL_DROP_PARAMS = new Set([
  "auth_token",
  "token",
  "jwt",
  "signature",
  "sig",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
]);

function setMetaContent(name: string, content: string, property = false) {
  const attr = property ? "property" : "name";
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function setStructuredData(
  data: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined,
) {
  const existing = document.getElementById(JSON_LD_SCRIPT_ID);
  if (!data || (Array.isArray(data) && data.length === 0)) {
    if (existing) existing.remove();
    return;
  }
  const payload = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : data;
  const script = existing || document.createElement("script");
  script.id = JSON_LD_SCRIPT_ID;
  script.setAttribute("type", "application/ld+json");
  script.textContent = JSON.stringify(payload);
  if (!existing) {
    document.head.appendChild(script);
  }
}

export function sanitizeCanonicalUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.hash = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (CANONICAL_DROP_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function applySeo({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalUrl,
  ogImage = DEFAULT_OG_IMAGE,
  noindex = false,
  structuredData = null,
}: SeoProps = {}) {
  const fullTitle = title
    ? `${title} — Knowledge Workspace`
    : DEFAULT_TITLE;

  document.title = fullTitle;

  setMetaContent("description", description);
  setMetaContent(
    "robots",
    noindex
      ? "noindex,nofollow,noarchive,nosnippet"
      : "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1",
  );

  setMetaContent("og:title", fullTitle, true);
  setMetaContent("og:description", description, true);
  setMetaContent("og:image", ogImage, true);

  setMetaContent("twitter:card", "summary_large_image");
  setMetaContent("twitter:title", fullTitle);
  setMetaContent("twitter:description", description);
  setMetaContent("twitter:image", ogImage);

  if (canonicalUrl) {
    const canonical = sanitizeCanonicalUrl(canonicalUrl);
    setLink("canonical", canonical);
    setMetaContent("og:url", canonical, true);
  }

  setStructuredData(structuredData);
}

/** Reset to site defaults (call on pages that shouldn't have custom SEO) */
export function resetSeo() {
  applySeo();
}
