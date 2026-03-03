import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { IngestionService } from "../modules/ingestion/service.js";
import { MarkdownService } from "../modules/markdown/service.js";
import { PublishQueueService } from "../modules/publish-queue/service.js";
import { GitHubOAuthService, GitHubRepoService } from "../modules/github/index.js";
import { DriveConnector } from "../modules/drive/connector.js";
import { config } from "../config/index.js";
import { db } from "../db/client.js";

const syncSchema = z.object({
  rootFolderId: z.string().default(config.DRIVE_ROOT_FOLDER),
});

const queueSchema = z.object({
  documentId: z.number(),
  targetBranch: z.string(),
});

const createRepoSchema = z.object({
  organizationId: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
});

const setCustomDomainSchema = z.object({
  organizationId: z.number(),
  domain: z.string(),
});

const createOrganizationSchema = z.object({
  name: z.string(),
  slug: z.string().optional(),
  domain: z.string().optional(),
  drive_folder_id: z.string().optional(),
});

function encryptToken(token: string): string {
  return Buffer.from(token).toString("base64");
}

function decryptToken(encrypted: string): string {
  return Buffer.from(encrypted, "base64").toString("utf-8");
}

function generateToken(): string {
  return crypto.randomUUID();
}

// Helper to extract session from auth header
function getSession(request: FastifyRequest): { user_id: number; organization_id: number } | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const session = db.prepare(
    "SELECT user_id, organization_id FROM auth_sessions WHERE token = ? AND expires_at > datetime('now')"
  ).get(token) as { user_id: number; organization_id: number } | undefined;
  return session || null;
}

// Helper to get user's Google Drive connector
async function getDriveConnector(request: FastifyRequest): Promise<DriveConnector | null> {
  const session = getSession(request);
  if (!session) return null;

  // Try x-google-token header first
  const googleToken = request.headers["x-google-token"] as string | undefined;

  const drive = new DriveConnector();

  if (googleToken) {
    drive.setAccessToken(googleToken);
    return drive;
  }

  // Fall back to stored tokens
  const initialized = await drive.initFromUserId(session.user_id);
  return initialized ? drive : null;
}

export function registerRoutes(
  app: FastifyInstance,
  deps: {
    ingestionService: IngestionService;
    markdownService: MarkdownService;
    publishQueue: PublishQueueService;
  },
) {
  const githubOAuth = new GitHubOAuthService();

  // ── Health ────────────────────────────────────────────────
  app.get("/health", async () => ({ ok: true }));

  // ── Auth: Register ────────────────────────────────────────
  app.post("/auth/register", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createOrganizationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.flatten() });

    const { name, slug, domain, drive_folder_id } = parsed.data;
    const orgSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const existing = db.prepare("SELECT id FROM organizations WHERE slug = ?").get(orgSlug);
    if (existing) {
      return reply.code(400).send({ ok: false, error: "Organization slug already exists" });
    }

    const result = db.prepare(`
      INSERT INTO organizations (name, slug, domain, drive_folder_id) VALUES (?, ?, ?, ?)
    `).run(name, orgSlug, domain || null, drive_folder_id || null);

    return { ok: true, organizationId: result.lastInsertRowid, slug: orgSlug };
  });

  // ── Auth: Search Organizations ────────────────────────────
  const searchOrgs = (query: string) => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const like = `%${q}%`;
    return db.prepare(`
      SELECT o.id, o.name, o.domain,
             COALESCE((SELECT COUNT(*) FROM org_members om WHERE om.organization_id = o.id), 0) AS member_count
      FROM organizations o
      WHERE LOWER(o.name) LIKE ? OR LOWER(COALESCE(o.domain, '')) LIKE ? OR LOWER(o.slug) LIKE ?
      ORDER BY o.name ASC LIMIT 20
    `).all(like, like, like);
  };

  app.post("/auth/search-organizations", async (request: FastifyRequest) => {
    const body = (request.body || {}) as { query?: string };
    return { ok: true, organizations: searchOrgs(body.query || "") };
  });

  app.get("/auth/search-organizations", async (request: FastifyRequest) => {
    const { query = "" } = request.query as { query?: string };
    return { ok: true, organizations: searchOrgs(query) };
  });

  // Legacy alias used by some older UI codepaths.
  app.get("/api/organizations/search", async (request: FastifyRequest) => {
    const { query = "" } = request.query as { query?: string };
    return { ok: true, organizations: searchOrgs(query) };
  });

  // ── Auth: Get Current User ────────────────────────────────
  // Returns format compatible with frontend auth.ts getSession()
  app.get("/auth/me", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) {
      return reply.code(401).send({ ok: false, error: "Not authenticated" });
    }

    const user = db.prepare(
      "SELECT id, email, display_name, google_subject FROM users WHERE id = ?"
    ).get(session.user_id) as { id: number; email: string; display_name: string | null; google_subject: string | null } | undefined;

    const org = db.prepare(
      "SELECT id, name, slug, domain FROM organizations WHERE id = ?"
    ).get(session.organization_id) as { id: number; name: string; slug: string; domain: string | null } | undefined;

    if (!user || !org) {
      return reply.code(401).send({ ok: false, error: "User or organization not found" });
    }

    // Return flat user object that auth.ts getSession() expects:
    // It checks for data.id and data.email
    return {
      id: user.id,
      email: user.email,
      name: user.display_name,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        domain: org.domain,
      },
    };
  });

  // ── Auth: Logout ──────────────────────────────────────────
  app.post("/auth/logout", async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      db.prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
    }
    return { ok: true };
  });

  // ── Auth: Build Google OAuth URL ──────────────────────────
  const buildGoogleAuthUrl = (state: string = "", redirectUri?: string) => {
    const scopes = [
      "openid", "email", "profile",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ];
    const resolvedRedirectUri = redirectUri || config.GOOGLE_REDIRECT_URI || "";
    return `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${config.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(resolvedRedirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes.join(" "))}` +
      `&state=${state}` +
      `&access_type=offline` +
      `&prompt=consent`;
  };

  // Returns the OAuth URL as JSON (used by frontend AuthContext)
  app.get("/auth/login", async (request: FastifyRequest) => {
    const { state, organizationId, redirect_uri } = request.query as {
      state?: string;
      organizationId?: string;
      redirect_uri?: string;
    };
    let oauthState = state || "";
    if (!oauthState && organizationId) {
      oauthState = Buffer.from(
        JSON.stringify({ organizationId: Number.parseInt(organizationId, 10) })
      ).toString("base64");
    }
    return { url: buildGoogleAuthUrl(oauthState, redirect_uri) };
  });

  // Redirects directly to Google OAuth
  app.get("/auth/google", async (request: FastifyRequest, reply: FastifyReply) => {
    const { organizationId } = request.query as { organizationId?: string };
    const state = organizationId
      ? Buffer.from(JSON.stringify({ organizationId: parseInt(organizationId) })).toString("base64")
      : "";
    return reply.redirect(buildGoogleAuthUrl(state));
  });

  // ── Auth: Google OAuth Callback (JSON API) ────────────────
  app.get("/auth/callback", async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, api } = request.query as { code?: string; state?: string; api?: string };

    if (!code) {
      return reply.code(400).send({ ok: false, error: "Missing code parameter" });
    }

    try {
      // Exchange code for tokens
      const redirectUri =
        ((request.query as { redirect_uri?: string } | undefined)?.redirect_uri || "").trim() ||
        config.GOOGLE_REDIRECT_URI ||
        "";

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.GOOGLE_CLIENT_ID || "",
          client_secret: config.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = (await tokenResponse.json()) as {
        access_token?: string; id_token?: string;
        error?: string; error_description?: string;
        refresh_token?: string;
      };

      if (tokenData.error || !tokenData.access_token) {
        console.error("Google token exchange failed:", tokenData);
        return reply.code(400).send({
          ok: false,
          error: `Token exchange failed: ${tokenData.error_description || tokenData.error || "No access token"}`,
        });
      }

      // Get user info from Google
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return reply.code(400).send({ ok: false, error: "Failed to fetch user info from Google" });
      }

      const userInfo = (await userInfoResponse.json()) as { id: string; email: string; name: string; picture: string };

      // Parse state for organizationId
      let organizationId: number | undefined;
      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
          organizationId = decoded.organizationId;
        } catch {
          // State doesn't contain organizationId
        }
      }

      // Upsert user
      let user = db.prepare("SELECT id FROM users WHERE google_subject = ?").get(userInfo.id) as { id: number } | undefined;

      if (!user) {
        const result = db.prepare(
          "INSERT INTO users (google_subject, email, display_name) VALUES (?, ?, ?)"
        ).run(userInfo.id, userInfo.email, userInfo.name);
        user = { id: Number(result.lastInsertRowid) };
      } else {
        db.prepare("UPDATE users SET email = ?, display_name = ? WHERE id = ?").run(
          userInfo.email, userInfo.name, user.id
        );
      }

      // Store Google tokens for Drive access
      if (tokenData.access_token) {
        const encryptedAccess = encryptToken(tokenData.access_token);
        const encryptedRefresh = tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null;

        const existingToken = db.prepare("SELECT id FROM google_tokens WHERE user_id = ?").get(user.id) as { id: number } | undefined;
        if (existingToken) {
          if (encryptedRefresh) {
            db.prepare("UPDATE google_tokens SET access_token_encrypted = ?, refresh_token_encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
              .run(encryptedAccess, encryptedRefresh, user.id);
          } else {
            db.prepare("UPDATE google_tokens SET access_token_encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
              .run(encryptedAccess, user.id);
          }
        } else {
          db.prepare("INSERT INTO google_tokens (user_id, access_token_encrypted, refresh_token_encrypted) VALUES (?, ?, ?)")
            .run(user.id, encryptedAccess, encryptedRefresh);
        }
      }

      // Resolve organization
      if (!organizationId) {
        const domain = userInfo.email.split("@")[1];
        const existing = db.prepare("SELECT id FROM organizations WHERE domain = ?").get(domain) as { id: number } | undefined;
        if (!existing) {
          const orgResult = db.prepare(
            "INSERT INTO organizations (name, slug, domain) VALUES (?, ?, ?)"
          ).run(
            userInfo.name + "'s Workspace",
            userInfo.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            domain
          );
          organizationId = Number(orgResult.lastInsertRowid);
          // Make the creator an owner
          db.prepare("INSERT OR IGNORE INTO org_members (organization_id, user_id, role) VALUES (?, ?, 'owner')")
            .run(organizationId, user.id);
        } else {
          organizationId = existing.id;
        }
      }

      // Ensure org_members entry
      db.prepare("INSERT OR IGNORE INTO org_members (organization_id, user_id, role) VALUES (?, ?, 'viewer')")
        .run(organizationId, user.id);

      // Create session
      const sessionToken = generateToken();
      db.prepare(
        "INSERT INTO auth_sessions (user_id, organization_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))"
      ).run(user.id, organizationId, sessionToken);

      // If api=1 query param, return JSON (used by AuthCallback page)
      if (api === "1") {
        return {
          ok: true,
          access_token: sessionToken,
          google_access_token: tokenData.access_token,
          user: {
            id: user.id,
            email: userInfo.email,
            name: userInfo.name,
            role: "admin" as const,
            google_id: userInfo.id,
            created_at: new Date().toISOString(),
          },
        };
      }

      // Default: return JSON for frontend to handle
      return {
        ok: true,
        access_token: sessionToken,
        google_access_token: tokenData.access_token,
        user: {
          id: user.id,
          email: userInfo.email,
          name: userInfo.name,
          role: "admin" as const,
          google_id: userInfo.id,
          created_at: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error("Google OAuth error:", error?.message || error);
      return reply.code(400).send({ ok: false, error: `Authentication failed: ${error?.message || "Unknown error"}` });
    }
  });

  // Redirect-based callback (for /auth/google flow)
  app.get("/auth/google/callback", async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as { code?: string; state?: string };

    if (!code) {
      return reply.code(400).send({ ok: false, error: "Missing code parameter" });
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.GOOGLE_CLIENT_ID || "",
          client_secret: config.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: config.GOOGLE_REDIRECT_URI || "",
          grant_type: "authorization_code",
        }),
      });

      const tokenData = (await tokenResponse.json()) as { access_token: string; id_token: string; refresh_token?: string };

      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userInfo = (await userInfoResponse.json()) as { id: string; email: string; name: string; picture: string };

      let organizationId: number | undefined;
      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
          organizationId = decoded.organizationId;
        } catch { /* ignore */ }
      }

      // Upsert user
      let user = db.prepare("SELECT id FROM users WHERE google_subject = ?").get(userInfo.id) as { id: number } | undefined;
      if (!user) {
        const result = db.prepare("INSERT INTO users (google_subject, email, display_name) VALUES (?, ?, ?)").run(userInfo.id, userInfo.email, userInfo.name);
        user = { id: Number(result.lastInsertRowid) };
      } else {
        db.prepare("UPDATE users SET email = ?, display_name = ? WHERE id = ?").run(userInfo.email, userInfo.name, user.id);
      }

      // Store tokens
      if (tokenData.access_token) {
        const encryptedAccess = encryptToken(tokenData.access_token);
        const encryptedRefresh = tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null;
        const existingToken = db.prepare("SELECT id FROM google_tokens WHERE user_id = ?").get(user.id);
        if (existingToken) {
          if (encryptedRefresh) {
            db.prepare("UPDATE google_tokens SET access_token_encrypted = ?, refresh_token_encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(encryptedAccess, encryptedRefresh, user.id);
          } else {
            db.prepare("UPDATE google_tokens SET access_token_encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(encryptedAccess, user.id);
          }
        } else {
          db.prepare("INSERT INTO google_tokens (user_id, access_token_encrypted, refresh_token_encrypted) VALUES (?, ?, ?)").run(user.id, encryptedAccess, encryptedRefresh);
        }
      }

      // Resolve org
      if (!organizationId) {
        const domain = userInfo.email.split("@")[1];
        const existing = db.prepare("SELECT id FROM organizations WHERE domain = ?").get(domain) as { id: number } | undefined;
        if (!existing) {
          const orgResult = db.prepare("INSERT INTO organizations (name, slug, domain) VALUES (?, ?, ?)").run(
            userInfo.name + "'s Workspace",
            userInfo.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            domain
          );
          organizationId = Number(orgResult.lastInsertRowid);
          db.prepare("INSERT OR IGNORE INTO org_members (organization_id, user_id, role) VALUES (?, ?, 'owner')").run(organizationId, user.id);
        } else {
          organizationId = existing.id;
        }
      }

      db.prepare("INSERT OR IGNORE INTO org_members (organization_id, user_id, role) VALUES (?, ?, 'viewer')").run(organizationId, user.id);

      const sessionToken = generateToken();
      db.prepare("INSERT INTO auth_sessions (user_id, organization_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))").run(user.id, organizationId, sessionToken);

      const frontendUrl = "https://localhost:8080";
      return reply.redirect(`${frontendUrl}/auth/callback?token=${sessionToken}`);
    } catch (error) {
      console.error("Google OAuth error:", error);
      const frontendUrl = "https://localhost:8080";
      return reply.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  });

  // ── GitHub OAuth ──────────────────────────────────────────
  app.get("/auth/github/authorize", async (request: FastifyRequest, reply: FastifyReply) => {
    const { organizationId } = request.query as { organizationId?: string };
    const state = organizationId ? Buffer.from(JSON.stringify({ organizationId: parseInt(organizationId) })).toString("base64") : "";
    const url = githubOAuth.getAuthorizationUrl(state);
    return reply.redirect(url);
  });

  app.get("/auth/github/callback", async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    if (!code) return reply.code(400).send({ ok: false, error: "Missing code parameter" });

    try {
      const accessToken = await githubOAuth.exchangeCodeForToken(code);
      const githubUser = await githubOAuth.getUser(accessToken);

      let organizationId: number | undefined;
      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
          organizationId = decoded.organizationId;
        } catch { /* ignore */ }
      }

      const encryptedToken = encryptToken(accessToken);

      if (organizationId) {
        const existing = db.prepare("SELECT id FROM github_settings WHERE organization_id = ?").get(organizationId);
        if (existing) {
          db.prepare("UPDATE github_settings SET access_token_encrypted = ?, github_user_id = ?, github_username = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ?")
            .run(encryptedToken, githubUser.id, githubUser.login, organizationId);
        } else {
          db.prepare("INSERT INTO github_settings (organization_id, github_user_id, github_username, access_token_encrypted) VALUES (?, ?, ?, ?)")
            .run(organizationId, githubUser.id, githubUser.login, encryptedToken);
        }
      }

      const frontendUrl = "https://localhost:8080";
      return reply.redirect(`${frontendUrl}/dashboard?github=connected&username=${encodeURIComponent(githubUser.login)}`);
    } catch (error) {
      console.error("GitHub OAuth error:", error);
      return reply.redirect("https://localhost:8080/dashboard?github=error");
    }
  });

  // ── GitHub: Create Repo ───────────────────────────────────
  app.post("/github/create-repo", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createRepoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.flatten() });

    const { organizationId, name, description } = parsed.data;
    const settings = db.prepare("SELECT access_token_encrypted, github_username FROM github_settings WHERE organization_id = ?").get(organizationId) as { access_token_encrypted: string; github_username: string } | undefined;
    if (!settings) return reply.code(400).send({ ok: false, error: "GitHub not connected" });

    const accessToken = decryptToken(settings.access_token_encrypted);
    const github = new GitHubRepoService(accessToken);
    const repoName = name || `${organizationId}-docs`;

    try {
      const repo = await github.createRepo(repoName, description || "Documentation published by Acceldocs", false);
      db.prepare("UPDATE github_settings SET repo_name = ?, repo_full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ?")
        .run(repo.name, repo.fullName, organizationId);
      return { ok: true, repo };
    } catch (error: any) {
      return reply.code(400).send({ ok: false, error: error.message });
    }
  });

  // ── GitHub: Custom Domain ─────────────────────────────────
  app.post("/github/custom-domain", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = setCustomDomainSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.flatten() });

    const { organizationId, domain } = parsed.data;
    const settings = db.prepare("SELECT access_token_encrypted, repo_full_name FROM github_settings WHERE organization_id = ?").get(organizationId) as { access_token_encrypted: string; repo_full_name: string } | undefined;
    if (!settings?.repo_full_name) return reply.code(400).send({ ok: false, error: "GitHub repo not set up" });

    const accessToken = decryptToken(settings.access_token_encrypted);
    const github = new GitHubRepoService(accessToken);
    const [owner, repo] = settings.repo_full_name.split("/");

    try {
      await github.setCustomDomain(owner, repo, domain);
      db.prepare("UPDATE github_settings SET custom_domain = ?, domain_verified = 0, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ?").run(domain, organizationId);
      return { ok: true, domain };
    } catch (error: any) {
      return reply.code(400).send({ ok: false, error: error.message });
    }
  });

  app.get("/github/custom-domain/status", async (request: FastifyRequest) => {
    const { organizationId } = request.query as { organizationId: string };
    if (!organizationId) return { ok: true, domain: null, verified: false };

    const settings = db.prepare("SELECT access_token_encrypted, repo_full_name, custom_domain, domain_verified FROM github_settings WHERE organization_id = ?").get(parseInt(organizationId)) as { access_token_encrypted: string; repo_full_name: string; custom_domain: string; domain_verified: number } | undefined;
    if (!settings?.custom_domain) return { ok: true, domain: null, verified: false };

    const accessToken = decryptToken(settings.access_token_encrypted);
    const github = new GitHubRepoService(accessToken);
    const [owner, repo] = settings.repo_full_name.split("/");
    const verifiedDomain = await github.getCustomDomain(owner, repo);
    const isVerified = verifiedDomain === settings.custom_domain;

    if (isVerified !== !!settings.domain_verified) {
      db.prepare("UPDATE github_settings SET domain_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ?").run(isVerified ? 1 : 0, parseInt(organizationId));
    }

    return { ok: true, domain: settings.custom_domain, verified: isVerified };
  });

  app.get("/github/settings/:organizationId", async (request: FastifyRequest) => {
    const { organizationId } = request.params as { organizationId: string };
    const settings = db.prepare("SELECT github_username, repo_name, repo_full_name, custom_domain, domain_verified, pages_url, last_published_at FROM github_settings WHERE organization_id = ?").get(parseInt(organizationId)) as any;

    if (!settings) return { ok: true, connected: false };

    return {
      ok: true, connected: true,
      username: settings.github_username,
      repoName: settings.repo_name,
      repoFullName: settings.repo_full_name,
      customDomain: settings.custom_domain,
      domainVerified: !!settings.domain_verified,
      pagesUrl: settings.pages_url,
      lastPublishedAt: settings.last_published_at,
    };
  });

  // ── Sync / Convert / Publish ──────────────────────────────
  app.post("/sync/run", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = syncSchema.safeParse(request.body || {});
    if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.flatten() });

    const documents = await deps.ingestionService.runRecursiveScan(parsed.data.rootFolderId);
    return { ok: true, count: documents.length, documents };
  });

  app.post("/convert/html-to-markdown", async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as { html?: string; title?: string };
    if (!payload?.html || !payload?.title) return reply.code(400).send({ ok: false, error: "Missing html or title" });

    const result = await deps.markdownService.convert({ html: payload.html, title: payload.title, imageBasePath: "docs/assets" });
    return { ok: true, ...result };
  });

  app.post("/publish/queue", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = queueSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.flatten() });
    const queueId = deps.publishQueue.queue(parsed.data);
    return { ok: true, queueId };
  });

  app.post("/publish/mkdocs", async (request: FastifyRequest, reply: FastifyReply) => {
    const { MkDocsPublisher } = await import("../modules/mkdocs/publisher.js");
    const payload = request.body as { organizationId?: number; branch?: string };
    if (!payload?.organizationId) return reply.code(400).send({ ok: false, error: "Missing organizationId" });

    const publisher = new MkDocsPublisher();
    const result = await publisher.publish({ organizationId: payload.organizationId, branch: payload.branch });
    if (!result.success) return reply.code(400).send({ ok: false, error: result.error });
    return { ok: true, commitSha: result.commitSha, pagesUrl: result.pagesUrl };
  });

  // ══════════════════════════════════════════════════════════
  // API Functions (Dashboard endpoints)
  // ══════════════════════════════════════════════════════════

  // ── ensure-workspace ──────────────────────────────────────
  app.post("/api/functions/ensure-workspace", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { domain?: string; name?: string };

    let org = db.prepare("SELECT id, name, slug, domain, drive_folder_id FROM organizations WHERE id = ?").get(session.organization_id) as any;

    if (!org && body?.domain) {
      const domain = body.domain.toLowerCase().trim();
      const name = body.name || domain.split("@")[0] + "'s Workspace";
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";

      const result = db.prepare("INSERT INTO organizations (name, slug, domain) VALUES (?, ?, ?)").run(name, slug, domain);
      const newOrgId = Number(result.lastInsertRowid);
      db.prepare("UPDATE auth_sessions SET organization_id = ? WHERE token = ?").run(newOrgId, request.headers.authorization?.replace("Bearer ", ""));
      org = { id: newOrgId, name, slug, domain };
    }

    if (!org) return { ok: false, error: "No organization found" };

    return { ok: true, organizationId: org.id, organization: { id: org.id, name: org.name, slug: org.slug, domain: org.domain, drive_folder_id: org.drive_folder_id } };
  });

  // ── get-organization ──────────────────────────────────────
  app.post("/api/functions/get-organization", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { organizationId?: number } | undefined;
    const orgId = body?.organizationId || session.organization_id;

    const org = db.prepare(
      "SELECT id, name, slug, domain, tagline, logo_url, primary_color, secondary_color, accent_color, custom_docs_domain, drive_folder_id, mcp_enabled, openapi_spec_json FROM organizations WHERE id = ?"
    ).get(orgId) as any;

    if (!org) return { ok: false, error: "Organization not found" };

    // Get members
    const members = db.prepare(`
      SELECT u.id, u.email, u.display_name, om.role
      FROM org_members om JOIN users u ON om.user_id = u.id
      WHERE om.organization_id = ?
    `).all(orgId);

    // Get current user's role
    const userRole = db.prepare("SELECT role FROM org_members WHERE organization_id = ? AND user_id = ?").get(orgId, session.user_id) as { role: string } | undefined;

    return {
      ok: true,
      id: org.id, name: org.name, slug: org.slug, domain: org.domain,
      tagline: org.tagline, logo_url: org.logo_url,
      primary_color: org.primary_color, secondary_color: org.secondary_color, accent_color: org.accent_color,
      custom_docs_domain: org.custom_docs_domain, drive_folder_id: org.drive_folder_id,
      mcp_enabled: !!org.mcp_enabled, openapi_spec_json: org.openapi_spec_json,
      members,
      role: userRole?.role || "viewer",
    };
  });

  // ── update-organization ───────────────────────────────────
  app.post("/api/functions/update-organization", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { data?: Record<string, unknown> };
    const data = body?.data || {};
    const allowedFields = [
      "name",
      "slug",
      "domain",
      "tagline",
      "logo_url",
      "primary_color",
      "secondary_color",
      "accent_color",
      "custom_docs_domain",
      "drive_folder_id",
      "mcp_enabled",
      "openapi_spec_json",
      "font_heading",
      "font_body",
      "custom_css",
      "hero_title",
      "hero_description",
      "show_search_on_landing",
      "show_featured_projects",
    ];
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length > 0) {
      values.push(session.organization_id);
      db.prepare(`UPDATE organizations SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    }

    return { ok: true };
  });

  // ── list-projects ─────────────────────────────────────────
  app.post("/api/functions/list-projects", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { organizationId?: number };
    const orgId = body?.organizationId || session.organization_id;

    const projects = db.prepare(
      "SELECT id, name, slug, drive_folder_id, parent_project_id, created_at, updated_at FROM projects WHERE organization_id = ? ORDER BY name ASC"
    ).all(orgId);
    return { ok: true, projects };
  });

  // ── create-project ────────────────────────────────────────
  app.post("/api/functions/create-project", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { name?: string; driveFolderId?: string; parentProjectId?: number };
    const name = body?.name || "New Project";
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const driveFolderId = body?.driveFolderId || "";

    try {
      const result = db.prepare(
        "INSERT INTO projects (organization_id, name, slug, drive_folder_id, parent_project_id) VALUES (?, ?, ?, ?, ?)"
      ).run(session.organization_id, name, slug, driveFolderId, body?.parentProjectId || null);

      // Auto-create a default version
      const versionResult = db.prepare(
        "INSERT INTO project_versions (project_id, name, slug, is_default) VALUES (?, 'v1', 'v1', 1)"
      ).run(Number(result.lastInsertRowid));

      return { ok: true, projectId: result.lastInsertRowid, versionId: versionResult.lastInsertRowid };
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) {
        return { ok: false, error: "Project with this Drive folder already exists" };
      }
      throw err;
    }
  });

  // ── update-project-settings ───────────────────────────────
  app.post("/api/functions/update-project-settings", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { projectId?: number; data?: Record<string, unknown> };
    if (!body?.projectId) return { ok: false, error: "Missing projectId" };

    const data = body.data || {};
    const allowedFields = ["name", "slug"];
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length > 0) {
      values.push(body.projectId);
      db.prepare(`UPDATE projects SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    }

    return { ok: true };
  });

  // ── delete-project ────────────────────────────────────────
  app.post("/api/functions/delete-project", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { projectId?: number };
    if (!body?.projectId) return { ok: false, error: "Missing projectId" };

    db.prepare("DELETE FROM projects WHERE id = ? AND organization_id = ?").run(body.projectId, session.organization_id);
    return { ok: true };
  });

  // ── get-project-settings ──────────────────────────────────
  app.post("/api/functions/get-project-settings", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { projectId?: number };
    if (!body?.projectId) return { ok: false, error: "Missing projectId" };

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(body.projectId) as any;
    if (!project) return { ok: false, error: "Project not found" };

    const org = db.prepare("SELECT id, name, slug FROM organizations WHERE id = ?").get(project.organization_id) as any;
    const userRole = db.prepare("SELECT role FROM org_members WHERE organization_id = ? AND user_id = ?").get(project.organization_id, session.user_id) as { role: string } | undefined;

    return {
      ok: true,
      project,
      organization: org,
      effectiveRole: userRole?.role || "viewer",
      orgRoles: [],
      projectMembers: [],
    };
  });

  // ── list-project-versions ─────────────────────────────────
  app.post("/api/functions/list-project-versions", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { projectIds?: (string | number)[] };
    const projectIds = (body?.projectIds || []).map(Number);
    if (projectIds.length === 0) return { ok: true, versions: [] };

    const placeholders = projectIds.map(() => "?").join(",");
    const versions = db.prepare(`SELECT id, project_id, name, slug, is_default, created_at FROM project_versions WHERE project_id IN (${placeholders}) ORDER BY created_at DESC`).all(...projectIds);
    return { ok: true, versions };
  });

  // ── create-project-version ────────────────────────────────
  app.post("/api/functions/create-project-version", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { projectId?: number; name?: string };
    if (!body?.projectId || !body?.name) return { ok: false, error: "Missing projectId or name" };

    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const result = db.prepare("INSERT INTO project_versions (project_id, name, slug) VALUES (?, ?, ?)").run(body.projectId, body.name, slug);
    return { ok: true, versionId: result.lastInsertRowid };
  });

  // ── list-topics (sections) ────────────────────────────────
  app.post("/api/functions/list-topics", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { projectIds?: (string | number)[] };
    const projectIds = (body?.projectIds || []).map(Number);
    if (projectIds.length === 0) return { ok: true, topics: [] };

    const placeholders = projectIds.map(() => "?").join(",");
    const topics = db.prepare(`
      SELECT s.id, pv.project_id as project_id, s.project_version_id, s.name, s.slug, s.drive_folder_id, s.parent_section_id, s.depth
      FROM sections s JOIN project_versions pv ON s.project_version_id = pv.id
      WHERE pv.project_id IN (${placeholders}) ORDER BY s.name ASC
    `).all(...projectIds);
    return { ok: true, topics };
  });

  // ── create-topic ──────────────────────────────────────────
  app.post("/api/functions/create-topic", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { projectVersionId?: number; name?: string; driveFolderId?: string; parentSectionId?: number };
    if (!body?.projectVersionId || !body?.name) return { ok: false, error: "Missing required fields" };

    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const result = db.prepare(
      "INSERT INTO sections (project_version_id, name, slug, drive_folder_id, parent_section_id) VALUES (?, ?, ?, ?, ?)"
    ).run(body.projectVersionId, body.name, slug, body.driveFolderId || "", body.parentSectionId || null);
    return { ok: true, topicId: result.lastInsertRowid };
  });

  // ── update-topic ──────────────────────────────────────────
  app.post("/api/functions/update-topic", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { topicId?: number; data?: Record<string, unknown> };
    if (!body?.topicId) return { ok: false, error: "Missing topicId" };

    const data = body.data || {};
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (["name", "slug", "parent_section_id"].includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length > 0) {
      values.push(body.topicId);
      db.prepare(`UPDATE sections SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    }
    return { ok: true };
  });

  // ── delete-topic ──────────────────────────────────────────
  app.post("/api/functions/delete-topic", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { topicId?: number };
    if (!body?.topicId) return { ok: false, error: "Missing topicId" };

    db.prepare("DELETE FROM sections WHERE id = ?").run(body.topicId);
    return { ok: true };
  });

  // ── list-documents ────────────────────────────────────────
  app.post("/api/functions/list-documents", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { projectIds?: (string | number)[] };
    const projectIds = (body?.projectIds || []).map(Number);
    if (projectIds.length === 0) return { ok: true, documents: [] };

    const placeholders = projectIds.map(() => "?").join(",");
    const documents = db.prepare(`
      SELECT id, project_id, project_version_id, section_id, title, slug, visibility, status,
             google_doc_id, drive_file_id, is_published, last_ingested_at, created_at, updated_at
      FROM documents WHERE project_id IN (${placeholders}) ORDER BY updated_at DESC
    `).all(...projectIds);
    return { ok: true, documents };
  });

  // ── create-document ───────────────────────────────────────
  app.post("/api/functions/create-document", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as {
      projectId?: number; projectVersionId?: number; sectionId?: number;
      title?: string; googleDocId?: string; driveFileId?: string; drivePath?: string;
      visibility?: string;
    };

    if (!body?.projectId || !body?.title) return { ok: false, error: "Missing required fields" };

    const slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Get or create a default version
    let versionId = body.projectVersionId;
    if (!versionId) {
      const defaultVersion = db.prepare("SELECT id FROM project_versions WHERE project_id = ? AND is_default = 1").get(body.projectId) as { id: number } | undefined;
      if (defaultVersion) {
        versionId = defaultVersion.id;
      } else {
        const vr = db.prepare("INSERT INTO project_versions (project_id, name, slug, is_default) VALUES (?, 'v1', 'v1', 1)").run(body.projectId);
        versionId = Number(vr.lastInsertRowid);
      }
    }

    try {
      const result = db.prepare(`
        INSERT INTO documents (organization_id, project_id, project_version_id, section_id, title, slug, visibility, google_doc_id, drive_file_id, drive_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        session.organization_id, body.projectId, versionId,
        body.sectionId || null, body.title, slug,
        body.visibility || "public",
        body.googleDocId || `doc-${Date.now()}`,
        body.driveFileId || `file-${Date.now()}`,
        body.drivePath || ""
      );
      return { ok: true, documentId: result.lastInsertRowid };
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) {
        return { ok: false, error: "Document already exists" };
      }
      throw err;
    }
  });

  // ── update-document ───────────────────────────────────────
  app.post("/api/functions/update-document", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { documentId?: number; data?: Record<string, unknown> };
    if (!body?.documentId) return { ok: false, error: "Missing documentId" };

    const data = body.data || {};
    const allowedFields = [
      "title", "slug", "visibility", "status", "section_id", "project_id", "project_version_id",
      "is_published", "published_content_id", "published_content_html", "content_html", "content_markdown",
      "topic",
    ];
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(data)) {
      // Map frontend field names to DB column names
      if (key === "project") {
        updates.push("project_id = ?");
        values.push(value);
      } else if (key === "project_version") {
        updates.push("project_version_id = ?");
        values.push(value);
      } else if (key === "topic") {
        updates.push("section_id = ?");
        values.push(value);
      } else if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length > 0) {
      values.push(body.documentId);
      db.prepare(`UPDATE documents SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    }
    return { ok: true };
  });

  // ── delete-document ───────────────────────────────────────
  app.post("/api/functions/delete-document", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { documentId?: number };
    if (!body?.documentId) return { ok: false, error: "Missing documentId" };

    db.prepare("DELETE FROM documents WHERE id = ?").run(body.documentId);
    return { ok: true };
  });

  // ── Google Drive operations ───────────────────────────────
  app.post("/api/functions/google-drive", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const drive = await getDriveConnector(request);
    if (!drive) return { ok: false, needsReauth: true, error: "No Google token. Please reconnect Google Drive." };

    const body = request.body as { action?: string; [key: string]: unknown };
    const action = body?.action;

    switch (action) {
      case "list_folder": {
        const folderId = body.folderId as string || "root";
        const files = await drive.listChildren(folderId);
        return { ok: true, files };
      }
      case "create_folder": {
        const folder = await drive.createFolder(body.name as string, body.parentId as string);
        return folder ? { ok: true, file: folder } : { ok: false, error: "Failed to create folder" };
      }
      case "create_doc": {
        const doc = await drive.createDoc(body.name as string, body.parentId as string);
        return doc ? { ok: true, file: doc } : { ok: false, error: "Failed to create doc" };
      }
      case "trash_file": {
        const success = await drive.trashFile(body.fileId as string);
        return { ok: success };
      }
      case "sync_doc_content": {
        const content = await drive.syncDocContent(body.fileId as string);
        return content ? { ok: true, ...content } : { ok: false, error: "Failed to sync doc content" };
      }
      default:
        return { ok: false, error: `Unknown action: ${action}` };
    }
  });

  // ── store-refresh-token ───────────────────────────────────
  app.post("/api/functions/store-refresh-token", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });

    const body = request.body as { refreshToken?: string };
    if (body?.refreshToken) {
      const encrypted = encryptToken(body.refreshToken);
      const existing = db.prepare("SELECT id FROM google_tokens WHERE user_id = ?").get(session.user_id);
      if (existing) {
        db.prepare("UPDATE google_tokens SET refresh_token_encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(encrypted, session.user_id);
      } else {
        db.prepare("INSERT INTO google_tokens (user_id, refresh_token_encrypted) VALUES (?, ?)").run(session.user_id, encrypted);
      }
    }
    return { ok: true, success: true };
  });

  // ── search-organizations (function endpoint) ──────────────
  app.post("/api/functions/search-organizations", async (request: FastifyRequest) => {
    const body = (request.body || {}) as { query?: string };
    return { ok: true, organizations: searchOrgs(body.query || "") };
  });

  // ── sync-drive-permissions (stub) ─────────────────────────
  app.post("/api/functions/sync-drive-permissions", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });
    return { ok: true, synced: true };
  });

  // ── normalize-structure (stub) ────────────────────────────
  app.post("/api/functions/normalize-structure", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });
    return { ok: true };
  });

  // ── repair-hierarchy (stub) ───────────────────────────────
  app.post("/api/functions/repair-hierarchy", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getSession(request);
    if (!session) return reply.code(401).send({ ok: false, error: "Unauthorized" });
    return { ok: true };
  });

  // ══════════════════════════════════════════════════════════
  // Public API endpoints (for docs viewer)
  // ══════════════════════════════════════════════════════════

  app.get("/api/organizations", async (request: FastifyRequest) => {
    const query = request.query as { "filters[slug][$eq]"?: string };
    const slug = query["filters[slug][$eq]"];
    if (slug) {
      const org = db.prepare("SELECT id, name, slug, domain, primary_color, secondary_color, accent_color, logo_url, custom_docs_domain FROM organizations WHERE slug = ?").get(slug);
      return { data: org ? [{ id: (org as any).id, attributes: org }] : [] };
    }
    return { data: [] };
  });

  // Catch-all for unmatched routes
  app.get("*", async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url;
    if (path.startsWith("/auth") || path.startsWith("/api") || path.startsWith("/github") || path.startsWith("/publish") || path.startsWith("/sync") || path.startsWith("/convert") || path.startsWith("/health")) {
      return reply.code(404).send({ ok: false, error: "Not found" });
    }
    return reply.code(404).send({ ok: false, error: "Not found" });
  });
}
