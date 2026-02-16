import type { Context } from "koa";

const notImplemented = (name: string) => ({
  ok: false,
  error: "Not implemented yet",
  rpc: name,
});

export default () => ({
  async invoke(name: string, _ctx: Context) {
    switch (name) {
      case "can_edit_project":
      case "promote_version_to_default":
      case "duplicate_project_version":
        return notImplemented(name);
      case "approve_join_request":
        return approveJoinRequest(_ctx);
      case "reject_join_request":
        return rejectJoinRequest(_ctx);
      default:
        return notImplemented(name);
    }
  },
});

async function approveJoinRequest(ctx: Context) {
  const body = (ctx.request?.body || {}) as { _request_id?: string };
  const requestId = body?._request_id;
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  if (!requestId) return { ok: false, error: "Missing request id" };

  const request = await strapi.entityService.findOne("api::join-request.join-request", requestId, {
    populate: { organization: { fields: ["id"] }, user: { fields: ["id"] } },
  });
  if (!request) return { ok: false, error: "Request not found" };

  const orgId = (request as any)?.organization?.id;
  const targetUserId = (request as any)?.user?.id;
  if (!orgId || !targetUserId) return { ok: false, error: "Request missing organization or user" };

  await strapi.entityService.update("api::join-request.join-request", requestId, {
    data: { status: "approved" },
  });

  const existingRole = await strapi.db.query("api::org-role.org-role").findOne({
    where: { organization: orgId, user: targetUserId },
  });
  if (!existingRole) {
    await strapi.entityService.create("api::org-role.org-role", {
      data: { organization: orgId, user: targetUserId, role: "viewer" },
    });
  }

  return { ok: true };
}

async function rejectJoinRequest(ctx: Context) {
  const body = (ctx.request?.body || {}) as { _request_id?: string };
  const requestId = body?._request_id;
  const user = ctx.state.user as { id: number } | undefined;
  if (!user) return { ok: false, error: "Unauthorized" };
  if (!requestId) return { ok: false, error: "Missing request id" };

  const request = await strapi.entityService.findOne("api::join-request.join-request", requestId);
  if (!request) return { ok: false, error: "Request not found" };

  await strapi.entityService.update("api::join-request.join-request", requestId, {
    data: { status: "rejected" },
  });

  return { ok: true };
}
