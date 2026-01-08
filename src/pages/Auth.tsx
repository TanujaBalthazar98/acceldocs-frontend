import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import acceldataLogo from "@/assets/acceldata-logo.svg";

type AccountType = "individual" | "team" | "enterprise";

const ALLOWED_DOMAIN = "acceldata.io";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const isAcceldataEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === ALLOWED_DOMAIN;
};

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as { from?: Location })?.from?.pathname || "/dashboard";

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      
      // Check for Acceldata domain
      if (!isAcceldataEmail(email)) {
        setErrors({ email: `Only @${ALLOWED_DOMAIN} email addresses are allowed` });
        return false;
      }
      
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === "email") fieldErrors.email = err.message;
          if (err.path[0] === "password") fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!validateForm()) return;

    setIsLoading(true);

    if (isSignUp) {
      const inferredAccountType: AccountType = "team";
      const { error } = await signUpWithEmail(email, password, inferredAccountType);
      if (error) {
        const errorMessage = error.message.includes("already registered")
          ? "This email is already registered. Please sign in instead."
          : error.message;
        setAuthError(errorMessage);
        toast({
          title: "Sign up failed",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Account created!",
          description: "You can now sign in with your credentials.",
        });
        setIsSignUp(false);
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        const errorMessage = error.message.includes("Invalid login")
          ? "Invalid email or password. Please try again."
          : error.message;
        setAuthError(errorMessage);
        toast({
          title: "Sign in failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Internal Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-muted/30">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)`,
            backgroundSize: '20px 20px'
          }} />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <img src={acceldataLogo} alt="Acceldata" className="h-8" />
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold mb-6 leading-tight">
            Acceldocs
            <span className="block text-muted-foreground text-2xl xl:text-3xl font-normal mt-2">
              for Acceldata
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-md">
            Access and manage your team's documentation. Restricted to Acceldata employees only.
          </p>

          <div className="mt-8 p-4 rounded-lg bg-background/50 border border-border/50 max-w-md">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Access restricted:</span> Only @{ALLOWED_DOMAIN} email addresses can sign in.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col">
        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
              <img src={acceldataLogo} alt="Acceldata" className="h-6" />
              <span className="text-xl font-bold text-foreground">Acceldocs</span>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">
                {isSignUp ? "Create your account" : "Welcome back"}
              </h2>
              <p className="text-muted-foreground">
                {isSignUp
                  ? "Sign up with your Acceldata email"
                  : "Sign in to access documentation"}
              </p>
            </div>

            {/* Domain Restriction Notice */}
            <div className="flex items-center gap-3 p-4 mb-6 rounded-lg bg-muted/50 border border-border text-sm">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Only @{ALLOWED_DOMAIN} emails allowed</span>
            </div>

            {/* Error Alert */}
            {authError && (
              <div className="flex items-center gap-3 p-4 mb-6 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Google Sign In */}
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-3 mb-6"
              onClick={() => signInWithGoogle()}
              disabled={isLoading}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={`you@${ALLOWED_DOMAIN}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : isSignUp ? (
                  "Create account"
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            {/* Toggle Auth Mode */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError(null);
                  setErrors({});
                }}
                className="text-primary hover:underline font-medium"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
