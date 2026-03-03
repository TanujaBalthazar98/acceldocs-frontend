import { db } from "../../db/client.js";
import { logger } from "../../logging/logger.js";
import { GitHubRepoService } from "../github/repo.js";
import { MkDocsGenerator, type MkDocsConfig, type MkDocsNavItem } from "./generator.js";
import { DriveToMarkdownConverter } from "./converter.js";
import { config } from "../../config/index.js";

function decryptToken(encrypted: string): string {
  return Buffer.from(encrypted, "base64").toString("utf-8");
}

export interface PublishOptions {
  organizationId: number;
  branch?: string;
}

export interface PublishResult {
  success: boolean;
  commitSha?: string;
  pagesUrl?: string;
  error?: string;
}

export class MkDocsPublisher {
  private generator = new MkDocsGenerator();
  private converter = new DriveToMarkdownConverter();

  async publish(options: PublishOptions): Promise<PublishResult> {
    const { organizationId, branch = config.PROD_BRANCH } = options;

    const settings = db.prepare(`
      SELECT github_username, repo_full_name, access_token_encrypted
      FROM github_settings
      WHERE organization_id = ?
    `).get(organizationId) as { github_username: string; repo_full_name: string; access_token_encrypted: string } | undefined;

    if (!settings || !settings.repo_full_name) {
      return { success: false, error: "GitHub repo not configured" };
    }

    const accessToken = decryptToken(settings.access_token_encrypted);
    const github = new GitHubRepoService(accessToken);
    const [owner, repo] = settings.repo_full_name.split("/");

    const files = await this.prepareFiles(organizationId, settings.repo_full_name);

    try {
      const commitSha = await github.pushFiles(owner, repo, branch, files, "Update documentation via Acceldocs");

      let pagesUrl = await github.getPagesUrl(owner, repo);
      if (!pagesUrl) {
        await github.enablePages(owner, repo);
        pagesUrl = await github.getPagesUrl(owner, repo);
      }

      db.prepare(`
        UPDATE github_settings
        SET last_published_at = CURRENT_TIMESTAMP, pages_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = ?
      `).run(pagesUrl || null, organizationId);

      logger.info({ organizationId, commitSha, pagesUrl }, "mkdocs.publish.success");

      return { success: true, commitSha, pagesUrl: pagesUrl || undefined };
    } catch (error: any) {
      logger.error({ organizationId, error: error.message }, "mkdocs.publish.failed");
      return { success: false, error: error.message };
    }
  }

  private async prepareFiles(organizationId: number, repoFullName: string): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];

    const org = db.prepare("SELECT name, slug FROM organizations WHERE id = ?").get(organizationId) as { name: string; slug: string } | undefined;
    if (!org) {
      throw new Error("Organization not found");
    }

    const documents = db.prepare(`
      SELECT d.id, d.title, d.slug, d.content_markdown, p.name as project_name, p.slug as project_slug,
             s.name as section_name, s.slug as section_slug
      FROM documents d
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN sections s ON d.section_id = s.id
      WHERE d.organization_id = ? AND d.visibility = 'public'
      ORDER BY p.name, s.name, d.title
    `).all(organizationId) as Array<{
      id: number;
      title: string;
      slug: string;
      content_markdown: string | null;
      project_name: string;
      project_slug: string;
      section_name: string | null;
      section_slug: string | null;
    }>;

    const nav: MkDocsNavItem[] = [];
    const projectsMap = new Map<string, MkDocsNavItem>();

    for (const doc of documents) {
      const docSlug = doc.slug || `doc-${doc.id}`;
      const content = doc.content_markdown || `# ${doc.title}\n\nNo content available.`;

      files.push({
        path: `docs/${docSlug}.md`,
        content,
      });

      let projectNav = projectsMap.get(doc.project_slug);
      if (!projectNav) {
        projectNav = {
          title: doc.project_name,
          children: [],
        };
        projectsMap.set(doc.project_slug, projectNav);
        nav.push(projectNav);
      }

      const navItem: MkDocsNavItem = {
        title: doc.title,
        file: `${docSlug}.md`,
      };

      if (doc.section_slug && projectNav.children) {
        let sectionNav = projectNav.children.find(
          (c) => c.title === doc.section_name,
        ) as MkDocsNavItem | undefined;

        if (!sectionNav) {
          sectionNav = {
            title: doc.section_name!,
            children: [],
          };
          projectNav.children.push(sectionNav);
        }

        if (!sectionNav.children) {
          sectionNav.children = [];
        }
        sectionNav.children.push(navItem);
      } else if (projectNav.children) {
        projectNav.children.push(navItem);
      }
    }

    const mkdocsConfig: MkDocsConfig = {
      siteName: org.name,
      siteDescription: `Documentation for ${org.name}`,
      siteUrl: `https://${org.slug}.acceldocs.com`,
      repoUrl: `https://github.com/${repoFullName}`,
      repoName: repoFullName,
      nav,
      theme: {
        palette: [
          { primary: "indigo", accent: "blue" },
        ],
      },
    };

    const mkdocsYaml = this.generator.generate(mkdocsConfig);
    files.push({ path: "mkdocs.yml", content: mkdocsYaml });

    files.push({
      path: ".gitignore",
      content: `node_modules/
site/
.mkdocs/
.env
*.log
`,
    });

    const readmeContent = `# ${org.name} Documentation

This documentation is automatically published by [Acceldocs](https://acceldocs.com).

## Development

To preview locally:

\`\`\`bash
pip install mkdocs mkdocs-material
mkdocs serve
\`\`\`

## Publishing

Documentation is automatically published when changes are made in Google Drive and synced through Acceldocs.
`;

    files.push({ path: "README.md", content: readmeContent });

    return files;
  }
}

let globalPublisher: MkDocsPublisher | null = null;

export function getMkDocsPublisher(): MkDocsPublisher {
  if (!globalPublisher) {
    globalPublisher = new MkDocsPublisher();
  }
  return globalPublisher;
}
