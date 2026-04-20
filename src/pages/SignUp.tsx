import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/api/client";
import { FileSpreadsheet, ShieldCheck, UserPlus } from "lucide-react";

const API_URL = API_BASE_URL;
const DEFAULT_WORKSPACE_ID = Number(import.meta.env.VITE_INTERNAL_WORKSPACE_ID || "1");

function getOAuthRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.detail || payload?.error || payload?.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export default function SignUp() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const workspaceId = useMemo(() => (Number.isFinite(DEFAULT_WORKSPACE_ID) ? DEFAULT_WORKSPACE_ID : 0), []);

  useEffect(() => {
    if (searchParams.get("reason") === "no_account") {
      toast({
        title: "Access request required",
        description: "Request workspace access first. An owner/admin must approve before sign-in.",
      });
    }
    if (searchParams.get("requested") === "1") {
      toast({
        title: "Request submitted",
        description: "Owner/admin has been notified. Sign in after approval.",
      });
    }
  }, [searchParams, toast]);

  async function handleRequestAccess() {
    if (!workspaceId || workspaceId <= 0) {
      toast({
        title: "Workspace not configured",
        description: "Please contact owner/admin to configure internal workspace access.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/auth/prepare-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          org_id: workspaceId,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const { signup_token } = await response.json();
      const redirectUri = getOAuthRedirectUri();
      const loginResponse = await fetch(
        `${API_URL}/auth/login?state=${encodeURIComponent(signup_token)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
      );
      if (!loginResponse.ok) throw new Error("Failed to start Google login");

      const { url } = await loginResponse.json();
      window.location.href = url;
    } catch (err: any) {
      toast({
        title: "Request failed",
        description: err.message || "Could not submit access request",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-6 sm:px-6 sm:py-10">
        <Card className="w-full border-border bg-card shadow-sm">
          <CardHeader className="space-y-4 p-4 sm:p-7">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="rounded-xl border border-border bg-background p-2 sm:p-2.5">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl tracking-tight sm:text-3xl">Acceldocs</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Acceldata internal docs</CardDescription>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Request workspace access</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Request access with your <span className="font-semibold">@acceldata.io</span> Google account. Owner/admin is notified and must approve before you can sign in.
              </p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <p className="text-sm leading-5 text-foreground/90">
                  Approved users join as <span className="font-semibold">viewer</span>. Workspace role permissions are synced to matching Google Drive folder access.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 p-4 pt-0 sm:p-7 sm:pt-0">
            <Button onClick={handleRequestAccess} disabled={submitting} className="h-11 w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              {submitting ? "Redirecting..." : "Continue with Google to request access"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already approved?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>

            <p className="text-center text-sm text-muted-foreground">
              Need help?{" "}
              <a href="mailto:tanuja@acceldata.io" className="font-semibold text-primary hover:underline">
                Contact workspace owner
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
