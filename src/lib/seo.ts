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
}

const DEFAULT_TITLE = "Knowledge Workspace — Google Docs to Production Docs";
const DEFAULT_DESCRIPTION =
  "Turn your Google Drive into a production documentation system with structured approvals, version control, and AI-powered drafting.";
const DEFAULT_OG_IMAGE = "https://acceldocs.vercel.app/og-image.png";

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

export function applySeo({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalUrl,
  ogImage = DEFAULT_OG_IMAGE,
  noindex = false,
}: SeoProps = {}) {
  const fullTitle = title
    ? `${title} — Knowledge Workspace`
    : DEFAULT_TITLE;

  document.title = fullTitle;

  setMetaContent("description", description);
  setMetaContent("robots", noindex ? "noindex,nofollow" : "index,follow");

  setMetaContent("og:title", fullTitle, true);
  setMetaContent("og:description", description, true);
  setMetaContent("og:image", ogImage, true);

  setMetaContent("twitter:title", fullTitle);
  setMetaContent("twitter:description", description);
  setMetaContent("twitter:image", ogImage);

  if (canonicalUrl) {
    setLink("canonical", canonicalUrl);
  }
}

/** Reset to site defaults (call on pages that shouldn't have custom SEO) */
export function resetSeo() {
  applySeo();
}
