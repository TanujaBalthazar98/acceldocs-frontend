import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AccountType = "individual" | "team" | "enterprise";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  googleAccessToken: string | null;
  profileOrganizationId: string | null;
  profileLoading: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  requestDriveAccess: () => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, accountType?: AccountType) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GOOGLE_TOKEN_KEY = "google_access_token";
const GOOGLE_DRIVE_ACCESS_REQUESTED_KEY = "google_drive_access_requested";

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

  // Store refresh token by calling edge function that uses admin API
  const storeRefreshToken = async () => {
    // Only attempt once per Drive-consent flow
    if (hasAttemptedStoreTokenRef.current) return;
    hasAttemptedStoreTokenRef.current = true;

    try {
      console.log("Calling store-refresh-token edge function...");
      const { data, error } = await supabase.functions.invoke("store-refresh-token");

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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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

      if (event === "SIGNED_IN" && driveConsentRequested && session?.user?.id) {
        localStorage.removeItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY);
        console.log(
          "Drive access granted, attempting to store refresh token via edge function..."
        );
        setTimeout(() => storeRefreshToken(), 500);
      }

      // Clear tokens on sign out
      if (event === "SIGNED_OUT") {
        localStorage.removeItem(GOOGLE_TOKEN_KEY);
        localStorage.removeItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY);
        setGoogleAccessToken(null);
        hasAttemptedStoreTokenRef.current = false;
      }
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
    });

    return () => subscription.unsubscribe();
  }, []);

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
      setProfileOrganizationId(data?.organization_id ?? null);
      setProfileLoading(false);
    };

    fetchProfile();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    // Basic sign-in with default scopes only (openid, email, profile)
    // Drive access is requested separately during onboarding via requestDriveAccess
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });

    return { error };
  };

  // Separate function to request Drive access after sign-in
  // Using drive.readonly to read existing files + drive.file to create new ones
  const requestDriveAccess = async () => {
    const redirectUrl = `${window.location.origin}/dashboard`;

    // Mark that we're about to request offline/Drive scopes so we can store the refresh token after redirect
    localStorage.setItem(GOOGLE_DRIVE_ACCESS_REQUESTED_KEY, "1");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        scopes:
          "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

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
    const redirectUrl = `${window.location.origin}/`;
    
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
