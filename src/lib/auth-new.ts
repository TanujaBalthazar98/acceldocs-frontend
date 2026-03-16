/**
 * Authentication utilities for AccelDocs
 * Connects to FastAPI backend at /auth endpoints
 */

// Backend base URL — set VITE_API_URL in production (e.g. Vercel env vars)
const PRODUCTION_API_URL = "https://acceldocs-backend.vercel.app";
const API_URL = import.meta.env.VITE_AUTH_URL || import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? PRODUCTION_API_URL : 'http://localhost:8000');

function getAuthApiUrl(): string {
  if (typeof window === 'undefined') return API_URL;
  const isLocalHttps = window.location.protocol === 'https:' && /^(http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(API_URL);
  // In HTTPS local dev, use Vite same-origin proxy to avoid mixed-content requests.
  return isLocalHttps ? '' : API_URL;
}

function getAuthCallbackApiUrl(): string {
  const authApiUrl = getAuthApiUrl();
  // Keep browser callback route (/auth/callback) owned by React Router.
  // API callback exchange uses a dedicated proxy path in local HTTPS dev.
  if (!authApiUrl) return '/auth/callback-api';
  return `${authApiUrl}/auth/callback`;
}
const AUTH_REDIRECT_BASE = (import.meta.env.VITE_AUTH_REDIRECT_BASE as string | undefined)?.trim();
const TOKEN_KEY = 'acceldocs_auth_token';
const USER_KEY = 'acceldocs_user';
const OAUTH_REDIRECT_URI_KEY = 'acceldocs_oauth_redirect_uri';

function getOAuthRedirectUri(): string {
  const isPreviewHost = window.location.host.startsWith("id-preview--");
  let base = AUTH_REDIRECT_BASE || "";

  if (!base && isPreviewHost) {
    base = "https://docspeare.com";
  }
  if (!base) {
    base = window.location.origin;
  }

  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/auth/callback`;
}

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: 'viewer' | 'editor' | 'reviewer' | 'admin';
  google_id: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type?: string;
  google_access_token?: string;
  strapi_jwt?: string;
  user: User;
}

/**
 * Get stored JWT token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store JWT token
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove JWT token
 */
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Get stored user data
 */
export function getStoredUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Store user data
 */
export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Initiate Google OAuth flow
 */
export async function signInWithGoogle(orgId?: number): Promise<void> {
  const redirectUri = getOAuthRedirectUri();
  const orgQuery = Number.isFinite(orgId) && (orgId as number) > 0
    ? `&org_id=${encodeURIComponent(String(orgId))}`
    : "";
  const response = await fetch(
    `${getAuthApiUrl()}/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}${orgQuery}`,
    { method: "GET" }
  );
  if (!response.ok) {
    throw new Error("Failed to start Google OAuth");
  }
  const payload = await response.json();
  if (!payload?.url) {
    throw new Error("OAuth URL missing from backend response");
  }
  const redirectFromBackend = typeof payload?.redirect_uri === "string" ? payload.redirect_uri : null;
  if (redirectFromBackend) {
    localStorage.setItem(OAUTH_REDIRECT_URI_KEY, redirectFromBackend);
  } else {
    try {
      const oauthUrl = new URL(payload.url);
      const resolved = oauthUrl.searchParams.get("redirect_uri");
      if (resolved) {
        localStorage.setItem(OAUTH_REDIRECT_URI_KEY, resolved);
      }
    } catch {
      // Ignore parse errors; fallback will use computed redirect URI.
    }
  }
  window.location.href = payload.url;
}

/**
 * Exchange Google OAuth code for JWT token
 */
export async function handleGoogleCallback(code: string): Promise<User & { strapi_jwt?: string }> {
  const redirectUri = localStorage.getItem(OAUTH_REDIRECT_URI_KEY) || getOAuthRedirectUri();
  const response = await fetch(`${getAuthCallbackApiUrl()}?api=1&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    localStorage.removeItem(OAUTH_REDIRECT_URI_KEY);
    let errorMsg = 'Authentication failed';
    try {
      const error = await response.json();
      errorMsg = error.detail || error.error || error.message || errorMsg;
    } catch {
      // keep default message
    }
    throw new Error(errorMsg);
  }

  let data: AuthResponse & { strapi_jwt?: string; error?: string; redirect?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error('Backend returned non-JSON response. Please restart backend and try again.');
  }

  // Handle "no account" response — new user needs to sign up first
  if (data.error === 'no_account') {
    window.location.assign(data.redirect || '/signup?reason=no_account');
    throw new Error('NO_ACCOUNT_REDIRECT');
  }

  // Store token and user
  setToken(data.access_token);
  setStoredUser(data.user);
  localStorage.removeItem(OAUTH_REDIRECT_URI_KEY);

  // Store Google access token for Drive operations
  if (data.google_access_token) {
    localStorage.setItem('google_access_token', data.google_access_token);
  }

  // Return user with optional strapi_jwt
  return { ...data.user, strapi_jwt: data.strapi_jwt };
}

/**
 * Fetch current user from backend
 */
export async function getCurrentUser(): Promise<User> {
  const token = getToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${getAuthApiUrl()}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token invalid or expired
      removeToken();
      throw new Error('Session expired');
    }
    throw new Error('Failed to fetch user');
  }

  const user: User = await response.json();
  setStoredUser(user);

  return user;
}

/**
 * Sign out user
 */
export async function signOut(): Promise<void> {
  const token = getToken();

  // Call backend logout endpoint (optional, for token invalidation)
  if (token) {
    try {
      await fetch(`${getAuthApiUrl()}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if API fails
    }
  }

  // Clear local storage
  removeToken();
  localStorage.removeItem(OAUTH_REDIRECT_URI_KEY);

  // Redirect to home
  window.location.href = '/';
}

/**
 * Check if user has required role
 */
export function hasRole(user: User | null, requiredRole: User['role']): boolean {
  if (!user) return false;

  const roleHierarchy = {
    viewer: 0,
    editor: 1,
    reviewer: 2,
    admin: 3,
  };

  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Make authenticated API request
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  // Handle 401 - token expired
  if (response.status === 401) {
    removeToken();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  return response;
}
