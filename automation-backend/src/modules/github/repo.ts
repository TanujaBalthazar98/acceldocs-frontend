import { config } from "../../config/index.js";
import { logger } from "../../logging/logger.js";

const GITHUB_API_URL = "https://api.github.com";

export interface RepoDetails {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  pagesUrl: string | null;
}

export class GitHubRepoService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async createRepo(name: string, description: string, isPrivate: boolean = true): Promise<RepoDetails> {
    const response = await fetch(`${GITHUB_API_URL}/user/repos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true,
        license_template: "mit",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, name }, "github.repo.create_failed");
      throw new Error(`Failed to create repository: ${error}`);
    }

    const repo = (await response.json()) as {
      id: number;
      name: string;
      full_name: string;
      html_url: string;
      default_branch: string;
    };

    logger.info({ repo: repo.full_name }, "github.repo.created");

    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch,
      pagesUrl: null,
    };
  }

  async getRepo(owner: string, repo: string): Promise<RepoDetails | null> {
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      const error = await response.text();
      logger.error({ error, owner, repo }, "github.repo.get_failed");
      throw new Error(`Failed to get repository: ${error}`);
    }

    const r = (await response.json()) as {
      id: number;
      name: string;
      full_name: string;
      html_url: string;
      default_branch: string;
      pages: { url: string } | null;
    };

    return {
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      htmlUrl: r.html_url,
      defaultBranch: r.default_branch,
      pagesUrl: r.pages?.url || null,
    };
  }

  async enablePages(owner: string, repo: string): Promise<void> {
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: {
          branch: config.PROD_BRANCH,
          path: "/",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, owner, repo }, "github.pages.enable_failed");
      throw new Error(`Failed to enable GitHub Pages: ${error}`);
    }

    logger.info({ owner, repo }, "github.pages.enabled");
  }

  async setCustomDomain(owner: string, repo: string, domain: string): Promise<void> {
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/pages/domain`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, owner, repo, domain }, "github.pages.custom_domain_failed");
      throw new Error(`Failed to set custom domain: ${error}`);
    }

    logger.info({ owner, repo, domain }, "github.pages.custom_domain_set");
  }

  async getCustomDomain(owner: string, repo: string): Promise<string | null> {
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/pages/domain`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      return null;
    }

    const data = (await response.json()) as { domain: string; verified: boolean };
    return data.verified ? data.domain : null;
  }

  async deleteCustomDomain(owner: string, repo: string): Promise<void> {
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/pages/domain`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      logger.error({ error, owner, repo }, "github.pages.custom_domain_delete_failed");
    }
  }

  async getPagesUrl(owner: string, repo: string): Promise<string | null> {
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/pages`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { html_url: string; status: string };
    if (data.status === "built" || data.status === "published") {
      return data.html_url;
    }

    return null;
  }

  async pushFiles(
    owner: string,
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string,
  ): Promise<string> {
    const tree: Array<{ path: string; mode: string; type: string; content?: string }> = [];

    for (const file of files) {
      const content = Buffer.from(file.content).toString("base64");
      tree.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        content,
      });
    }

    const commitResponse = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: commitMessage,
        tree: {
          base_tree: await this.getTreeSha(owner, repo, branch),
          tree,
        },
        parents: [await this.getBranchSha(owner, repo, branch)],
      }),
    });

    if (!commitResponse.ok) {
      const error = await commitResponse.text();
      logger.error({ error, owner, repo }, "github.repo.commit_failed");
      throw new Error(`Failed to create commit: ${error}`);
    }

    const commit = (await commitResponse.json()) as { sha: string };

    const refResponse = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sha: commit.sha,
        force: true,
      }),
    });

    if (!refResponse.ok) {
      const error = await refResponse.text();
      logger.error({ error, owner, repo, branch }, "github.repo.ref_update_failed");
      throw new Error(`Failed to update branch: ${error}`);
    }

    logger.info({ owner, repo, branch, files: files.length }, "github.repo.files_pushed");

    return commit.sha;
  }

  private async getBranchSha(owner: string, repo: string, branch: string): Promise<string> {
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/branches/${branch}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get branch: ${response.statusText}`);
    }

    const data = (await response.json()) as { commit: { sha: string } };
    return data.commit.sha;
  }

  private async getTreeSha(owner: string, repo: string, branch: string): Promise<string> {
    const sha = await this.getBranchSha(owner, repo, branch);

    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/trees/${sha}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get tree: ${response.statusText}`);
    }

    const data = (await response.json()) as { sha: string };
    return data.sha;
  }
}
