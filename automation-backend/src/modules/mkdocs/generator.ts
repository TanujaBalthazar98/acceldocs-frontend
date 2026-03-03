export interface MkDocsConfig {
  siteName: string;
  siteDescription?: string;
  siteUrl?: string;
  repoUrl?: string;
  repoName?: string;
  nav: MkDocsNavItem[];
  theme?: {
    name?: string;
    palette?: Array<{ primary: string; accent: string; media?: string }>;
    font?: { text?: string; code?: string };
  };
  markdownExtensions?: string[];
}

export interface MkDocsNavItem {
  title: string;
  file?: string;
  children?: MkDocsNavItem[];
}

export class MkDocsGenerator {
  generate(config: MkDocsConfig): string {
    const lines: string[] = [
      "site_name: " + this.escapeYaml(config.siteName),
      "",
    ];

    if (config.siteDescription) {
      lines.push("site_description: " + this.escapeYaml(config.siteDescription));
      lines.push("");
    }

    if (config.siteUrl) {
      lines.push("site_url: " + this.escapeYaml(config.siteUrl));
      lines.push("");
    }

    if (config.repoUrl) {
      lines.push("repo_url: " + this.escapeYaml(config.repoUrl));
      if (config.repoName) {
        lines.push("repo_name: " + this.escapeYaml(config.repoName));
      }
      lines.push("");
    }

    lines.push("docs_dir: docs");
    lines.push("site_dir: site");
    lines.push("");

    lines.push("nav:");
    for (const item of config.nav) {
      lines.push(...this.renderNavItem(item, 2));
    }
    lines.push("");

    lines.push("theme:");
    lines.push("  name: material");
    if (config.theme?.palette) {
      for (const p of config.theme.palette) {
        lines.push("  palette:");
        lines.push("    - media: '(prefers-color-scheme: light)'");
        lines.push(`      primary: ${p.primary}`);
        lines.push(`      accent: ${p.accent}`);
        lines.push("    - media: '(prefers-color-scheme: dark)'");
        lines.push(`      primary: ${p.primary}`);
        lines.push(`      accent: ${p.accent}`);
      }
    }
    lines.push("");

    lines.push("markdown_extensions:");
    lines.push("  - toc:");
    lines.push("      permalink: true");
    lines.push("  - admonition");
    lines.push("  - pymdownx.details");
    lines.push("  - pymdownx.superfences");
    lines.push("  - pymdownx.highlight:");
    lines.push("      anchor_linenums: true");
    lines.push("  - pymdownx.inlinehilite");
    lines.push("  - pymdownx.snippets");
    lines.push("  - pymdownx.markdownlint:");
    lines.push("      pymdownx.markdownlint: true");
    lines.push("");

    lines.push("plugins:");
    lines.push("  - search:");
    lines.push("      separator: '[\\s\\-\\.]+'");
    lines.push("      prebuild_index: true");
    lines.push("");

    return lines.join("\n");
  }

  private escapeYaml(str: string): string {
    if (str.includes(":") || str.includes("#") || str.includes("'") || str.includes('"') || str.startsWith(" ") || str.endsWith(" ")) {
      return '"' + str.replace(/"/g, '\\"') + '"';
    }
    return str;
  }

  private renderNavItem(item: MkDocsNavItem, indent: number): string[] {
    const prefix = "  ".repeat(indent);
    const lines: string[] = [];

    if (item.file) {
      lines.push(`${prefix}- ${item.title}: ${item.file}`);
    } else if (item.children) {
      lines.push(`${prefix}- ${item.title}:`);
      for (const child of item.children) {
        lines.push(...this.renderNavItem(child, indent + 1));
      }
    } else {
      lines.push(`${prefix}- ${item.title}`);
    }

    return lines;
  }
}
