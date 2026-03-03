/**
 * Authentication utilities for AccelDocs
 * Connects to FastAPI backend at /auth endpoints
 */

const PRODUCTION_API_URL = "https://web-production-6a023.up.railway.app";
const API_URL = import.meta.env.VITE_AUTH_URL || import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? PRODUCTION_API_URL : 'http://localhost:8000');
const TOKEN_KEY = 'acceldocs_auth_token';
const USER_KEY = 'acceldocs_user';

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
export async function signInWithGoogle(): Promise<void> {
  const redirectUri = `${window.location.origin}/auth/callback`;
  const response = await fetch(
    `${API_URL}/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`,
    { method: "GET" }
  );
  if (!response.ok) {
    throw new Error("Failed to start Google OAuth");
  }
  const payload = await response.json();
  if (!payload?.url) {
    throw new Error("OAuth URL missing from backend response");
  }
  window.location.href = payload.url;
}

/**
 * Exchange Google OAuth code for JWT token
 */
export async function handleGoogleCallback(code: string): Promise<User & { strapi_jwt?: string }> {
  const redirectUri = `${window.location.origin}/auth/callback`;
  const response = await fetch(`${API_URL}/auth/callback?api=1&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    let errorMsg = 'Authentication failed';
    try {
      const error = await response.json();
      errorMsg = error.detail || error.error || error.message || errorMsg;
    } catch {
      // keep default message
    }
    throw new Error(errorMsg);
  }

  let data: AuthResponse & { strapi_jwt?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error('Backend returned non-JSON response. Please restart backend and try again.');
  }

  // Store token and user
  setToken(data.access_token);
  setStoredUser(data.user);

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

  const response = await fetch(`${API_URL}/auth/me`, {
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
      await fetch(`${API_URL}/auth/logout`, {
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
