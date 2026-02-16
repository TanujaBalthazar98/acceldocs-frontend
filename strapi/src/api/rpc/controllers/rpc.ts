import type { Context } from "koa";

export default {
  async invoke(ctx: Context) {
    const name = ctx.params?.name as string | undefined;
    if (!name) {
      ctx.status = 400;
      ctx.body = { ok: false, error: "Missing rpc name" };
      return;
    }

    const service = strapi?.service?.("api::rpc.rpc");
    if (!service || typeof service.invoke !== "function") {
      ctx.status = 500;
      ctx.body = { ok: false, error: "RPC service not available" };
      return;
    }

    const result = await service.invoke(name, ctx);
    ctx.body = result;
  },
};
