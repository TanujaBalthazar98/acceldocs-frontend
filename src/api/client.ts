/**
 * Lightweight API client — re-exports the shared apiFetch from lib/api/client
 * and provides a typed wrapper with better ergonomics.
 */

export { apiFetch, getAuthToken, setAuthToken, API_BASE_URL } from "@/lib/api/client";
import { apiFetch } from "@/lib/api/client";

/** Call apiFetch and throw on error (for use in React Query queryFn). */
export async function fetchOrThrow<T>(path: string, options?: RequestInit): Promise<T> {
  const { data, error } = await apiFetch<T>(path, options);
  if (error) throw new Error(error.message);
  return data as T;
}
