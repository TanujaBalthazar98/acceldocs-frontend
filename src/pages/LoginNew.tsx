import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { signInWithGoogle } from "@/lib/auth-new";
import { useAuth } from "@/hooks/useAuthNew";
import { FileSpreadsheet, ShieldCheck, UserPlus } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const inviteToken = searchParams.get("invite");
    if (inviteToken) {
      localStorage.setItem("acceldocs_pending_invite", inviteToken);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      const pendingInvite = localStorage.getItem("acceldocs_pending_invite");
      if (pendingInvite) {
        navigate(`/auth/callback?invite=${encodeURIComponent(pendingInvite)}`);
      } else {
        navigate("/dashboard");
      }
    }
  }, [isAuthenticated, loading, navigate]);

  async function handleGoogleSignIn() {
    try {
      setIsLoading(true);
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in failed:", error);
      const message = error instanceof Error ? error.message : "Sign in failed. Please try again.";
      alert(message);
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3 sm:mb-6 sm:gap-4">
            <div className="rounded-xl border border-border bg-background p-2 sm:p-2.5">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Acceldocs</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">Acceldata internal docs</p>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:mb-6">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-sm leading-5 text-foreground/90">
                Sign in with your <span className="font-semibold">@acceldata.io</span> Google account. If this is your first
                time, request workspace access first. Access starts as <span className="font-semibold">viewer</span> after
                owner/admin approval.
              </p>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-3 text-sm font-semibold transition-colors hover:border-primary/40 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60 sm:h-12"
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <Link
            to="/signup"
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted/50 sm:h-11"
          >
            <UserPlus className="h-4 w-4" />
            Request access
          </Link>

          <p className="mt-4 text-center text-sm text-muted-foreground sm:mt-5">
            Need workspace access help?{" "}
            <a href="mailto:tanuja@acceldata.io" className="font-semibold text-primary hover:underline">
              Contact workspace owner
            </a>
          </p>

          <p className="mt-3 text-center text-xs leading-5 text-muted-foreground sm:mt-4">
            By signing in, you agree to our <Link className="text-primary hover:underline" to="/terms">Terms</Link> and{" "}
            <Link className="text-primary hover:underline" to="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
