import { config } from "../../config/index.js";
import { logger } from "../../logging/logger.js";

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export class GitHubOAuthService {
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID || "",
      redirect_uri: config.GITHUB_CALLBACK_URL,
      scope: "repo pages admin:org",
      state,
    });
    return `${GITHUB_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error }, "github.oauth.token_exchange_failed");
      throw new Error("Failed to exchange code for token");
    }

    const data = (await response.json()) as GitHubTokenResponse;
    return data.access_token;
  }

  async getUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error }, "github.oauth.get_user_failed");
      throw new Error("Failed to get GitHub user");
    }

    return response.json() as Promise<GitHubUser>;
  }

  async getUserOrgs(accessToken: string): Promise<Array<{ id: number; login: string; name: string }>> {
    const response = await fetch(`${GITHUB_API_URL}/user/orgs`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      return [];
    }

    return response.json() as Promise<Array<{ id: number; login: string; name: string }>>;
  }
}
