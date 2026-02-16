/**
 * API Barrel Export
 *
 * Exposes the API abstractions and feature flag from a single entry.
 */

export { USE_STRAPI, STRAPI_URL } from "./client";
export { auth } from "./auth";
export { invokeFunction, invokeRpc } from "./functions";
export { list, getById, create, update, remove } from "./queries";
