import type { Context } from "koa";

export default {
  async invoke(ctx: Context) {
    const name = ctx.params?.name as string | undefined;
    if (!name) {
      ctx.status = 400;
      ctx.body = { ok: false, error: "Missing function name" };
      return;
    }

    if (!ctx.state?.user) {
      const authHeader = ctx.request?.header?.authorization || ctx.request?.header?.Authorization;
      const token = typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "").trim() : "";
      if (token) {
        try {
          const jwtService = strapi.plugin("users-permissions")?.service("jwt");
          const userService = strapi.plugin("users-permissions")?.service("user");
          if (jwtService && userService) {
            const payload = await jwtService.verify(token);
            const user = await userService.fetch(payload.id);
            if (user) {
              ctx.state.user = user;
            }
          }
        } catch {
          // ignore and fall through to unauthorized
        }
      }
    }

    if (!ctx.state?.user) {
      ctx.status = 401;
      ctx.body = { ok: false, error: "Unauthorized" };
      return;
    }

    const service = strapi?.service?.("api::functions.functions");
    if (!service || typeof service.invoke !== "function") {
      ctx.status = 500;
      ctx.body = { ok: false, error: "Functions service not available" };
      return;
    }

    const result = await service.invoke(name, ctx);
    ctx.body = result;
  },
};
