/**
 * Read-only mode middleware.
 *
 * When READ_ONLY_MODE=true, blocks all write operations (POST, PUT, PATCH, DELETE).
 * GET and OPTIONS requests are always allowed.
 */
export default (_config: unknown, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const enabled = process.env.READ_ONLY_MODE === 'true';

    if (enabled && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(ctx.request.method)) {
      strapi.log.warn(
        `[read-only-mode] Blocked ${ctx.request.method} ${ctx.request.url}`
      );
      ctx.status = 403;
      ctx.body = {
        ok: false,
        error: 'Strapi is in read-only mode. Writes are disabled during migration to the new backend.',
      };
      return;
    }

    await next();
  };
};
