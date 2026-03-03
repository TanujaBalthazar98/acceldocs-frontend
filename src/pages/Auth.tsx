import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL, setAuthToken } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { AlertCircle, BookOpen, Loader2 } from "lucide-react";

const Auth = () => {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isExchangingToken, setIsExchangingToken] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const from = (location.state as { from?: Location })?.from?.pathname || "/dashboard";

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));

    const jwt = searchParams.get("jwt") || hashParams.get("jwt");
    const accessToken = searchParams.get("access_token") || hashParams.get("access_token");
    const idToken = searchParams.get("id_token") || hashParams.get("id_token");
    const debugAuth = searchParams.get("debug_auth") === "1";

    if (jwt) {
      setAuthToken(jwt);
      if (debugAuth) {
        setAuthError("JWT received. You can now navigate to /dashboard.");
        return;
      }
      // Force reload so AuthContext picks up the new token.
      window.location.assign(from);
      return;
    }

    if (accessToken) {
      localStorage.setItem("google_access_token", accessToken);
    }

    if ((accessToken || idToken) && !jwt) {
      (async () => {
        setIsExchangingToken(true);
        try {
          const token = accessToken || idToken || "";
          const callbackUrl = `${API_BASE_URL}/auth/callback?access_token=${encodeURIComponent(token)}`;
          const response = await fetch(callbackUrl);
          const payload = await response.json().catch(() => ({}));
          if (response.ok && payload?.access_token) {
            setAuthToken(payload.access_token);
            if (debugAuth) {
              setAuthError("JWT received from callback. You can now navigate to /dashboard.");
              return;
            }
            window.location.assign(from);
            return;
          }
          setAuthError(payload?.error?.message || payload?.message || "Failed to exchange Google token.");
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : "Failed to exchange Google token.");
        } finally {
          setIsExchangingToken(false);
        }
      })();
      return;
    }

    const error = searchParams.get("error") || hashParams.get("error");
    const errorCode = searchParams.get("error_code") || hashParams.get("error_code");
    const errorDescription =
      searchParams.get("error_description") || hashParams.get("error_description");

    if (error || errorDescription || errorCode) {
      const baseMessage = errorDescription || errorCode || error || "Authentication failed.";
      const hint = baseMessage.includes("Unable to exchange external code")
        ? "Check Google provider credentials and callback URI in backend settings."
        : null;
      setAuthError(hint ? `${baseMessage} ${hint}` : baseMessage);

      if (location.search || location.hash) {
        navigate("/auth", { replace: true });
      }
    }
  }, [location.search, location.hash, navigate, from]);

  const isEmbedded = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);

    // In preview (iframe), opening the OAuth tab after an async await often gets blocked.
    // Pre-open a blank tab synchronously, then navigate it once we have the OAuth URL.
    let oauthWindow: Window | null = null;
    if (isEmbedded) {
      oauthWindow = window.open("about:blank", "_blank");
      try {
        if (oauthWindow) oauthWindow.opener = null;
      } catch {
        // ignore
      }

      if (!oauthWindow) {
        setAuthError("Popup blocked. Please allow popups for this site and try again.");
        setIsLoading(false);
        return;
      }
    }

    try {
      const { error } = await signInWithGoogle({ oauthWindow });

      if (error) {
        setAuthError(error.message || "Failed to sign in with Google. Please try again.");
      } else if (isEmbedded) {
        // In preview (iframe), OAuth opens in a new tab to avoid Okta iframe blocking.
        setAuthError("OAuth opened in a new tab. Complete sign-in there, then refresh this preview.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
          {/* Decorative Elements */}
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-2xl" />
          </div>
          
          <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
            <div className="mb-10 flex items-center gap-3 text-primary">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>

            <h1 className="text-5xl xl:text-6xl font-bold mb-4 tracking-tight">
              Knowledge Workspace
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-md">
              A calm, structured way to manage knowledge on top of Google Drive.
            </p>
          </div>
        </div>

        {/* Right Panel - Auth */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-12">
          <div className="w-full max-w-sm">
            {/* Mobile Logo */}
            <div className="flex lg:hidden flex-col items-center mb-12">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 text-primary">
                <BookOpen className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold">Knowledge Workspace</h1>
            </div>

            {/* Auth Card */}
            <div className="space-y-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-semibold mb-2">Welcome</h2>
                <p className="text-muted-foreground">
                  Sign in with your Google account (you may need to pick the right account)
                  {isEmbedded ? " — in preview, sign-in opens in a new tab (published site)." : ""}
                </p>
              </div>

              {/* Error Alert */}
              {authError && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Google Sign In Button */}
              <Button
                variant="outline"
                size="lg"
                className="w-full h-12 gap-3 text-base font-medium border-2 hover:bg-muted/50 transition-colors"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isExchangingToken}
              >
                {isLoading || isExchangingToken ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continue with Google
              </Button>

              {isExchangingToken && (
                <div className="text-sm text-muted-foreground text-center">
                  Finishing sign-in…
                </div>
              )}

              {authError && !isLoading && !isExchangingToken && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                >
                  Retry sign-in
                </Button>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Footer with Legal Links */}
      <footer className="py-4 px-6 border-t border-border">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-xs text-muted-foreground">
          <span>© 2025 Knowledge Workspace</span>
          <div className="flex items-center gap-4">
            <Link to="/help" className="hover:text-foreground transition-colors">
              Docs
            </Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Auth;
