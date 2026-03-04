import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { ensureFreshSession } from "@/lib/authSession";
import { auth, type ApiSession, type ApiUser } from "@/lib/api/auth";
import { setAuthToken } from "@/lib/api/client";
import { invokeFunction } from "@/lib/api/functions";
import { identifyPosthog, resetPosthog } from "@/lib/analytics/posthog";

type AccountType = "individual" | "team" | "enterprise";

interface AuthContextType {
  user: ApiUser | null;
  session: ApiSession | null;
  loading: boolean;
  googleAccessToken: string | null;
  profileOrganizationId: string | null;
  profileLoading: boolean;
  signInWithGoogle: (options?: { oauthWindow?: Window | null }) => Promise<{ error: Error | null }>;
  requestDriveAccess: (options?: { oauthWindow?: Window | null }) => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, accountType?: AccountType) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GOOGLE_TOKEN_KEY = "google_access_token";
const GOOGLE_DRIVE_ACCESS_REQUESTED_KEY = "google_drive_access_requested";
const GOOGLE_DRIVE_REFRESH_PRESENT_KEY = "google_drive_refresh_token_present";
const AUTH_REDIRECT_BASE = import.meta.env.VITE_AUTH_REDIRECT_BASE as string | undefined;

const getRedirectBase = () => {
  const base = AUTH_REDIRECT_BASE?.trim() || window.location.origin;
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    // Initialize from localStorage
    return localStorage.getItem(GOOGLE_TOKEN_KEY);
  });
  const [profileOrganizationId, setProfileOrganizationId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Track if we've already tried to store refresh token for the current Drive-consent flow
  const hasAttemptedStoreTokenRef = useRef(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false); // Prevent concurrent token refreshes

  // Store refresh token by calling backend function.
  // If refreshToken isn't provided, the backend will try to extract it from the user's Google identity.
  const storeRefreshToken = async (refreshToken?: string) => {
    // Only attempt once per Drive-consent flow
    if (hasAttemptedStoreTokenRef.current) return;
    hasAttemptedStoreTokenRef.current = true;

    try {
      const { data, error } = await invokeFunction<{ success?: boolean }>("store-refresh-token", {
        body: refreshToken ? { refreshToken } : {},
      });

      if (error) {
        console.error("Failed to store refresh token:", error);
      } else {
        console.log("Store refresh token result:", data);
        if (data?.success) {
          localStorage.setItem(GOOGLE_DRIVE_REFRESH_PRESENT_KEY, "1");
        }
      }
    } catch (err) {
      console.error("Error storing refresh token:", err);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { unsubscribe } = auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Store provider_token when available
      if (session?.provider_token) {
        console.log("Storing Google access token");
        localStorage.setItem(GOOGLE_TOKEN_KEY, session.provider_token);
        setGoogleAccessToken(session.provider_token);
      }

      // Only attempt refresh-token storage after the explicit Drive-consent OAuth flow
      const driveConsentRequested =
        localStorage.getItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY) === "1";

      const shouldStoreAfterDriveConsent =
        driveConsentRequested &&
        !!session?.user?.id &&
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED");

      if (shouldStoreAfterDriveConsent) {
        localStorage.removeItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY);

        // provider_refresh_token is often only present during consent. If it's missing,
        // we still invoke the backend to try to extract/store it from identity data.
        const refreshToken = session?.provider_refresh_token;
        setTimeout(() => storeRefreshToken(refreshToken ?? undefined), 500);
      }

      // Clear tokens on sign out
      if (event === "SIGNED_OUT") {
        localStorage.removeItem(GOOGLE_TOKEN_KEY);
        localStorage.removeItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY);
        localStorage.removeItem(GOOGLE_DRIVE_REFRESH_PRESENT_KEY);
        setGoogleAccessToken(null);
        hasAttemptedStoreTokenRef.current = false;
      }

      // Reschedule manual refresh when session updates
      scheduleSessionRefresh(session);
    });

    // THEN check for existing session
    (async () => {
      let initialSession: ApiSession | null = null;
      try {
        initialSession = (await auth.getSession?.()) ?? null;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (err) {
        console.error("Failed to get initial session:", err);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }

      // Also check for provider_token on initial load
      if (initialSession?.provider_token) {
        console.log("Initial session has provider_token, storing it");
        localStorage.setItem(GOOGLE_TOKEN_KEY, initialSession.provider_token);
        setGoogleAccessToken(initialSession.provider_token);
      }

      // Schedule manual refresh when session exists
      scheduleSessionRefresh(initialSession);
    })();

    return () => unsubscribe();
  }, []);

  // Refresh session when tab becomes visible again (user returns from background)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      if (!session?.expires_at) return;

      const expiresAtMs = session.expires_at * 1000;
      const now = Date.now();

      // If token expired or expires within 5 minutes, refresh immediately
      if (expiresAtMs - now < 5 * 60 * 1000) {
        try {
          const refreshedSession = await ensureFreshSession();
          if (refreshedSession) {
            setSession(refreshedSession);
            setUser(refreshedSession.user ?? null);
            if (refreshedSession.provider_token) {
              localStorage.setItem(GOOGLE_TOKEN_KEY, refreshedSession.provider_token);
              setGoogleAccessToken(refreshedSession.provider_token);
            }
            scheduleSessionRefresh(refreshedSession);
          }
        } catch (error) {
          console.error("Visibility refresh failed:", error);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [session?.expires_at]);

  // Listen for OAuth popup messages (for new backend OAuth flow)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        const { accessToken, jwt, user: userData } = event.data;

        console.log("Received OAuth success from popup");

        // Store Google access token
        localStorage.setItem(GOOGLE_TOKEN_KEY, accessToken);
        setGoogleAccessToken(accessToken);

        // Store JWT and update session
        if (jwt) {
          setAuthToken(jwt);
          // Update auth state with new user data
          if (userData) {
            setUser({
              id: String(userData.id),
              email: userData.email,
              user_metadata: {
                full_name: userData.name || undefined,
              },
            });
          }
        }

        console.log("Google Drive connected successfully");
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Sync googleAccessToken state with localStorage changes
  // This catches token updates from manual session refreshes
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const storedToken = localStorage.getItem(GOOGLE_TOKEN_KEY);
      if (storedToken !== googleAccessToken) {
        console.log("Syncing Google access token from localStorage");
        setGoogleAccessToken(storedToken);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(syncInterval);
  }, [googleAccessToken]);

  // Schedule a single refresh per session, shortly before expiry.
  const scheduleSessionRefresh = (currentSession: ApiSession | null) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    if (!currentSession?.expires_at) return;

    const expiresAtMs = currentSession.expires_at * 1000;
    const now = Date.now();

    // Refresh 60s before expiry, with a floor to avoid immediate fire.
    const delay = Math.max(expiresAtMs - now - 60_000, 30_000);

    refreshTimeoutRef.current = window.setTimeout(async () => {
      // Avoid background tabs hammering the endpoint
      if (document.visibilityState !== "visible") return;

      // Prevent concurrent refreshes across tabs using a mutex pattern
      if (isRefreshingRef.current) {
        console.log("Token refresh already in progress, skipping");
        return;
      }

      try {
        isRefreshingRef.current = true;
        const refreshedSession = await ensureFreshSession();
        if (refreshedSession) {
          setSession(refreshedSession);
          setUser(refreshedSession.user ?? null);
          // Update Google access token if refreshed
          if (refreshedSession.provider_token) {
            localStorage.setItem(GOOGLE_TOKEN_KEY, refreshedSession.provider_token);
            setGoogleAccessToken(refreshedSession.provider_token);
          }
          // Re-schedule for the next refresh cycle
          scheduleSessionRefresh(refreshedSession);
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
        // Don't throw - let the session expire naturally
      } finally {
        // Reset after a short delay to allow other tabs to refresh if needed
        setTimeout(() => {
          isRefreshingRef.current = false;
        }, 5000);
      }
    }, delay);
  };

  useEffect(() => {
    let active = true;

    const fetchProfile = async () => {
      if (!user?.id) {
        setProfileOrganizationId(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      try {
        let data:
          | {
              ok?: boolean;
              organizationId?: string | number;
              organization?: { id?: string | number };
              id?: string | number;
            }
          | null
          | undefined;
        let error: any = null;
        try {
          const resp = await invokeFunction<{
            ok?: boolean;
            organizationId?: string | number;
            organization?: { id?: string | number };
            id?: string | number;
          }>(
            "ensure-workspace",
            { body: {} }
          );
          data = resp?.data;
          error = resp?.error;
        } catch (err) {
          console.error("Profile fetch failed:", err);
          data = null;
          error = err;
        }
        if (!active) return;
        const resolvedOrgId =
          data?.organizationId ?? data?.organization?.id ?? data?.id ?? null;
        if (error || !data?.ok || !resolvedOrgId) {
          setProfileOrganizationId(null);
        } else {
          setProfileOrganizationId(String(resolvedOrgId));
        }
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
    return () => {
      active = false;
    };
  }, [user?.id, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.account_type]);

  useEffect(() => {
    if (user?.id) {
      identifyPosthog({
        userId: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name ?? null,
        organizationId: profileOrganizationId,
      });
    } else {
      resetPosthog();
    }
  }, [user?.id, user?.email, user?.user_metadata?.full_name, profileOrganizationId]);

  const isEmbedded = (): boolean => {
    try {
      return window.self !== window.top;
    } catch {
      // Accessing window.top can throw in cross-origin / sandboxed iframes
      return true;
    }
  };

  // In preview (which runs embedded), the preview URL can be access-controlled.
  // Redirect OAuth back to the published site so the flow can complete reliably.
  const getAuthRedirectOrigin = (): string => {
    const base = getRedirectBase();
    const host = window.location.host;
    const isPreviewHost = host.startsWith("id-preview--");

    if (AUTH_REDIRECT_BASE?.trim()) {
      return base;
    }

    if (isEmbedded() && isPreviewHost) {
      return "https://docspeare.com";
    }

    return base;
  };

  const navigateToOAuth = (url: string, existingWindow?: Window | null) => {
    // If the caller already opened a blank tab synchronously (to avoid popup blockers), reuse it.
    if (existingWindow && !existingWindow.closed) {
      try {
        existingWindow.location.href = url;
        existingWindow.focus();
        return;
      } catch {
        // fall through
      }
    }

    // Prefer popup/new-tab for OAuth so callback can postMessage to opener.
    const opened = window.open(url, "_blank");
    if (opened) return;

    // Fallback if popup is blocked.
    window.location.assign(url);
  };

  const signInWithGoogle = async (options?: { oauthWindow?: Window | null }) => {
    const redirectPath = "/auth/callback";
    const redirectUrl = `${getAuthRedirectOrigin()}${redirectPath}`;
    let preparedOAuthWindow = options?.oauthWindow ?? null;

    // Prepare popup synchronously from click path to avoid popup blockers.
    if (!preparedOAuthWindow) {
      try {
        preparedOAuthWindow = window.open("about:blank", "_blank");
      } catch {
        preparedOAuthWindow = null;
      }
    }

    // Allow a fresh attempt to store refresh tokens after consent flows
    hasAttemptedStoreTokenRef.current = false;

    // Use skipBrowserRedirect so we can control navigation (new tab in preview iframe).
    const { url, error } = await auth.signInWithGoogle({
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    });

    if (!error && url) {
      navigateToOAuth(url, preparedOAuthWindow);
    } else if (preparedOAuthWindow && !preparedOAuthWindow.closed) {
      preparedOAuthWindow.close();
    }

    return { error };
  };

  // Separate function to request Drive access after sign-in
  // Using drive.readonly to read existing files + drive.file to create new ones
  const requestDriveAccess = async (options?: { oauthWindow?: Window | null }) => {
    const redirectPath = "/auth/callback";
    const redirectUrl = `${getAuthRedirectOrigin()}${redirectPath}`;
    let preparedOAuthWindow = options?.oauthWindow ?? null;

    // Prepare popup synchronously from click path to avoid popup blockers.
    if (!preparedOAuthWindow) {
      try {
        preparedOAuthWindow = window.open("about:blank", "_blank");
      } catch {
        preparedOAuthWindow = null;
      }
    }

    // Allow a fresh attempt to store refresh tokens after consent flows
    hasAttemptedStoreTokenRef.current = false;

    // Mark that we're about to request offline/Drive scopes so we can store the refresh token after redirect
    localStorage.setItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY, "1");

    const hasRefreshToken = localStorage.getItem(GOOGLE_DRIVE_REFRESH_PRESENT_KEY) === "1";
    const queryParams: Record<string, string> = {
      access_type: "offline",
    };
    if (!hasRefreshToken) {
      queryParams.prompt = "consent select_account";
    }

    const { url, error } = await auth.requestDriveAccess({
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
      queryParams,
    });

    if (!error && url) {
      navigateToOAuth(url, preparedOAuthWindow);
    } else if (preparedOAuthWindow && !preparedOAuthWindow.closed) {
      preparedOAuthWindow.close();
    }

    return { error };
  };

  const signInWithEmail = async (email: string, password: string) => {
    return auth.signInWithEmail(email, password);
  };

  const signUpWithEmail = async (email: string, password: string, accountType: AccountType = "individual") => {
    return auth.signUpWithEmail(email, password, {
      account_type: accountType,
    });
  };

  const signOut = async () => {
    // Clear local state immediately to prevent stale views
    setUser(null);
    setSession(null);
    setGoogleAccessToken(null);
    setProfileOrganizationId(null);
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY);

    // Let route guards handle navigation (avoids hard reloads that can hide error toasts)
    await auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        googleAccessToken,
        profileOrganizationId,
        profileLoading,
        signInWithGoogle,
        requestDriveAccess,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
