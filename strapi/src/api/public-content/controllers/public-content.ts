import type { Context } from "koa";

export default {
  async get(ctx: Context) {
    const orgId = ctx.query?.organizationId ? String(ctx.query.organizationId) : null;
    if (!orgId) {
      ctx.status = 400;
      ctx.body = { ok: false, error: "Missing organizationId" };
      return;
    }

    const projects = await strapi.entityService.findMany("api::project.project", {
      filters: {
        organization: { id: { $eq: orgId } },
        is_published: true,
      },
      populate: { parent: { fields: ["id"] }, organization: { fields: ["id"] } },
      sort: { name: "asc" },
    });

    const projectIds = (projects as any[])
      .map((p) => (p as any)?.id)
      .filter(Boolean)
      .map((id) => String(id));
    if (projectIds.length === 0) {
      ctx.body = { ok: true, projects: [], versions: [], topics: [], documents: [] };
      return;
    }

    const versions = await strapi.entityService.findMany("api::project-version.project-version", {
      filters: { project: { id: { $in: projectIds } }, is_published: true },
      populate: { project: { fields: ["id"] } },
      sort: { createdAt: "desc" },
    });

    const topics = await strapi.entityService.findMany("api::topic.topic", {
      filters: { project: { id: { $in: projectIds } } },
      populate: {
        project: { fields: ["id"] },
        project_version: { fields: ["id"] },
        parent: { fields: ["id"] },
      },
      sort: { display_order: "asc" },
    });

    const documentsAll = await strapi.entityService.findMany("api::document.document", {
      filters: {
        project: { id: { $in: projectIds } },
        is_published: true,
      },
      fields: [
        "id",
        "title",
        "slug",
        "google_doc_id",
        "visibility",
        "is_published",
        "content_html",
        "published_content_html",
        "content_id",
        "published_content_id",
        "display_order",
        "video_url",
        "video_title",
        "last_synced_at",
        "google_modified_at",
      ],
      populate: {
        project: { fields: ["id"] },
        project_version: { fields: ["id"] },
        topic: { fields: ["id"] },
        owner: { fields: ["id", "email", "username"] },
      },
      sort: { display_order: "asc" },
    });

    const documents = documentsAll as any[];

    ctx.body = {
      ok: true,
      projects,
      versions,
      topics,
      documents,
    };
  },
};
