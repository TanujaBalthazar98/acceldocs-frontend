/**
 * Hook for Google Drive authentication and token management.
 * Extracted from AuthContext – standalone, no dependency on AuthContext.
 */

import {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { auth } from "@/lib/api/auth";
import { invokeFunction } from "@/lib/api/functions";
import { setAuthToken } from "@/lib/api/client";

const GOOGLE_TOKEN_KEY = "google_access_token";
const GOOGLE_DRIVE_ACCESS_REQUESTED_KEY = "google_drive_access_requested";
const GOOGLE_DRIVE_REFRESH_PRESENT_KEY = "google_drive_refresh_token_present";
const AUTH_REDIRECT_BASE = import.meta.env.VITE_AUTH_REDIRECT_BASE as
  | string
  | undefined;

function getRedirectBase(): string {
  const base = AUTH_REDIRECT_BASE?.trim() || window.location.origin;
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function getAuthRedirectOrigin(): string {
  return getRedirectBase();
}

function navigateToOAuth(url: string, existingWindow?: Window | null): void {
  if (existingWindow && !existingWindow.closed) {
    try {
      existingWindow.location.href = url;
      existingWindow.focus();
      return;
    } catch {
      // fall through
    }
  }
  const opened = window.open(url, "_blank");
  if (opened) return;
  window.location.assign(url);
}

interface DriveAuthContextType {
  googleAccessToken: string | null;
  isDriveConnected: boolean;
  requestDriveAccess: (options?: {
    oauthWindow?: Window | null;
  }) => Promise<{ error: Error | null }>;
  signInWithGoogle: (options?: {
    oauthWindow?: Window | null;
  }) => Promise<{ error: Error | null }>;
}

const DriveAuthContext = createContext<DriveAuthContextType | undefined>(
  undefined,
);

export function DriveAuthProvider({ children }: { children: ReactNode }) {
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(
    () => localStorage.getItem(GOOGLE_TOKEN_KEY),
  );
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(
    () => localStorage.getItem(GOOGLE_DRIVE_REFRESH_PRESENT_KEY) === "1",
  );

  const hasAttemptedStoreTokenRef = useRef(false);

  const storeRefreshToken = async (refreshToken?: string) => {
    if (hasAttemptedStoreTokenRef.current) return;
    hasAttemptedStoreTokenRef.current = true;

    try {
      const { data, error } = await invokeFunction<{ success?: boolean }>(
        "store-refresh-token",
        { body: refreshToken ? { refreshToken } : {} },
      );

      if (error) {
        console.error("Failed to store refresh token:", error);
      } else if (data?.success) {
        localStorage.setItem(GOOGLE_DRIVE_REFRESH_PRESENT_KEY, "1");
        setIsDriveConnected(true);
      }
    } catch (err) {
      console.error("Error storing refresh token:", err);
    }
  };

  // Listen for auth state changes to update Google token on sign-in
  useEffect(() => {
    const { unsubscribe } = auth.onAuthStateChange((event, session) => {
      if (session?.provider_token) {
        localStorage.setItem(GOOGLE_TOKEN_KEY, session.provider_token);
        setGoogleAccessToken(session.provider_token);
      }

      const driveConsentRequested =
        localStorage.getItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY) === "1";
      const shouldStore =
        driveConsentRequested &&
        !!session?.user?.id &&
        (event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED");

      if (shouldStore) {
        localStorage.removeItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY);
        const refreshToken = session?.provider_refresh_token;
        setTimeout(() => storeRefreshToken(refreshToken ?? undefined), 500);
      }

      if (event === "SIGNED_OUT") {
        localStorage.removeItem(GOOGLE_TOKEN_KEY);
        localStorage.removeItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY);
        localStorage.removeItem(GOOGLE_DRIVE_REFRESH_PRESENT_KEY);
        setGoogleAccessToken(null);
        setIsDriveConnected(false);
        hasAttemptedStoreTokenRef.current = false;
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for OAuth popup success messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "GOOGLE_AUTH_SUCCESS") return;

      const { accessToken, jwt } = event.data;

      if (accessToken) {
        localStorage.setItem(GOOGLE_TOKEN_KEY, accessToken);
        setGoogleAccessToken(accessToken);
      }

      if (jwt) {
        setAuthToken(jwt);
      }

      // If Drive consent was pending, attempt to store the refresh token
      const driveConsentRequested =
        localStorage.getItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY) === "1";
      if (driveConsentRequested) {
        localStorage.removeItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY);
        hasAttemptedStoreTokenRef.current = false;
        setTimeout(() => storeRefreshToken(), 500);
      }

      console.log("Google auth success received from popup");
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Sync token and Drive connection state from localStorage periodically
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const storedToken = localStorage.getItem(GOOGLE_TOKEN_KEY);
      if (storedToken !== googleAccessToken) {
        setGoogleAccessToken(storedToken);
      }
      const connected =
        localStorage.getItem(GOOGLE_DRIVE_REFRESH_PRESENT_KEY) === "1";
      if (connected !== isDriveConnected) {
        setIsDriveConnected(connected);
      }
    }, 10000);

    return () => clearInterval(syncInterval);
  }, [googleAccessToken, isDriveConnected]);

  const signInWithGoogle = async (options?: {
    oauthWindow?: Window | null;
  }): Promise<{ error: Error | null }> => {
    const redirectUrl = `${getAuthRedirectOrigin()}/auth/callback`;
    let preparedOAuthWindow = options?.oauthWindow ?? null;

    if (!preparedOAuthWindow) {
      try {
        preparedOAuthWindow = window.open("about:blank", "_blank");
      } catch {
        preparedOAuthWindow = null;
      }
    }

    hasAttemptedStoreTokenRef.current = false;

    const { url, error } = await auth.signInWithGoogle({
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    });

    if (!error && url) {
      navigateToOAuth(url, preparedOAuthWindow);
    } else if (preparedOAuthWindow && !preparedOAuthWindow.closed) {
      preparedOAuthWindow.close();
    }

    return { error: error ?? null };
  };

  const requestDriveAccess = async (options?: {
    oauthWindow?: Window | null;
  }): Promise<{ error: Error | null }> => {
    const redirectUrl = `${getAuthRedirectOrigin()}/auth/callback`;
    let preparedOAuthWindow = options?.oauthWindow ?? null;

    if (!preparedOAuthWindow) {
      try {
        preparedOAuthWindow = window.open("about:blank", "_blank");
      } catch {
        preparedOAuthWindow = null;
      }
    }

    hasAttemptedStoreTokenRef.current = false;
    localStorage.setItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY, "1");

    const hasRefreshToken =
      localStorage.getItem(GOOGLE_DRIVE_REFRESH_PRESENT_KEY) === "1";
    const queryParams: Record<string, string> = { access_type: "offline" };
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

    return { error: error ?? null };
  };

  return (
    <DriveAuthContext.Provider
      value={{
        googleAccessToken,
        isDriveConnected,
        requestDriveAccess,
        signInWithGoogle,
      }}
    >
      {children}
    </DriveAuthContext.Provider>
  );
}

export function useDriveAuth(): DriveAuthContextType {
  const context = useContext(DriveAuthContext);
  if (context === undefined) {
    throw new Error("useDriveAuth must be used within a DriveAuthProvider");
  }
  return context;
}
