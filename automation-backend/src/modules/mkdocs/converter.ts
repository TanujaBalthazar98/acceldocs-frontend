export interface ConvertToMarkdownOptions {
  html: string;
  title: string;
  slug?: string;
}

export interface MarkdownResult {
  markdown: string;
  frontmatter: string;
  filePath: string;
}

export class DriveToMarkdownConverter {
  convert(options: ConvertToMarkdownOptions): MarkdownResult {
    const slug = options.slug || this.slugify(options.title);
    const { markdown, toc } = this.processHtml(options.html);

    const frontmatter = this.generateFrontmatter({
      title: options.title,
      slug,
      toc,
    });

    return {
      markdown,
      frontmatter,
      filePath: `docs/${slug}.md`,
    };
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private processHtml(html: string): { markdown: string; toc: string[] } {
    const toc: string[] = [];
    let md = html;

    md = md.replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_match, level, text) => {
      const lvl = parseInt(level);
      const cleanText = text.replace(/<[^>]+>/g, "").trim();
      const slug = this.slugify(cleanText);
      if (lvl <= 3) {
        toc.push(cleanText);
      }
      return "#".repeat(lvl) + " " + cleanText + " {#" + slug + "}\n\n";
    });

    md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
    md = md.replace(/<b>(.*?)<\/b>/gi, "**$1**");
    md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
    md = md.replace(/<i>(.*?)<\/i>/gi, "*$1*");

    md = md.replace(/<code>(.*?)<\/code>/gi, "`$1`");

    md = md.replace(/<pre[^>]*><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/gi, (_match, lang, code) => {
      const language = lang || "";
      return "```" + language + "\n" + code.trim() + "\n```\n\n";
    });

    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
    md = md.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, "![$1]($2)");

    md = md.replace(/<ul[^>]*>/gi, "\n");
    md = md.replace(/<\/ul>/gi, "\n");
    md = md.replace(/<ol[^>]*>/gi, "\n");
    md = md.replace(/<\/ol>/gi, "\n");
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");

    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, content) => {
      const lines = content.trim().split("\n");
      return lines.map((line: string) => "> " + line.replace(/<[^>]+>/g, "")).join("\n") + "\n\n";
    });

    md = md.replace(/<table[^>]*>/gi, "\n");
    md = md.replace(/<\/table>/gi, "\n");
    md = md.replace(/<tr[^>]*>/gi, "| ");
    md = md.replace(/<\/tr>/gi, "\n");
    md = md.replace(/<th[^>]*>(.*?)<\/th>/gi, (_match, text) => {
      return (text.replace(/<[^>]+>/g, "").trim()) + " | ";
    });
    md = md.replace(/<td[^>]*>(.*?)<\/td>/gi, (_match, text) => {
      return (text.replace(/<[^>]+>/g, "").trim()) + " | ";
    });

    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");
    md = md.replace(/<br\s*\/?>/gi, "\n");
    md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, "$1");
    md = md.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, "$1");
    md = md.replace(/<hr\s*\/?>/gi, "\n---\n");

    md = md.replace(/&nbsp;/g, " ");
    md = md.replace(/&lt;/g, "<");
    md = md.replace(/&gt;/g, ">");
    md = md.replace(/&amp;/g, "&");
    md = md.replace(/&quot;/g, '"');

    md = md.replace(/<[^>]+>/g, "");

    md = md.replace(/\n{3,}/g, "\n\n");

    return { markdown: md.trim(), toc };
  }

  private generateFrontmatter(params: { title: string; slug: string; toc: string[] }): string {
    const lines = [
      "---",
      `title: ${params.title}`,
      `slug: ${params.slug}`,
    ];

    if (params.toc.length > 0) {
      lines.push("toc: true");
    }

    lines.push("---");
    lines.push("");

    return lines.join("\n");
  }
}
