/**
 * API Client Abstraction Layer
 *
 * All traffic goes to the acceldocs-backend (Python/FastAPI).
 */

const AUTH_TOKEN_KEY = "acceldocs_auth_token";

// Backend base URL — Railway in production, localhost in dev
const PRODUCTION_API_URL = "https://web-production-6a023.up.railway.app";
export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "")
  || (import.meta.env.PROD ? PRODUCTION_API_URL : "http://localhost:8000");

/** @deprecated Use API_BASE_URL */
export const STRAPI_URL = API_BASE_URL;

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
 * Get the stored auth token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/** @deprecated Use getAuthToken() */
export const getStrapiToken = getAuthToken;

/**
 * Set the auth token
 */
export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

/** @deprecated Use setAuthToken() */
export const setStrapiToken = setAuthToken;

/**
 * Core fetch wrapper for API calls.
 * Injects JWT, handles errors, and normalizes responses.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  retryCount: number = 0,
): Promise<ApiResponse<T>> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000];

  const token = getAuthToken();
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

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
        errorBody?.error ||
        `Request failed with status ${response.status}`;

      if (response.status === 401 && token && retryCount === 0) {
        // Try to refresh the token before giving up
        try {
          const refreshResp = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (refreshResp.ok) {
            const refreshData = await refreshResp.json();
            if (refreshData?.access_token) {
              setAuthToken(refreshData.access_token);
              // Store refreshed Google token if provided
              if (refreshData?.google_access_token) {
                localStorage.setItem("google_access_token", refreshData.google_access_token);
              }
              // Retry the original request with the new token
              return apiFetch<T>(path, options, retryCount + 1);
            }
          }
        } catch {
          // Refresh failed, proceed to logout
        }
        localStorage.removeItem(AUTH_TOKEN_KEY);
        window.location.href = "/login";
      }

      return {
        data: null,
        error: { status: response.status, message, details: errorBody },
      };
    }

    if (response.status === 204) {
      return { data: null as T, error: null };
    }

    const data = await response.json();
    return { data: data as T, error: null };
  } catch (err) {
    if (retryCount < MAX_RETRIES && err instanceof TypeError && err.message.includes('fetch')) {
      const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      await new Promise(resolve => setTimeout(resolve, delay));
      return apiFetch<T>(path, options, retryCount + 1);
    }

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

/** @deprecated Use apiFetch() */
export const strapiFetch = apiFetch;
