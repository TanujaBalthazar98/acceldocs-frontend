import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureFreshSession } from "@/lib/authSession";

type AccountType = "individual" | "team" | "enterprise";

interface AuthContextType {
  user: User | null;
  session: Session | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
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

  // Store refresh token by calling backend function.
  // If refreshToken isn't provided, the backend will try to extract it from the user's Google identity.
  const storeRefreshToken = async (refreshToken?: string) => {
    // Only attempt once per Drive-consent flow
    if (hasAttemptedStoreTokenRef.current) return;
    hasAttemptedStoreTokenRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke("store-refresh-token", {
        body: refreshToken ? { refreshToken } : {},
      });

      if (error) {
        console.error("Failed to store refresh token:", error);
      } else {
        console.log("Store refresh token result:", data);
      }
    } catch (err) {
      console.error("Error storing refresh token:", err);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
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
        setGoogleAccessToken(null);
        hasAttemptedStoreTokenRef.current = false;
      }

      // Reschedule manual refresh when session updates
      scheduleSessionRefresh(session);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Also check for provider_token on initial load
      if (session?.provider_token) {
        console.log("Initial session has provider_token, storing it");
        localStorage.setItem(GOOGLE_TOKEN_KEY, session.provider_token);
        setGoogleAccessToken(session.provider_token);
      }

      scheduleSessionRefresh(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Schedule a single refresh per session, shortly before expiry.
  const scheduleSessionRefresh = (currentSession: Session | null) => {
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
      await ensureFreshSession();
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
      const { data } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      let organizationId = data?.organization_id ?? null;

      if (!data && user.email) {
        const accountTypeRaw = user.user_metadata?.account_type;
        const accountType =
          accountTypeRaw === "team" || accountTypeRaw === "enterprise" || accountTypeRaw === "individual"
            ? accountTypeRaw
            : "individual";

        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name ?? null,
            account_type: accountType,
          })
          .select("organization_id")
          .maybeSingle();

        if (insertError && insertError.code !== "23505") {
          console.error("Failed to create missing profile:", insertError);
        } else if (inserted?.organization_id) {
          organizationId = inserted.organization_id;
        }
      }

      setProfileOrganizationId(organizationId);
      setProfileLoading(false);
    };

    fetchProfile();
    return () => {
      active = false;
    };
  }, [user?.id, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.account_type]);

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

    // Okta/SSO pages often refuse to render in iframes; the preview runs in an iframe.
    // Open OAuth in a new tab when embedded.
    if (isEmbedded()) {
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (opened) return;
    }

    window.location.assign(url);
  };

  const signInWithGoogle = async (options?: { oauthWindow?: Window | null }) => {
    const redirectUrl = `${getAuthRedirectOrigin()}/dashboard`;

    // Allow a fresh attempt to store refresh tokens after consent flows
    hasAttemptedStoreTokenRef.current = false;

    // Use skipBrowserRedirect so we can control navigation (new tab in preview iframe).
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (!error && data?.url) {
      navigateToOAuth(data.url, options?.oauthWindow);
    }

    return { error };
  };

  // Separate function to request Drive access after sign-in
  // Using drive.readonly to read existing files + drive.file to create new ones
  const requestDriveAccess = async (options?: { oauthWindow?: Window | null }) => {
    const redirectUrl = `${getAuthRedirectOrigin()}/dashboard`;

    // Allow a fresh attempt to store refresh tokens after consent flows
    hasAttemptedStoreTokenRef.current = false;

    // Mark that we're about to request offline/Drive scopes so we can store the refresh token after redirect
    localStorage.setItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY, "1");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        scopes:
          "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
        queryParams: {
          access_type: "offline",
          prompt: "consent select_account",
        },
      },
    });

    if (!error && data?.url) {
      navigateToOAuth(data.url, options?.oauthWindow);
    }

    return { error };
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signUpWithEmail = async (email: string, password: string, accountType: AccountType = "individual") => {
    const redirectUrl = `${getRedirectBase()}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          account_type: accountType,
        },
      },
    });

    return { error };
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
    await supabase.auth.signOut();
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
