/**
 * Login page.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithGoogle } from '@/lib/auth-new';
import { useAuth } from '@/hooks/useAuthNew';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Trigger mount animation
  useEffect(() => {
    setMounted(true);
  }, []);

  // Stash invite token if present so it survives the OAuth redirect
  useEffect(() => {
    const inviteToken = searchParams.get('invite');
    if (inviteToken) {
      localStorage.setItem('acceldocs_pending_invite', inviteToken);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      const pendingInvite = localStorage.getItem('acceldocs_pending_invite');
      if (pendingInvite) {
        // Already logged in — go straight to accept the invite
        navigate(`/auth/callback?invite=${encodeURIComponent(pendingInvite)}`);
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, loading, navigate]);

  async function handleGoogleSignIn() {
    try {
      setIsLoading(true);
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in failed:', error);
      alert('Sign in failed. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Mesh Gradient Orbs */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse"
             style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"
             style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"
             style={{ animationDuration: '12s', animationDelay: '4s' }} />

        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className={`w-full max-w-md transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Logo & Branding */}
          <div className="mb-8 text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 mb-4 rounded-2xl bg-primary shadow-lg">
              <svg className="w-9 h-9 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gradient">
              Knowledge Workspace
            </h1>
            <p className="text-muted-foreground font-medium">
              Google Docs to Production Docs
            </p>
          </div>

          {/* Glassmorphic Card */}
          <div
            className={`
              relative backdrop-blur-xl bg-card/90
              rounded-3xl shadow-2xl border border-border
              transition-all duration-700 delay-200
              ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
            `}
          >
            {/* Gradient Border Accent */}
            <div className="absolute -inset-[1px] bg-primary/20 rounded-3xl blur-sm -z-10" />

            <div className="p-6 md:p-8 space-y-6">
              {/* Welcome Text */}
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-semibold text-foreground">
                  Welcome back
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sign in to access your workspace
                </p>
              </div>

              {/* Google Sign In Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="
                  group relative w-full h-14
                  bg-card
                  hover:bg-muted/70
                  border-2 border-border
                  rounded-xl
                  transition-all duration-300
                  hover:shadow-lg hover:border-primary/30
                  hover:scale-[1.02] active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                  overflow-hidden
                "
              >
                {/* Button Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                <div className="relative flex items-center justify-center space-x-3">
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
                  ) : (
                    <>
                      {/* Google Logo */}
                      <svg className="w-5 h-5 transition-transform group-hover:scale-110 duration-300" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="font-semibold text-foreground">
                        Continue with Google
                      </span>
                    </>
                  )}
                </div>
              </button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card/90 px-2 text-muted-foreground">
                    Secure Authentication
                  </span>
                </div>
              </div>

              {/* Help Text */}
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Need access?{' '}
                  <a
                    href="mailto:hello@docspeare.io"
                    className="font-semibold text-primary hover:opacity-90 transition-colors underline-offset-2 hover:underline"
                  >
                    Contact admin
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`mt-8 text-center space-y-4 transition-all duration-1000 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Security Badges */}
            <div className="flex items-center justify-center space-x-6 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1.5">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 1l-7 3v4c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V4l-7-3zm-1 13.5V8h2v6.5h-2z"/>
                </svg>
                <span className="font-medium">SSL Encrypted</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z"/>
                </svg>
                <span className="font-medium">Google OAuth</span>
              </div>
            </div>

            {/* Legal Links */}
            <p className="text-xs text-muted-foreground">
              By signing in, you agree to our{' '}
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>

      {/* Floating Decorative Elements */}
      <div className="absolute bottom-8 left-8 opacity-20">
        <div className="w-32 h-32 border-2 border-primary/40 rounded-full animate-pulse" style={{ animationDuration: '6s' }} />
      </div>
      <div className="absolute top-8 right-8 opacity-20">
        <div className="w-24 h-24 border-2 border-primary/40 rounded-full animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
      </div>
    </div>
  );
}
