/**
 * API Client Abstraction Layer
 *
 * Strapi HTTP client.
 *
 * Supabase has been retired; all traffic goes to Strapi.
 */

const STRAPI_JWT_KEY = "strapi_jwt";
const REFRESH_LOCK_KEY = "api_refresh_lock";

// Supabase retired: always use Strapi
export const USE_STRAPI = true;

// Strapi base URL (only needed when USE_STRAPI is true)
export const STRAPI_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: ApiError | null;
}

/**
 * Get the stored Strapi JWT token
 */
export function getStrapiToken(): string | null {
  return localStorage.getItem(STRAPI_JWT_KEY);
}

/**
 * Set the Strapi JWT token
 */
export function setStrapiToken(token: string | null): void {
  if (token) {
    localStorage.setItem(STRAPI_JWT_KEY, token);
  } else {
    localStorage.removeItem(STRAPI_JWT_KEY);
  }
}

/**
 * Core fetch wrapper for Strapi API calls.
 * Injects JWT, handles errors, and normalizes responses.
 */
export async function strapiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = getStrapiToken();
  const url = `${STRAPI_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  const isFormData =
    typeof FormData !== "undefined" &&
    typeof options.body !== "undefined" &&
    options.body instanceof FormData;

  if (isFormData) {
    delete headers["Content-Type"];
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message =
        errorBody?.error?.message ||
        errorBody?.message ||
        `Request failed with status ${response.status}`;

      // Handle 401 - attempt token refresh
      if (response.status === 401 && token) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          // Retry the original request with the new token
          return strapiFetch<T>(path, options);
        }
      }

      return {
        data: null,
        error: { status: response.status, message, details: errorBody },
      };
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return { data: null as T, error: null };
    }

    const data = await response.json();
    return { data: data as T, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        status: 0,
        message: err instanceof Error ? err.message : "Network error",
        details: err,
      },
    };
  }
}

/**
 * Attempt to refresh the Strapi JWT token.
 * Uses a lock to prevent concurrent refresh attempts.
 */
async function attemptTokenRefresh(): Promise<boolean> {
  const now = Date.now();
  const lockUntil = Number(localStorage.getItem(REFRESH_LOCK_KEY) || "0");

  // Prevent concurrent refresh attempts
  if (lockUntil && now < lockUntil) {
    return false;
  }

  localStorage.setItem(REFRESH_LOCK_KEY, String(now + 30_000));

  try {
    const currentToken = getStrapiToken();
    if (!currentToken) return false;

    const response = await fetch(`${STRAPI_URL}/api/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (data?.jwt) {
      setStrapiToken(data.jwt);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  }
}
