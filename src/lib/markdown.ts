import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
  mangle: false,
  headerIds: false,
});

export function isLikelyMarkdown(content: string | null | undefined): boolean {
  if (!content) return false;

  // If it already looks like HTML, treat it as HTML.
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return false;

  if (/^#{1,6}\s+\S/m.test(content)) return true;
  if (/^\s*([-*+]|\d+\.)\s+\S/m.test(content)) return true;
  if (/^```/m.test(content)) return true;
  if (/\|.+\|/.test(content) && /\|[-: ]+\|/.test(content)) return true;

  return false;
}

export function stripFrontmatter(content: string): string {
  if (!content) return content;
  // Strip YAML (---) or TOML (+++) frontmatter blocks
  return content.replace(/^\s*---\s*\n[\s\S]*?\n---\s*\n?/, "")
                .replace(/^\s*\+\+\+\s*\n[\s\S]*?\n\+\+\+\s*\n?/, "");
}

export function stripFirstMarkdownHeading(markdown: string, title: string): string {
  if (!markdown || !title) return markdown;

  const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, " ");
  const match = markdown.match(/^\s*#{1,6}\s+(.+?)\s*(\r?\n|$)/);
  if (!match) return markdown;

  const headingText = match[1].trim().toLowerCase().replace(/\s+/g, " ");
  if (headingText === normalizedTitle) {
    return markdown.slice(match[0].length);
  }

  return markdown;
}

export function renderMarkdownToHtml(markdown: string): string {
  return marked.parse(markdown).trim();
}
