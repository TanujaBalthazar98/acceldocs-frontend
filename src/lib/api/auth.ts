/**
 * Auth Abstraction Layer
 *
 * Strapi auth interface (Supabase retired).
 */

import { strapiFetch, getStrapiToken, setStrapiToken } from "./client";

// Unified user type that works with both backends
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

// ── Strapi Implementation ───────────────────────────────────

const strapiAuth = {
  async getUser(): Promise<CurrentUserResult> {
    const session = await strapiAuth.getSession();
    return { user: session?.user ?? null };
  },
  async getSession(): Promise<ApiSession | null> {
    const token = getStrapiToken();
    if (!token) return null;

    const { data, error } = await strapiFetch<{ id: number; email: string; username: string }>("/api/users/me");
    if (error || !data) return null;

    return {
      user: {
        id: String(data.id),
        email: data.email,
        user_metadata: {},
      },
      access_token: token,
    };
  },

  async signInWithEmail(email: string, password: string): Promise<{ error: Error | null }> {
    const { data, error } = await strapiFetch<{ jwt: string; user: { id: number; email: string } }>(
      "/api/auth/local",
      {
        method: "POST",
        body: JSON.stringify({ identifier: email, password }),
      },
    );

    if (error) return { error: new Error(error.message) };
    if (data?.jwt) setStrapiToken(data.jwt);
    return { error: null };
  },

  async signUpWithEmail(
    email: string,
    password: string,
    metadata?: { account_type?: string },
  ): Promise<{ error: Error | null }> {
    const { data, error } = await strapiFetch<{ jwt: string }>("/api/auth/local/register", {
      method: "POST",
      body: JSON.stringify({
        username: email,
        email,
        password,
        account_type: metadata?.account_type || "individual",
      }),
    });

    if (error) return { error: new Error(error.message) };
    if (data?.jwt) setStrapiToken(data.jwt);
    return { error: null };
  },

  async signInWithGoogle(options?: {
    redirectTo?: string;
    skipBrowserRedirect?: boolean;
    queryParams?: Record<string, string>;
  }): Promise<{ url?: string; error: Error | null }> {
    const redirectTo = options?.redirectTo || `${window.location.origin}/dashboard`;
    const params = new URLSearchParams({
      redirect: redirectTo,
      ...(options?.queryParams || {}),
    });
    const url = `${import.meta.env.VITE_API_URL}/api/connect/google?${params.toString()}`;

    if (!options?.skipBrowserRedirect) {
      window.location.assign(url);
    }
    return { url, error: null };
  },

  async requestDriveAccess(options?: {
    redirectTo?: string;
    skipBrowserRedirect?: boolean;
    queryParams?: Record<string, string>;
  }): Promise<{ url?: string; error: Error | null }> {
    const redirectTo = options?.redirectTo || `${window.location.origin}/dashboard`;
    const driveScope = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ].join(" ");
    const params = new URLSearchParams({
      redirect: redirectTo,
      scope: driveScope,
      ...(options?.queryParams || {}),
    });
    const url = `${import.meta.env.VITE_API_URL}/api/connect/google?${params.toString()}`;

    if (!options?.skipBrowserRedirect) {
      window.location.assign(url);
    }
    return { url, error: null };
  },

  async refreshSession(): Promise<ApiSession | null> {
    const { data, error } = await strapiFetch<{ jwt: string }>("/api/auth/refresh-token", {
      method: "POST",
    });

    if (error || !data?.jwt) return null;
    setStrapiToken(data.jwt);
    return strapiAuth.getSession();
  },

  async signOut(): Promise<void> {
    setStrapiToken(null);
  },

  onAuthStateChange(_callback: AuthChangeCallback): { unsubscribe: () => void } {
    // Strapi doesn't have real-time auth events
    // The frontend handles this via JWT expiry checks
    return { unsubscribe: () => {} };
  },
};

// ── Exported API — Strapi only ───────────────────────────────

export const auth = strapiAuth;
