/**
 * Auth Abstraction Layer
 *
 * Automation-backend auth interface.
 */

import { getAuthToken, setAuthToken, API_BASE_URL, getStrapiToken, setStrapiToken } from "./client";

// Re-export deprecated names for backward compat
export { getStrapiToken, setStrapiToken };

// Unified user type
export interface ApiUser {
  id: string;
  email: string | undefined;
  user_metadata?: {
    full_name?: string;
    account_type?: string;
    [key: string]: unknown;
  };
}

export interface ApiSession {
  user: ApiUser | null;
  access_token: string | null;
  expires_at?: number;
  provider_token?: string | null;
  provider_refresh_token?: string | null;
}

export interface CurrentUserResult {
  user: ApiUser | null;
}

export type AuthEventType =
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "INITIAL_SESSION";

export type AuthChangeCallback = (event: AuthEventType, session: ApiSession | null) => void;

const API_BASE = API_BASE_URL;
const OAUTH_REDIRECT_URI_KEY = "acceldocs_oauth_redirect_uri";

const authImpl = {
  async getUser(): Promise<CurrentUserResult> {
    const session = await authImpl.getSession();
    return { user: session?.user ?? null };
  },

  async getSession(): Promise<ApiSession | null> {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) return null;
      const data = await response.json();

      // Backend returns { id, email, name, role, expires_at }
      const userId = data?.id || data?.user?.id;
      const email = data?.email || data?.user?.email;
      const name = data?.name || data?.user?.displayName || data?.user?.display_name;

      if (!userId) return null;

      return {
        user: {
          id: String(userId),
          email,
          user_metadata: {
            full_name: name || undefined,
          },
        },
        access_token: token,
        expires_at: data?.expires_at ?? undefined,
      };
    } catch {
      return null;
    }
  },

  async signInWithEmail(email: string, password: string): Promise<{ error: Error | null }> {
    void email;
    void password;
    return { error: new Error("Email/password sign-in is not enabled. Use Google sign-in.") };
  },

  async signUpWithEmail(
    email: string,
    password: string,
    metadata?: { account_type?: string },
  ): Promise<{ error: Error | null }> {
    void email;
    void password;
    void metadata;
    return { error: new Error("Email/password sign-up is not enabled. Use Google sign-up.") };
  },

  async signInWithGoogle(options?: {
    redirectTo?: string;
    skipBrowserRedirect?: boolean;
    queryParams?: Record<string, string>;
  }): Promise<{ url?: string; error: Error | null }> {
    try {
      const redirectUri = options?.redirectTo || `${window.location.origin}/auth/callback`;
      const query = new URLSearchParams({
        redirect_uri: redirectUri,
        ...(options?.queryParams || {}),
      }).toString();
      const response = await fetch(`${API_BASE}/auth/login?${query}`, { method: "GET" });
      if (!response.ok) return { error: new Error("Failed to start Google sign-in") };
      const payload = await response.json();
      const url = payload?.url as string | undefined;
      if (!url) return { error: new Error("OAuth URL missing from backend response") };
      const redirectFromBackend = typeof payload?.redirect_uri === "string" ? payload.redirect_uri : null;
      if (redirectFromBackend) {
        localStorage.setItem(OAUTH_REDIRECT_URI_KEY, redirectFromBackend);
      } else {
        try {
          const oauthUrl = new URL(url);
          const resolved = oauthUrl.searchParams.get("redirect_uri");
          if (resolved) localStorage.setItem(OAUTH_REDIRECT_URI_KEY, resolved);
        } catch {
          // Ignore parse failures; callback flow falls back to computed redirect URI.
        }
      }
      if (!options?.skipBrowserRedirect) {
        window.location.assign(url);
      }
      return { url, error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error("Failed to start Google sign-in") };
    }
  },

  async requestDriveAccess(options?: {
    redirectTo?: string;
    skipBrowserRedirect?: boolean;
    queryParams?: Record<string, string>;
  }): Promise<{ url?: string; error: Error | null }> {
    return authImpl.signInWithGoogle(options);
  },

  async refreshSession(): Promise<ApiSession | null> {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        // If refresh fails, fall back to validating current session
        return authImpl.getSession();
      }

      const data = await response.json();
      const newToken = data?.access_token;
      if (!newToken) return authImpl.getSession();

      // Store the new JWT
      setAuthToken(newToken);

      // Store refreshed Google access token if provided
      const googleToken = data?.google_access_token;
      if (googleToken) {
        localStorage.setItem("google_access_token", googleToken);
      }

      const user = data?.user;
      return {
        user: user
          ? {
              id: String(user.id),
              email: user.email,
              user_metadata: {
                full_name: user.name || undefined,
              },
            }
          : null,
        access_token: newToken,
        expires_at: data?.expires_at ?? undefined,
        provider_token: googleToken ?? undefined,
      };
    } catch {
      // Fall back to session validation
      return authImpl.getSession();
    }
  },

  async signOut(): Promise<void> {
    try {
      const token = getAuthToken();
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore network issues
    }
    setAuthToken(null);
    localStorage.removeItem(OAUTH_REDIRECT_URI_KEY);
  },

  onAuthStateChange(_callback: AuthChangeCallback): { unsubscribe: () => void } {
    return { unsubscribe: () => {} };
  },
};

export const auth = authImpl;
