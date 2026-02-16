/**
 * Functions Abstraction Layer
 *
 * Provides a unified way to invoke backend "functions" regardless of
 * custom Strapi controllers.
 */

import { strapiFetch } from "./client";

export interface InvokeOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

export interface InvokeResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

/**
 * Invoke a backend RPC by name.
 * Maps to POST /api/rpc/:name (custom route).
 */
export async function invokeRpc<T = unknown>(
  name: string,
  params: Record<string, unknown>,
): Promise<InvokeResult<T>> {
  const { data, error } = await strapiFetch<T>(`/api/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(params ?? {}),
  });
  return { data: data ?? null, error: error ? new Error(error.message) : null };
}

/**
 * Invoke a backend function by name.
 * Maps to POST /api/functions/:name (custom route).
 */
export async function invokeFunction<T = unknown>(
  name: string,
  options: InvokeOptions = {},
): Promise<InvokeResult<T>> {
  const method = options.method ?? "POST";
  const isFormData =
    typeof FormData !== "undefined" &&
    typeof options.body !== "undefined" &&
    options.body instanceof FormData;
  const body =
    method === "GET"
      ? undefined
      : isFormData
        ? (options.body as FormData)
        : JSON.stringify(options.body ?? {});
  const { data, error } = await strapiFetch<T>(`/api/functions/${name}`, {
    method,
    headers: options.headers,
    body,
  });
  const payload = data as any;
  if (payload?.needsReauth || (typeof payload?.error === "string" && /(UNAUTHENTICATED|Invalid Credentials)/i.test(payload.error))) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("drive:reauth"));
    }
  }
  return { data: data ?? null, error: error ? new Error(error.message) : null };
}
