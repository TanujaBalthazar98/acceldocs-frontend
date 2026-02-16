/**
 * Queries Abstraction Layer
 *
 * Provides a minimal CRUD interface that can be routed to either
 * Supabase (current) or Strapi (target) during migration.
 *
 * This is intentionally conservative and only supports basic equality
 * filters for now.
 */

import { strapiFetch } from "./client";

export interface QueryFilter {
  eq?: string | number | boolean | null;
  neq?: string | number | boolean | null;
  in?: Array<string | number | boolean>;
  is?: "null" | "not_null" | null;
}

export interface QueryOptions {
  select?: string;
  filters?: Record<string, QueryFilter | string | number | boolean | null>;
  orderBy?: { field: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export interface QueryResult<T = unknown> {
  data: T | null;
  error: Error | null;
  errorDetails?: unknown;
}

function normalizeFilterValue(value: QueryFilter | string | number | boolean | null): QueryFilter {
  if (value && typeof value === "object" && ("eq" in value || "neq" in value || "in" in value || "is" in value)) {
    return value as QueryFilter;
  }
  return { eq: value as any };
}

const STRAPI_FIELD_MAP: Record<string, string> = {
  organization_id: "organization",
  project_id: "project",
  project_version_id: "project_version",
  topic_id: "topic",
  user_id: "user",
  owner_id: "owner",
  document_id: "document",
  connector_id: "connector",
  parent_id: "parent",
};

function buildStrapiQueryParams(options: QueryOptions): string {
  const params = new URLSearchParams();

  if (options.select) {
    const cleaned = options.select.replace(/\s+/g, "");
    if (cleaned !== "*" && cleaned !== "") {
      params.set("fields", cleaned);
    }
  }

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      const mappedKey = STRAPI_FIELD_MAP[key] ?? key;
      const filter = normalizeFilterValue(value);
      if (filter.eq !== undefined) params.set(`filters[${mappedKey}][$eq]`, String(filter.eq));
      if (filter.neq !== undefined) params.set(`filters[${mappedKey}][$ne]`, String(filter.neq));
      if (filter.is) {
        params.set(`filters[${mappedKey}][$null]`, filter.is === "null" ? "true" : "false");
      }
      if (filter.in && filter.in.length > 0) {
        filter.in.forEach((v, idx) => params.set(`filters[${mappedKey}][$in][${idx}]`, String(v)));
      }
    }
  }

  if (options.orderBy) {
    params.set("sort", `${options.orderBy.field}:${options.orderBy.ascending === false ? "desc" : "asc"}`);
  }

  if (typeof options.limit === "number") {
    params.set("pagination[limit]", String(options.limit));
  }

  if (typeof options.offset === "number") {
    params.set("pagination[start]", String(options.offset));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function list<T = unknown>(
  collection: string,
  options: QueryOptions = {},
): Promise<QueryResult<T[]>> {
  const qs = buildStrapiQueryParams(options);
  const { data, error } = await strapiFetch<{ data: T[] }>(`/api/${collection}${qs}`);
  return { data: data?.data ?? null, error: error ? new Error(error.message) : null, errorDetails: error?.details };
}

export async function getById<T = unknown>(
  collection: string,
  id: string | number,
  options: QueryOptions = {},
): Promise<QueryResult<T>> {
  const qs = buildStrapiQueryParams(options);
  const { data, error } = await strapiFetch<{ data: T }>(`/api/${collection}/${id}${qs}`);
  return { data: data?.data ?? null, error: error ? new Error(error.message) : null, errorDetails: error?.details };
}

export async function create<T = unknown>(
  collection: string,
  payload: Record<string, unknown>,
): Promise<QueryResult<T>> {
  const { data, error } = await strapiFetch<{ data: T }>(`/api/${collection}`, {
    method: "POST",
    body: JSON.stringify({ data: payload }),
  });
  return { data: data?.data ?? null, error: error ? new Error(error.message) : null, errorDetails: error?.details };
}

export async function update<T = unknown>(
  collection: string,
  id: string | number,
  payload: Record<string, unknown>,
): Promise<QueryResult<T>> {
  const patchResult = await strapiFetch<{ data: T }>(`/api/${collection}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ data: payload }),
  });

  if (patchResult.error?.status === 405) {
    const putResult = await strapiFetch<{ data: T }>(`/api/${collection}/${id}`, {
      method: "PUT",
      body: JSON.stringify({ data: payload }),
    });
    return {
      data: putResult.data?.data ?? null,
      error: putResult.error ? new Error(putResult.error.message) : null,
      errorDetails: putResult.error?.details,
    };
  }

  return {
    data: patchResult.data?.data ?? null,
    error: patchResult.error ? new Error(patchResult.error.message) : null,
    errorDetails: patchResult.error?.details,
  };
}

export async function remove(
  collection: string,
  id: string | number,
): Promise<QueryResult<{ id: string | number }>> {
  const { data, error } = await strapiFetch<{ data: { id: string | number } }>(
    `/api/${collection}/${id}`,
    { method: "DELETE" },
  );
  return { data: data?.data ?? null, error: error ? new Error(error.message) : null, errorDetails: error?.details };
}

export async function removeWhere(
  collection: string,
  filters: QueryOptions["filters"],
): Promise<QueryResult<{ count?: number }>> {
  return {
    data: null,
    error: new Error("removeWhere is not supported in Strapi mode."),
  };
}

export async function updateWhere<T = unknown>(
  collection: string,
  filters: QueryOptions["filters"],
  payload: Record<string, unknown>,
): Promise<QueryResult<T>> {
  return {
    data: null,
    error: new Error("updateWhere is not supported in Strapi mode."),
  };
}
