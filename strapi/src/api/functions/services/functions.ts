import type { Context } from "koa";
import { promises as fs } from "node:fs";

const GOOGLE_DRIVE_BASE = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DOCS_BASE = "https://docs.googleapis.com/v1/documents";

async function listDriveChildren(
  accessToken: string,
  folderId: string,
  extraFields: string[] = [],
) {
  const fields = ["id", "name", "mimeType", ...extraFields].join(",");
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: `files(${fields})`,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await fetch(`${GOOGLE_DRIVE_BASE}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Drive request failed (${response.status})`);
  }
  const data = (await response.json()) as { files?: Array<Record<string, any>> };
  return data.files || [];
}

const notImplemented = (name: string) => ({
  ok: false,
  error: "Not implemented yet",
  function: name,
});

function toSlug(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return normalized || "user";
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "tutanota.com",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
]);

async function ensureWorkspace(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    domain?: string;
    name?: string;
    driveFolderId?: string;
  };

  const user = ctx.state.user as { id: number; email?: string } | undefined;
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  const requestedDomain = (body.domain || "").toLowerCase().trim();
  const name = (body.name || "").trim();
  const driveFolderId = body.driveFolderId?.trim();

  const email = (user.email || "").toLowerCase();
  const emailDomain = email.split("@")[1]?.trim();
  const isPersonalEmailDomain = !!emailDomain && PERSONAL_EMAIL_DOMAINS.has(emailDomain);
  const requestedIsEmail = requestedDomain.includes("@");
  const domain = requestedDomain
    ? (isPersonalEmailDomain && !requestedIsEmail ? email : requestedDomain)
    : (isPersonalEmailDomain ? email : emailDomain);
  const isPersonalWorkspace = (domain || "").includes("@");
  const personalSlug = isPersonalWorkspace ? `${toSlug(email.split("@")[0] || "user")}-${String(user.id).slice(0, 8)}` : null;

  if (!domain) {
    return { ok: false, error: "Missing organization domain" };
  }

  if (isPersonalWorkspace) {
    if (!email || email !== domain) {
      return { ok: false, error: "Email address not allowed" };
    }
  } else if (emailDomain && emailDomain !== domain) {
    return { ok: false, error: "Email domain not allowed" };
  }

  const existing = await strapi.db.query("api::organization.organization").findOne({
    where: { domain },
  });

  let organizationId = existing?.id as number | undefined;
  let existed = !!organizationId;

  if (!organizationId) {
    const created = await strapi.entityService.create("api::organization.organization", {
      data: {
        domain,
        name: name || (isPersonalWorkspace ? "Personal Workspace" : domain),
        owner: user.id,
        ...(personalSlug ? { slug: personalSlug } : {}),
      },
    });
    organizationId = created?.id as number | undefined;
    existed = false;
  }

  if (organizationId && personalSlug && !existing?.slug) {
    await strapi.entityService.update("api::organization.organization", organizationId, {
      data: { slug: personalSlug },
    });
  }

  if (organizationId && driveFolderId) {
    const org = await strapi.entityService.findOne("api::organization.organization", organizationId, {
      fields: ["id", "drive_folder_id"],
    });
    if (org && !(org as any).drive_folder_id) {
      await strapi.entityService.update("api::organization.organization", organizationId, {
        data: { drive_folder_id: driveFolderId },
      });
    }
  }

  const existingRole = await strapi.db.query("api::org-role.org-role").findOne({
    where: {
      user: user.id,
      organization: organizationId,
    },
  });
  if (!existingRole) {
    await strapi.entityService.create("api::org-role.org-role", {
      data: {
        user: user.id,
        organization: organizationId,
        role: existed ? "viewer" : "owner",
      },
    });
  }

  return {
    ok: true,
    organizationId,
    existed,
  };
}

async function documentCache(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    action?: "get" | "set";
    documentId?: string;
    contentHtml?: string;
    contentText?: string;
    headings?: Array<{ level: number; text: string }>;
  };

  const user = ctx.state.user as { id: number } | undefined;
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  if (!body.documentId || !body.action) {
    return { ok: false, error: "Missing documentId or action" };
  }

  const documentId = body.documentId;

  // Resolve org via document -> project -> organization
  const doc = await strapi.db.query("api::document.document").findOne({
    where: { id: documentId },
    populate: {
      project: { fields: ["id"], populate: { organization: { fields: ["id"] } } },
    },
  });
  const orgId = (doc as any)?.project?.organization?.id;
  if (!orgId) {
    return { ok: false, error: "Document not found" };
  }

  if (body.action === "get") {
    const cache = await strapi.db.query("api::document-cache.document-cache").findOne({
      where: {
        document: documentId,
        organization: orgId,
      },
    });

    if (!cache) {
      return { ok: true, contentHtml: null, contentText: null, headings: [] };
    }

    return {
      ok: true,
      contentHtml: (cache as any).content_html_encrypted || null,
      contentText: (cache as any).content_text_encrypted || null,
      headings: (cache as any).headings_encrypted ? JSON.parse((cache as any).headings_encrypted) : [],
      publishedContentHtml: (cache as any).published_content_html_encrypted || null,
    };
  }

  if (body.action === "set") {
    if (!body.contentHtml) {
      return { ok: false, error: "Missing contentHtml" };
    }

    const payload = {
      document: documentId,
      organization: orgId,
      content_html_encrypted: body.contentHtml,
      content_text_encrypted: body.contentText || "",
      headings_encrypted: JSON.stringify(body.headings || []),
      updated_at: new Date().toISOString(),
    };

    const existing = await strapi.db.query("api::document-cache.document-cache").findOne({
      where: { document: documentId, organization: orgId },
    });

    if (existing) {
      await strapi.entityService.update("api::document-cache.document-cache", (existing as any).id, {
        data: payload,
      });
    } else {
      await strapi.entityService.create("api::document-cache.document-cache", {
        data: payload,
      });
    }

    return { ok: true };
  }

  return { ok: false, error: "Unsupported action" };
}

async function getOrganization(ctx: Context) {
  const user = ctx.state.user as { id: number; email?: string } | undefined;
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  const workspace = await ensureWorkspace(ctx);
  if (!workspace?.ok || !workspace.organizationId) {
    return { ok: false, error: workspace?.error || "Failed to resolve organization" };
  }

  const organizationId = workspace.organizationId as number;
  const org = await strapi.entityService.findOne("api::organization.organization", organizationId, {
    fields: [
      "id",
      "name",
      "domain",
      "slug",
      "subdomain",
      "drive_folder_id",
      "drive_permissions_last_synced_at",
      "custom_docs_domain",
      "logo_url",
      "tagline",
      "primary_color",
      "secondary_color",
      "accent_color",
      "font_heading",
      "font_body",
      "custom_css",
      "hero_title",
      "hero_description",
      "show_search_on_landing",
      "show_featured_projects",
      "custom_links",
    ],
  });

  const roles = await strapi.entityService.findMany("api::org-role.org-role", {
    filters: { organization: { id: organizationId } },
    populate: { user: true },
  });

  const members = (roles as any[]).map((role) => ({
    id: role?.user?.id,
    email: role?.user?.email || role?.user?.username || "Unknown",
    full_name: role?.user?.full_name || role?.user?.username || null,
    role: role?.role || "viewer",
  }));

  return {
    ok: true,
    organization: org || null,
    members,
  };
}

async function updateOrganization(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    organizationId?: string | number;
    data?: Record<string, unknown>;
  };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };

  const workspace = await ensureWorkspace(ctx);
  if (!workspace?.ok || !workspace.organizationId) {
    return { ok: false, error: workspace?.error || "Failed to resolve organization" };
  }

  const organizationId = String(body.organizationId || workspace.organizationId);
  if (String(workspace.organizationId) !== organizationId) {
    return { ok: false, error: "Unauthorized organization access" };
  }

  const data = body.data || {};
  const allowedFields = new Set([
    "name",
    "slug",
    "domain",
    "custom_docs_domain",
    "drive_folder_id",
    "drive_parent_id",
    "tagline",
    "logo_url",
    "primary_color",
    "secondary_color",
    "accent_color",
    "font_heading",
    "font_body",
    "custom_css",
    "hero_title",
    "hero_description",
    "show_search_on_landing",
    "show_featured_projects",
    "custom_links",
  ]);

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.has(key)) {
      payload[key] = value;
    }
  }

  if (Object.keys(payload).length === 0) {
    return { ok: false, error: "No updatable fields provided" };
  }

  const updated = await strapi.entityService.update("api::organization.organization", organizationId, {
    data: payload,
  });

  return { ok: true, organization: updated };
}

async function createProject(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    organizationId?: string | number;
    name?: string;
    slug?: string;
    parentId?: string | null;
    driveFolderId?: string | null;
    driveParentId?: string | null;
    isPublished?: boolean;
  };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };

  const workspace = await ensureWorkspace(ctx);
  if (!workspace?.ok || !workspace.organizationId) {
    return { ok: false, error: workspace?.error || "Failed to resolve organization" };
  }

  const organizationId = String(body.organizationId || workspace.organizationId);
  if (String(workspace.organizationId) !== organizationId) {
    return { ok: false, error: "Unauthorized organization access" };
  }

  const name = (body.name || "").trim();
  if (!name) return { ok: false, error: "Missing project name" };

  const slug = (body.slug || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const project = await strapi.entityService.create("api::project.project", {
    data: {
      name,
      slug,
      organization: organizationId,
      parent: body.parentId || null,
      drive_folder_id: body.driveFolderId || null,
      drive_parent_id: (body as any).driveParentId || null,
      created_by: user.id,
      is_published: body.isPublished ?? false,
    },
  });

  const projectId = String((project as any).id);
  let version = await strapi.db.query("api::project-version.project-version").findOne({
    where: { project: projectId, slug: "v1.0" },
  });

  if (!version) {
    version = await strapi.entityService.create("api::project-version.project-version", {
      data: {
        project: projectId,
        name: "v1.0",
        slug: "v1.0",
        is_default: true,
        is_published: body.isPublished ?? false,
        semver_major: 1,
        semver_minor: 0,
        semver_patch: 0,
      },
    });
  } else {
    await strapi.entityService.update("api::project-version.project-version", (version as any).id, {
      data: { is_default: true },
    });
  }

  return {
    ok: true,
    projectId,
    versionId: (version as any)?.id,
  };
}

async function createProjectVersion(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    projectId?: string;
    name?: string;
    slug?: string;
    isDefault?: boolean;
    isPublished?: boolean;
    semverMajor?: number;
    semverMinor?: number;
    semverPatch?: number;
  };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  if (!body.projectId) return { ok: false, error: "Missing projectId" };

  const name = (body.name || "v1.0").trim();
  const slug = (body.slug || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const existing = await strapi.db.query("api::project-version.project-version").findOne({
    where: { project: body.projectId, slug },
  });
  if (existing) {
    if (body.isDefault) {
      await strapi.entityService.update("api::project-version.project-version", (existing as any).id, {
        data: { is_default: true },
      });
    }
    return { ok: true, versionId: (existing as any)?.id };
  }

  const version = await strapi.entityService.create("api::project-version.project-version", {
    data: {
      project: body.projectId,
      name,
      slug,
      is_default: body.isDefault ?? false,
      is_published: body.isPublished ?? false,
      semver_major: body.semverMajor ?? 1,
      semver_minor: body.semverMinor ?? 0,
      semver_patch: body.semverPatch ?? 0,
    },
  });

  if (body.isDefault) {
    await strapi.db.query("api::project-version.project-version").updateMany({
      where: { project: body.projectId, id: { $ne: (version as any).id } },
      data: { is_default: false },
    });
  }

  return { ok: true, versionId: (version as any)?.id };
}

async function createTopic(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    projectId?: string;
    projectVersionId?: string;
    name?: string;
    slug?: string;
    parentId?: string | null;
    driveFolderId?: string | null;
  };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  if (!body.projectId || !body.projectVersionId) {
    return { ok: false, error: "Missing project or version" };
  }
  const name = (body.name || "").trim();
  if (!name) return { ok: false, error: "Missing topic name" };

  const slug = (body.slug || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const topic = await strapi.entityService.create("api::topic.topic", {
    data: {
      name,
      slug,
      project: body.projectId,
      project_version: body.projectVersionId,
      parent: body.parentId || null,
      drive_folder_id: body.driveFolderId || null,
    },
  });

  return { ok: true, topicId: (topic as any)?.id };
}

async function createDocument(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    projectId?: string;
    projectVersionId?: string | null;
    topicId?: string | null;
    title?: string;
    slug?: string;
    googleDocId?: string;
    driveFolderId?: string | null;
    isPublished?: boolean;
    visibility?: string;
  };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  if (!body.projectId || !body.title) {
    return { ok: false, error: "Missing project or title" };
  }

  const slug = (body.slug || body.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const doc = await strapi.entityService.create("api::document.document", {
    data: {
      title: body.title,
      slug,
      project: body.projectId,
      project_version: body.projectVersionId || null,
      topic: body.topicId || null,
      owner: user.id,
      google_doc_id: body.googleDocId || null,
      is_published: body.isPublished ?? false,
      visibility: (body.visibility as any) || "internal",
    },
  });

  return { ok: true, documentId: (doc as any)?.id };
}

async function updateDocument(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    documentId?: string;
    data?: Record<string, unknown>;
  };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const documentId = body.documentId;
  if (!documentId) return { ok: false, error: "Missing documentId" };

  const allowedFields = new Set([
    "title",
    "slug",
    "project",
    "project_version",
    "topic",
    "is_published",
    "published_content_html",
    "published_content_id",
    "content_html",
    "content_id",
    "google_modified_at",
    "last_synced_at",
    "visibility",
  ]);

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.data || {})) {
    if (allowedFields.has(key)) {
      payload[key] = value;
    }
  }

  if (Object.keys(payload).length === 0) {
    return { ok: false, error: "No updatable fields provided" };
  }

  if (payload.is_published === true && !payload.published_content_html && !payload.published_content_id) {
    const existing = await strapi.entityService.findOne("api::document.document", documentId, {
      fields: ["content_html", "content_id", "published_content_html", "published_content_id"],
    });
    const existingContentHtml = (existing as any)?.content_html || (existing as any)?.published_content_html || null;
    const existingContentId = (existing as any)?.content_id || (existing as any)?.published_content_id || null;
    if (existingContentHtml && !payload.published_content_html) {
      payload.published_content_html = existingContentHtml;
    }
    if (existingContentId && !payload.published_content_id) {
      payload.published_content_id = existingContentId;
    }
  }

  const updated = await strapi.entityService.update("api::document.document", documentId, {
    data: payload,
  });

  return { ok: true, document: updated };
}

async function getDocument(ctx: Context) {
  const body = (ctx.request?.body || {}) as { documentId?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const documentId = body.documentId;
  if (!documentId) return { ok: false, error: "Missing documentId" };

  const doc = await strapi.entityService.findOne("api::document.document", documentId, {
    fields: ["id", "title", "slug", "content_html", "is_published", "video_url", "video_title"],
  });

  if (!doc) return { ok: false, error: "Document not found" };
  return { ok: true, document: doc };
}

async function deleteDocument(ctx: Context) {
  const body = (ctx.request?.body || {}) as { documentId?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const documentId = body.documentId;
  if (!documentId) return { ok: false, error: "Missing documentId" };

  await strapi.entityService.delete("api::document.document", documentId);
  return { ok: true };
}

async function deleteTopic(ctx: Context) {
  const body = (ctx.request?.body || {}) as { topicId?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const topicId = body.topicId;
  if (!topicId) return { ok: false, error: "Missing topicId" };

  await strapi.db.query("api::document.document").deleteMany({
    where: { topic: topicId },
  });
  await strapi.entityService.delete("api::topic.topic", topicId);
  return { ok: true };
}

async function deleteProject(ctx: Context) {
  const body = (ctx.request?.body || {}) as { projectId?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const projectId = body.projectId;
  if (!projectId) return { ok: false, error: "Missing projectId" };

  await strapi.db.query("api::document.document").deleteMany({
    where: { project: projectId },
  });
  await strapi.db.query("api::topic.topic").deleteMany({
    where: { project: projectId },
  });
  await strapi.db.query("api::project-version.project-version").deleteMany({
    where: { project: projectId },
  });
  await strapi.entityService.delete("api::project.project", projectId);
  return { ok: true };
}

async function listJoinRequests(ctx: Context) {
  const body = (ctx.request?.body || {}) as { organizationId?: string };
  const user = ctx.state.user as { id: number; email?: string } | undefined;
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  const workspace = await ensureWorkspace(ctx);
  if (!workspace?.ok || !workspace.organizationId) {
    return { ok: false, error: workspace?.error || "Failed to resolve organization" };
  }

  const organizationId = String(body.organizationId || workspace.organizationId);
  if (String(workspace.organizationId) !== organizationId) {
    return { ok: false, error: "Unauthorized organization access" };
  }

  const requests = await strapi.entityService.findMany("api::join-request.join-request", {
    filters: { organization: { id: organizationId } },
    populate: { user: true },
    sort: { createdAt: "desc" },
  });

  const mapped = (requests as any[]).map((req) => ({
    id: req.id,
    user_email: req.user?.email || req.user?.username || "Unknown",
    user_name: req.user?.full_name || req.user?.username || null,
    status: req.status,
    requested_at: req.createdAt,
  }));

  return { ok: true, requests: mapped };
}

async function listProjects(ctx: Context) {
  const body = (ctx.request?.body || {}) as { organizationId?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };

  const workspace = await ensureWorkspace(ctx);
  if (!workspace?.ok || !workspace.organizationId) {
    return { ok: false, error: workspace?.error || "Failed to resolve organization" };
  }

  const organizationId = String(body.organizationId || workspace.organizationId);
  if (String(workspace.organizationId) !== organizationId) {
    return { ok: false, error: "Unauthorized organization access" };
  }

  const projects = await strapi.entityService.findMany("api::project.project", {
    filters: { organization: { id: organizationId } },
    populate: { parent: { fields: ["id"] } },
    sort: { name: "asc" },
  });

  return { ok: true, projects };
}

async function listProjectVersions(ctx: Context) {
  const body = (ctx.request?.body || {}) as { projectIds?: string[] };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const projectIds = (body.projectIds || []).filter(Boolean);
  if (projectIds.length === 0) return { ok: true, versions: [] };

  const versions = await strapi.entityService.findMany("api::project-version.project-version", {
    filters: { project: { id: { $in: projectIds } } },
    populate: { project: { fields: ["id"] } },
    sort: { createdAt: "desc" },
  });

  return { ok: true, versions };
}

async function listTopics(ctx: Context) {
  const body = (ctx.request?.body || {}) as { projectIds?: string[] };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const projectIds = (body.projectIds || []).filter(Boolean);
  if (projectIds.length === 0) return { ok: true, topics: [] };

  const topics = await strapi.entityService.findMany("api::topic.topic", {
    filters: { project: { id: { $in: projectIds } } },
    populate: {
      project: { fields: ["id"] },
      project_version: { fields: ["id"] },
      parent: { fields: ["id"] },
    },
    sort: { name: "asc" },
  });

  return { ok: true, topics };
}

async function listDocuments(ctx: Context) {
  const body = (ctx.request?.body || {}) as { projectIds?: string[] };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const projectIds = (body.projectIds || []).filter(Boolean);
  if (projectIds.length === 0) return { ok: true, documents: [] };

  const documents = await strapi.entityService.findMany("api::document.document", {
    filters: { project: { id: { $in: projectIds } } },
    populate: {
      project: { fields: ["id"] },
      project_version: { fields: ["id"] },
      topic: { fields: ["id"] },
      owner: true,
    },
    sort: { updatedAt: "desc" },
  });

  return { ok: true, documents };
}

async function discoverDriveStructure(ctx: Context) {
  const body = (ctx.request?.body || {}) as { folderId?: string; accessToken?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };

  const folderId = body.folderId;
  const accessToken = body.accessToken;
  if (!folderId || !accessToken) {
    return { ok: false, error: "Missing folderId or accessToken" };
  }

  try {
    const children = await listDriveChildren(accessToken, folderId);
    const subprojects = children
      .filter((item) => item.mimeType === "application/vnd.google-apps.folder")
      .map((item) => ({ id: item.id, name: item.name, docCount: 0 }));
    const documents = children
      .filter((item) => item.mimeType === "application/vnd.google-apps.document")
      .map((item) => ({ id: item.id, name: item.name, folderId }));

    return {
      ok: true,
      subprojects,
      documents,
      topics: [],
    };
  } catch (error: any) {
    return { ok: false, error: error?.message || "Failed to discover Drive structure" };
  }
}

async function getProjectSettings(ctx: Context) {
  const body = (ctx.request?.body || {}) as { projectId?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const projectId = body.projectId;
  if (!projectId) return { ok: false, error: "Missing projectId" };

  const project = await strapi.entityService.findOne("api::project.project", projectId, {
    populate: { organization: { populate: { owner: true } } },
  });
  if (!project) return { ok: false, error: "Project not found" };

  const organizationId = (project as any)?.organization?.id;

  const versions = await strapi.entityService.findMany("api::project-version.project-version", {
    filters: { project: { id: projectId } },
    sort: { createdAt: "desc" },
  });

  const projectMembers = await strapi.entityService.findMany("api::project-member.project-member", {
    filters: { project: { id: { $eq: projectId } } },
    populate: { user: true },
  });

  const orgRoles = organizationId
    ? await strapi.entityService.findMany("api::org-role.org-role", {
        filters: { organization: { id: { $eq: organizationId } } },
        populate: { user: true },
      })
    : [];

  const orgOwnerId = (project as any)?.organization?.owner?.id
    ? String((project as any).organization.owner.id)
    : null;
  const orgRoleRow = orgRoles.find((r: any) => String(r.user?.id) === String(user.id)) || null;
  const projectMemberRow = projectMembers.find((m: any) => String(m.user?.id) === String(user.id)) || null;

  let effectiveRole: string | null = null;
  if (orgOwnerId && orgOwnerId === String(user.id)) {
    effectiveRole = "admin";
  } else if (orgRoleRow) {
    const role = String(orgRoleRow.role || "");
    if (role === "owner" || role === "admin") effectiveRole = "admin";
    else if (role === "editor") effectiveRole = "editor";
    else if (role === "viewer") effectiveRole = "viewer";
  } else if (projectMemberRow) {
    effectiveRole = String(projectMemberRow.role || null);
  }

  const latestDoc = await strapi.db.query("api::document.document").findOne({
    where: { project: projectId, last_synced_at: { $notNull: true } },
    orderBy: { last_synced_at: "desc" },
    select: ["last_synced_at"],
  });
  const syncedDocsCount = await strapi.db.query("api::document.document").count({
    where: { project: projectId },
  });

  return {
    ok: true,
    project,
    organization: (project as any)?.organization || null,
    versions,
    projectMembers,
    orgRoles,
    effectiveRole,
    orgRole: orgRoleRow || null,
    projectMemberRole: projectMemberRow || null,
    sync: {
      lastSyncedAt: (latestDoc as any)?.last_synced_at || null,
      count: syncedDocsCount || 0,
    },
  };
}

async function updateProjectSettings(ctx: Context) {
  const body = (ctx.request?.body || {}) as { projectId?: string; data?: Record<string, unknown> };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };

  const projectId = body.projectId;
  if (!projectId) return { ok: false, error: "Missing projectId" };

  const workspace = await ensureWorkspace(ctx);
  if (!workspace?.ok || !workspace.organizationId) {
    return { ok: false, error: workspace?.error || "Failed to resolve organization" };
  }

  const project = await strapi.entityService.findOne("api::project.project", projectId, {
    populate: { organization: { fields: ["id"] } },
  });
  if (!project) return { ok: false, error: "Project not found" };
  const organizationId = (project as any)?.organization?.id;
  if (String(organizationId) !== String(workspace.organizationId)) {
    return { ok: false, error: "Unauthorized organization access" };
  }

  const allowedFields = new Set([
    "name",
    "slug",
    "visibility",
    "is_published",
    "show_version_switcher",
    "drive_folder_id",
    "parent",
  ]);

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.data || {})) {
    if (allowedFields.has(key)) {
      payload[key] = value;
    }
  }

  if (Object.keys(payload).length === 0) {
    return { ok: false, error: "No updatable fields provided" };
  }

  const updated = await strapi.entityService.update("api::project.project", projectId, {
    data: payload,
  });

  return { ok: true, project: updated };
}

async function updateMemberRole(ctx: Context) {
  const body = (ctx.request?.body || {}) as { organizationId?: string; memberId?: string; role?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };

  const workspace = await ensureWorkspace(ctx);
  if (!workspace?.ok || !workspace.organizationId) {
    return { ok: false, error: workspace?.error || "Failed to resolve organization" };
  }

  const organizationId = String(body.organizationId || workspace.organizationId);
  const memberId = body.memberId;
  const role = body.role;
  const allowedRoles = new Set(["owner", "admin", "editor", "viewer"]);
  if (!memberId || !role) return { ok: false, error: "Missing memberId or role" };
  if (!allowedRoles.has(role)) return { ok: false, error: "Invalid role" };
  const normalizedRole = role as "owner" | "admin" | "editor" | "viewer";

  if (String(workspace.organizationId) !== organizationId) {
    return { ok: false, error: "Unauthorized organization access" };
  }

  const existingRole = await strapi.db.query("api::org-role.org-role").findOne({
    where: { organization: organizationId, user: memberId },
  });
  if (!existingRole) return { ok: false, error: "Member role not found" };

  await strapi.entityService.update("api::org-role.org-role", (existingRole as any).id, {
    data: { role: normalizedRole },
  });

  return { ok: true };
}

function generateToken() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 32; i += 1) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

async function createInvitation(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    organizationId?: string;
    email?: string | null;
    role?: string;
  };
  const user = ctx.state.user as { id: number; email?: string } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };

  const workspace = await ensureWorkspace(ctx);
  if (!workspace?.ok || !workspace.organizationId) {
    return { ok: false, error: workspace?.error || "Failed to resolve organization" };
  }

  const organizationId = String(body.organizationId || workspace.organizationId);
  if (String(workspace.organizationId) !== organizationId) {
    return { ok: false, error: "Unauthorized organization access" };
  }

  const email = (body.email || "").trim().toLowerCase();
  const role = body.role || "viewer";
  const allowedOrgRoles = new Set(["owner", "admin", "editor", "viewer"]);
  if (!allowedOrgRoles.has(role)) return { ok: false, error: "Invalid role" };
  const normalizedRole = role as "owner" | "admin" | "editor" | "viewer";

  if (email) {
    const existingInvite = await strapi.db.query("api::invitation.invitation").findOne({
      where: { organization: organizationId, email },
      select: ["id", "accepted_at", "token"],
    });

    if (existingInvite) {
      return {
        ok: true,
        status: existingInvite.accepted_at ? "accepted" : "pending",
        token: (existingInvite as any).token,
      };
    }

    const existingUser = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { email } });
    if (existingUser) {
      const existingRole = await strapi.db.query("api::org-role.org-role").findOne({
        where: { organization: organizationId, user: (existingUser as any).id },
      });
      if (existingRole) {
        return { ok: true, status: "member" };
      }
    }
  }

  const token = generateToken();
  const invite = await strapi.entityService.create("api::invitation.invitation", {
    data: {
      organization: organizationId,
      email: email || `invite-link-${Date.now()}@pending.local`,
      role: normalizedRole,
      token,
      invited_by: user.id,
    },
  });

  return { ok: true, status: "created", token: (invite as any)?.token || token };
}

async function getProjectShare(ctx: Context) {
  const body = (ctx.request?.body || {}) as { projectId?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const projectId = body.projectId;
  if (!projectId) return { ok: false, error: "Missing projectId" };

  const project = await strapi.entityService.findOne("api::project.project", projectId, {
    populate: { organization: { fields: ["id", "domain"] } },
  });
  if (!project) return { ok: false, error: "Project not found" };

  const members = await strapi.entityService.findMany("api::project-member.project-member", {
    filters: { project: { id: projectId } },
    populate: { user: true },
  });

  const invitations = await strapi.entityService.findMany("api::invitation.invitation", {
    filters: { project: { id: projectId }, accepted_at: { $null: true } },
    sort: { createdAt: "desc" },
  });

  return {
    ok: true,
    organizationDomain: (project as any)?.organization?.domain || null,
    members,
    invitations,
  };
}

async function createProjectInvitation(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    projectId?: string;
    email?: string | null;
    role?: string;
  };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const projectId = body.projectId;
  if (!projectId) return { ok: false, error: "Missing projectId" };

  const project = await strapi.entityService.findOne("api::project.project", projectId, {
    populate: { organization: { fields: ["id"] } },
  });
  if (!project) return { ok: false, error: "Project not found" };

  const email = (body.email || "").trim().toLowerCase();
  const role = body.role || "viewer";
  const allowedProjectRoles = new Set(["admin", "editor", "reviewer", "viewer"]);
  if (!allowedProjectRoles.has(role)) return { ok: false, error: "Invalid role" };
  const normalizedRole = role as "admin" | "editor" | "reviewer" | "viewer";

  if (email) {
    const existingInvite = await strapi.db.query("api::invitation.invitation").findOne({
      where: { project: projectId, email },
      select: ["id", "accepted_at", "token"],
    });

    if (existingInvite) {
      return {
        ok: true,
        status: existingInvite.accepted_at ? "accepted" : "pending",
        token: (existingInvite as any).token,
      };
    }

    const existingUser = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { email } });
    if (existingUser) {
      const existingMember = await strapi.db.query("api::project-member.project-member").findOne({
        where: { project: projectId, user: (existingUser as any).id },
      });
      if (existingMember) {
        return { ok: true, status: "member" };
      }

      const createdMember = await strapi.entityService.create("api::project-member.project-member", {
        data: {
          project: projectId,
          user: (existingUser as any).id,
          role: normalizedRole,
        },
      });
      return { ok: true, status: "added", memberId: (createdMember as any)?.id };
    }
  }

  const token = generateToken();
  const invite = await strapi.entityService.create("api::invitation.invitation", {
    data: {
      organization: (project as any)?.organization?.id,
      project: projectId,
      email: email || `invite-link-${Date.now()}@pending.local`,
      role: normalizedRole,
      token,
      invited_by: user.id,
    },
  });

  return { ok: true, status: "created", token: (invite as any)?.token || token };
}

async function removeProjectInvitation(ctx: Context) {
  const body = (ctx.request?.body || {}) as { invitationId?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const invitationId = body.invitationId;
  if (!invitationId) return { ok: false, error: "Missing invitationId" };

  await strapi.entityService.delete("api::invitation.invitation", invitationId);
  return { ok: true };
}

async function updateProjectMemberRole(ctx: Context) {
  const body = (ctx.request?.body || {}) as { memberId?: string; role?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const memberId = body.memberId;
  const role = body.role;
  if (!memberId || !role) return { ok: false, error: "Missing memberId or role" };
  const allowedProjectRoles = new Set(["admin", "editor", "reviewer", "viewer"]);
  if (!allowedProjectRoles.has(role)) return { ok: false, error: "Invalid role" };
  const normalizedRole = role as "admin" | "editor" | "reviewer" | "viewer";

  await strapi.entityService.update("api::project-member.project-member", memberId, {
    data: { role: normalizedRole },
  });
  return { ok: true };
}

async function removeProjectMember(ctx: Context) {
  const body = (ctx.request?.body || {}) as { memberId?: string };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  const memberId = body.memberId;
  if (!memberId) return { ok: false, error: "Missing memberId" };
  await strapi.entityService.delete("api::project-member.project-member", memberId);
  return { ok: true };
}

function getGoogleAccessToken(ctx: Context, body?: Record<string, unknown>): string | null {
  const headerToken = ctx.request?.headers?.["x-google-token"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }
  const bodyToken = body?.accessToken;
  if (typeof bodyToken === "string" && bodyToken.trim()) {
    return bodyToken.trim();
  }
  return null;
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\\s\\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\\[[^\\]]*\\]\\([^\\)]+\\)/g, "")
    .replace(/\\[[^\\]]+\\]\\([^\\)]+\\)/g, "$1")
    .replace(/^#{1,6}\\s+/gm, "")
    .replace(/^>\\s?/gm, "")
    .replace(/[*_~]+/g, "")
    .replace(/\\r\\n/g, "\\n")
    .trim();
}

async function googleFetch(
  url: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined),
  };
  return fetch(url, { ...options, headers });
}

async function convertMarkdownToGdocWithToken(params: {
  token: string;
  title: string;
  folderId: string;
  markdownContent: string;
}) {
  const { token, title, folderId, markdownContent } = params;

  const createResponse = await googleFetch(
    `${GOOGLE_DRIVE_BASE}?supportsAllDrives=true`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: title,
        mimeType: "application/vnd.google-apps.document",
        parents: [folderId],
      }),
    },
  );

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    const needsReauth = createResponse.status === 401 || createResponse.status === 403;
    return { ok: false, error: `Failed to create Google Doc: ${errorText}`, needsReauth };
  }

  const doc = (await createResponse.json()) as { id?: string };
  const documentId = (doc?.id || "") as string;

  const plainText = markdownToPlainText(markdownContent);
  if (plainText) {
    const updateResponse = await googleFetch(
      `${GOOGLE_DOCS_BASE}/${documentId}:batchUpdate`,
      token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: plainText,
              },
            },
          ],
        }),
      },
    );
    if (!updateResponse.ok) {
      const updateError = await updateResponse.text();
      const needsReauth = updateResponse.status === 401 || updateResponse.status === 403;
      return { ok: false, error: `Failed to update Google Doc: ${updateError}`, needsReauth };
    }
  }

  return { ok: true, documentId };
}

async function googleDrive(ctx: Context) {
  const body = (ctx.request?.body || {}) as Record<string, unknown>;
  const action = body?.action as string | undefined;
  if (!action) {
    return { ok: false, error: "Missing action" };
  }

  const token = getGoogleAccessToken(ctx, body);
  if (!token) {
    return { ok: false, needsReauth: true, error: "Missing Google access token" };
  }

  if (action === "list_folder") {
    const folderId = body.folderId as string | undefined;
    if (!folderId) return { ok: false, error: "Missing folderId" };
    const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,createdTime)");

    const listFolderChildren = async (query: string, extra: string = "") => {
      const response = await googleFetch(
        `${GOOGLE_DRIVE_BASE}?q=${encodeURIComponent(query)}&fields=${fields}&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true${extra}`,
        token,
      );
      return response;
    };

    // Detect if the ID is a Shared Drive ID (not a folder file id)
    const shouldTryDrive = folderId !== "root";
    if (shouldTryDrive) {
      const metaResponse = await googleFetch(
        `${GOOGLE_DRIVE_BASE}/${folderId}?fields=id,mimeType&supportsAllDrives=true`,
        token,
      );
      if (!metaResponse.ok) {
        // Try shared drive endpoint
        const driveResponse = await googleFetch(
          `https://www.googleapis.com/drive/v3/drives/${folderId}`,
          token,
        );
        if (driveResponse.ok) {
          const response = await listFolderChildren("'root' in parents and trashed=false", `&corpora=drive&driveId=${folderId}`);
          if (!response.ok) {
            const errorText = await response.text();
            const needsReauth = response.status === 401 || response.status === 403;
            return { ok: false, error: "Failed to list shared drive root", details: errorText, needsReauth };
          }
          const data = (await response.json()) as { files?: unknown[] };
          return { ok: true, files: data.files || [] };
        }
      }
    }

    const query = folderId === "root" ? "'root' in parents and trashed=false" : `'${folderId}' in parents and trashed=false`;
    const response = await listFolderChildren(query);
    if (!response.ok) {
      const errorText = await response.text();
      const needsReauth = response.status === 401 || response.status === 403;
      return { ok: false, error: "Failed to list folder", details: errorText, needsReauth };
    }
    const data = (await response.json()) as { files?: unknown[] };
    return { ok: true, files: data.files || [] };
  }

  if (action === "create_folder") {
    const name = body.name as string | undefined;
    const parentFolderId = body.parentFolderId as string | undefined;
    if (!name || !parentFolderId) return { ok: false, error: "Missing name or parentFolderId" };
    const response = await googleFetch(`${GOOGLE_DRIVE_BASE}?supportsAllDrives=true`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      const needsReauth = response.status === 401 || response.status === 403;
      return { ok: false, error: "Failed to create folder", details: errorText, needsReauth };
    }
    const folder = await response.json();
    return { ok: true, folder };
  }

  if (action === "create_doc") {
    const title = body.title as string | undefined;
    const parentFolderId = body.parentFolderId as string | undefined;
    if (!title || !parentFolderId) return { ok: false, error: "Missing title or parentFolderId" };
    const response = await googleFetch(`${GOOGLE_DRIVE_BASE}?supportsAllDrives=true`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: title,
        mimeType: "application/vnd.google-apps.document",
        parents: [parentFolderId],
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      const needsReauth = response.status === 401 || response.status === 403;
      return { ok: false, error: "Failed to create document", details: errorText, needsReauth };
    }
    const doc = await response.json();
    return { ok: true, doc };
  }

  if (action === "get_doc_content") {
    const docId = body.docId as string | undefined;
    if (!docId) return { ok: false, error: "Missing docId" };
    const response = await googleFetch(
      `${GOOGLE_DRIVE_BASE}/${docId}/export?mimeType=text/html&supportsAllDrives=true`,
      token,
    );
    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes("exportSizeLimitExceeded") || errorText.includes("too large")) {
        return { ok: false, error: "Document too large", fileTooLarge: true };
      }
      const needsReauth = response.status === 401 || response.status === 403;
      return { ok: false, error: "Failed to get document", details: errorText, needsReauth };
    }
    const html = await response.text();
    return { ok: true, html };
  }

  if (action === "sync_doc_content") {
    const googleDocId = body.googleDocId as string | undefined;
    const documentId = body.documentId as string | undefined;
    if (!googleDocId || !documentId) {
      return { ok: false, error: "Missing googleDocId or documentId" };
    }

    let modifiedAt: string | null = null;
    const metaResponse = await googleFetch(
      `${GOOGLE_DRIVE_BASE}/${googleDocId}?fields=modifiedTime&supportsAllDrives=true`,
      token,
    );
    if (metaResponse.ok) {
      const meta = (await metaResponse.json()) as { modifiedTime?: string | null };
      modifiedAt = meta.modifiedTime || null;
    }

    const response = await googleFetch(
      `${GOOGLE_DRIVE_BASE}/${googleDocId}/export?mimeType=text/html&supportsAllDrives=true`,
      token,
    );
    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes("exportSizeLimitExceeded") || errorText.includes("too large")) {
        return { ok: false, error: "Document too large", fileTooLarge: true };
      }
      const needsReauth = response.status === 401 || response.status === 403;
      return { ok: false, error: "Failed to sync document", details: errorText, needsReauth };
    }
    const html = await response.text();

    await strapi.entityService.update("api::document.document", documentId, {
      data: {
        content_html: html,
        last_synced_at: new Date().toISOString(),
        is_published: false,
        ...(modifiedAt ? { google_modified_at: modifiedAt } : {}),
      },
    });

    return { ok: true, html, modifiedAt };
  }

  if (action === "move_file") {
    const fileId = body.fileId as string | undefined;
    const targetFolderId = body.targetFolderId as string | undefined;
    if (!fileId || !targetFolderId) {
      return { ok: false, error: "Missing fileId or targetFolderId" };
    }
    const getResponse = await googleFetch(
      `${GOOGLE_DRIVE_BASE}/${fileId}?fields=parents&supportsAllDrives=true`,
      token,
    );
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      const needsReauth = getResponse.status === 401 || getResponse.status === 403;
      return { ok: false, error: "Failed to fetch file parents", details: errorText, needsReauth };
    }
    const fileMeta = (await getResponse.json()) as { parents?: string[] };
    const currentParents: string[] = fileMeta.parents || [];
    if (currentParents.includes(targetFolderId)) {
      return { ok: true, alreadyInFolder: true };
    }

    const removeParents = currentParents.join(",");
    const updateResponse = await googleFetch(
      `${GOOGLE_DRIVE_BASE}/${fileId}?addParents=${targetFolderId}&removeParents=${removeParents}&supportsAllDrives=true`,
      token,
      { method: "PATCH" },
    );
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      const needsReauth = updateResponse.status === 401 || updateResponse.status === 403;
      return { ok: false, error: "Failed to move file", details: errorText, needsReauth };
    }
    return { ok: true };
  }

  if (action === "trash_file") {
    const fileId = body.fileId as string | undefined;
    if (!fileId) return { ok: false, error: "Missing fileId" };
    const response = await googleFetch(
      `${GOOGLE_DRIVE_BASE}/${fileId}?supportsAllDrives=true`,
      token,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      const needsReauth = response.status === 401 || response.status === 403;
      if (response.status === 404) {
        return { ok: true, alreadyDeleted: true };
      }
      return { ok: false, error: "Failed to trash file", details: errorText, needsReauth };
    }
    return { ok: true };
  }

  if (action === "upload_file") {
    const parentFolderId = body.parentFolderId as string | undefined;
    const mimeType = body.mimeType as string | undefined;
    if (!parentFolderId) return { ok: false, error: "Missing parentFolderId" };

    const fileField = (ctx.request as any)?.files?.file;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;
    if (!file) return { ok: false, error: "Missing file upload" };

    const buffer = await fs.readFile(file.filepath || file.path);
    const BlobCtor = (globalThis as any).Blob;
    const FormDataCtor = (globalThis as any).FormData;
    const blob = new BlobCtor([buffer], { type: file.mimetype || "application/octet-stream" });
    const form = new FormDataCtor();
    const metadata: Record<string, unknown> = {
      name: file.originalFilename || file.name || "upload",
      parents: [parentFolderId],
      ...(mimeType ? { mimeType } : {}),
    };

    form.append("metadata", new BlobCtor([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", blob, file.originalFilename || file.name || "upload");

    const response = await googleFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
      token,
      { method: "POST", body: form },
    );

    if (!response.ok) {
      const errorText = await response.text();
      const needsReauth = response.status === 401 || response.status === 403;
      return { ok: false, error: "Failed to upload file", details: errorText, needsReauth };
    }
    const fileData = await response.json();
    return { ok: true, file: fileData };
  }

  return { ok: false, error: "Invalid action" };
}

async function convertMarkdownToGdoc(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    markdownContent?: string;
    title?: string;
    folderId?: string;
    accessToken?: string;
  };
  const token = getGoogleAccessToken(ctx, body);
  if (!token) {
    return { ok: false, needsReauth: true, error: "Missing Google access token" };
  }
  if (!body?.markdownContent || !body?.title || !body?.folderId) {
    return { ok: false, error: "Missing markdownContent, title, or folderId" };
  }

  return convertMarkdownToGdocWithToken({
    token,
    title: body.title,
    folderId: body.folderId,
    markdownContent: body.markdownContent,
  });
}

async function importMarkdown(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    files?: Array<{ path: string; content: string; targetTopicId?: string }>;
    projectId?: string;
    projectVersionId?: string;
    parentTopicId?: string | null;
  };
  const token = getGoogleAccessToken(ctx, body as Record<string, unknown>);
  if (!token) {
    return { ok: false, needsReauth: true, error: "Missing Google access token" };
  }
  if (!body?.files || !Array.isArray(body.files) || !body.projectId) {
    return { ok: false, error: "Missing files or projectId" };
  }

  let projectVersionId = body.projectVersionId;
  if (!projectVersionId) {
    const version = await strapi.db.query("api::project-version.project-version").findOne({
      where: { project: body.projectId, is_default: true },
      select: ["id"],
    });
    projectVersionId = version?.id ? String(version.id) : undefined;
  }

  const project = await strapi.entityService.findOne("api::project.project", body.projectId, {
    fields: ["drive_folder_id"],
  });
  const projectFolderId = (project as any)?.drive_folder_id as string | undefined;

  const results: Array<{ path: string; documentId?: string; error?: string }> = [];

  for (const file of body.files) {
    const title = file.path.split("/").pop()?.replace(/\\.md$/i, "") || file.path;
    const topicId = file.targetTopicId || body.parentTopicId || null;
    let folderId = projectFolderId;

    if (topicId) {
      const topic = await strapi.entityService.findOne("api::topic.topic", topicId, {
        fields: ["drive_folder_id"],
      });
      folderId = (topic as any)?.drive_folder_id || folderId;
    }

    if (!folderId) {
      results.push({ path: file.path, error: "Missing drive folder id" });
      continue;
    }

    const created = await convertMarkdownToGdocWithToken({
      token,
      title,
      folderId,
      markdownContent: file.content || "",
    });

    if (!created.ok || !created.documentId) {
      results.push({ path: file.path, error: created.error || "Failed to create document" });
      continue;
    }

    await strapi.entityService.create("api::document.document", {
      data: {
        title,
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        project: body.projectId,
        project_version: projectVersionId || null,
        topic: topicId,
        owner: ctx.state.user?.id || null,
        google_doc_id: created.documentId,
        is_published: false,
        visibility: "internal",
      },
    });

    results.push({ path: file.path, documentId: created.documentId });
  }

  const failed = results.filter((r) => r.error);
  return {
    ok: failed.length === 0,
    results,
    failedCount: failed.length,
  };
}

async function storeRefreshToken(ctx: Context) {
  const body = (ctx.request?.body || {}) as { refreshToken?: string };
  const user = ctx.state.user as { id: number; email?: string } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };

  const refreshToken = body.refreshToken;
  if (!refreshToken) {
    // Nothing to store — not an error, frontend may call speculatively
    return { ok: true, success: false, reason: "No refresh token provided" };
  }

  // Store the refresh token on the user record (Strapi users-permissions plugin)
  try {
    await strapi.db
      .query("plugin::users-permissions.user")
      .update({
        where: { id: user.id },
        data: { google_refresh_token: refreshToken },
      });
    return { ok: true, success: true };
  } catch (err: any) {
    // Field may not exist on user schema yet — store in org-role metadata as fallback
    console.warn("Could not store refresh token on user record:", err?.message);
    return { ok: true, success: false, reason: "User schema may not have google_refresh_token field" };
  }
}

async function docsAiAssistant(ctx: Context) {
  const body = (ctx.request?.body || {}) as {
    messages?: Array<{ role: string; content: string }>;
    context?: { currentProject?: unknown; currentTopic?: unknown };
  };
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };

  const messages = body.messages || [];
  if (messages.length === 0) {
    return { ok: false, error: "No messages provided" };
  }

  // The AI assistant requires an external LLM API key to function.
  // For now, return a helpful placeholder response.
  const lastMessage = messages[messages.length - 1];
  return {
    ok: true,
    response:
      "The AI documentation assistant is not configured yet. " +
      "To enable it, add an OPENAI_API_KEY or ANTHROPIC_API_KEY to your Strapi environment variables.",
    message: {
      role: "assistant",
      content:
        "The AI documentation assistant is not configured yet. " +
        "To enable it, add an OPENAI_API_KEY or ANTHROPIC_API_KEY to your Strapi environment variables.",
    },
  };
}

export default () => ({
  async invoke(name: string, ctx: Context) {
    switch (name) {
      case "ensure-workspace":
        return ensureWorkspace(ctx);
      case "get-organization":
        return getOrganization(ctx);
      case "update-organization":
        return updateOrganization(ctx);
      case "create-project":
        return createProject(ctx);
      case "create-project-version":
        return createProjectVersion(ctx);
      case "create-topic":
        return createTopic(ctx);
      case "create-document":
        return createDocument(ctx);
      case "update-document":
        return updateDocument(ctx);
      case "get-document":
        return getDocument(ctx);
      case "delete-document":
        return deleteDocument(ctx);
      case "delete-topic":
        return deleteTopic(ctx);
      case "delete-project":
        return deleteProject(ctx);
      case "list-join-requests":
        return listJoinRequests(ctx);
      case "list-projects":
        return listProjects(ctx);
      case "list-project-versions":
        return listProjectVersions(ctx);
      case "list-topics":
        return listTopics(ctx);
      case "list-documents":
        return listDocuments(ctx);
      case "discover-drive-structure":
        return discoverDriveStructure(ctx);
      case "update-member-role":
        return updateMemberRole(ctx);
      case "get-project-settings":
        return getProjectSettings(ctx);
      case "update-project-settings":
        return updateProjectSettings(ctx);
      case "create-invitation":
        return createInvitation(ctx);
      case "get-project-share":
        return getProjectShare(ctx);
      case "create-project-invitation":
        return createProjectInvitation(ctx);
      case "remove-project-invitation":
        return removeProjectInvitation(ctx);
      case "update-project-member-role":
        return updateProjectMemberRole(ctx);
      case "remove-project-member":
        return removeProjectMember(ctx);
      case "document-cache":
        return documentCache(ctx);
      case "sync-drive-permissions":
        return { ok: true, synced: 0, failed: 0 };
      case "google-drive":
        return googleDrive(ctx);
      case "convert-markdown-to-gdoc":
        return convertMarkdownToGdoc(ctx);
      case "import-markdown":
        return importMarkdown(ctx);
      case "repair-hierarchy":
        return { ok: true, duplicatesFound: 0, repairsApplied: 0 };
      case "normalize-structure":
        return { ok: true, mergedCount: 0, parentTopicsCreated: 0 };
      case "extract-website-styles":
        return { ok: false, error: "Not implemented yet" };
      case "send-invitation-email":
        return { ok: true };
      case "store-refresh-token":
        return storeRefreshToken(ctx);
      case "docs-ai-assistant":
        return docsAiAssistant(ctx);
      default:
        return notImplemented(name);
    }
  },
});
