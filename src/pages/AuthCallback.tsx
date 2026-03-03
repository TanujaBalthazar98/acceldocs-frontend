/**
 * OAuth callback handler
 * Handles the redirect from Google OAuth
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setToken, getCurrentUser, handleGoogleCallback } from '@/lib/auth-new';
import { Loader2 } from 'lucide-react';

/**
 * After tokens are stored, notify the opener window (if popup)
 * or do a full-page redirect (if main window).
 */
function completeAuth() {
  if (window.opener && window.opener !== window) {
    // Popup flow — send tokens back to parent via postMessage
    const googleToken = localStorage.getItem('google_access_token');
    const jwt = localStorage.getItem('acceldocs_auth_token');
    const userStr = localStorage.getItem('acceldocs_user');
    const user = userStr ? JSON.parse(userStr) : null;

    window.opener.postMessage(
      {
        type: 'GOOGLE_AUTH_SUCCESS',
        accessToken: googleToken,
        jwt: jwt,
        user: user,
      },
      window.location.origin,
    );
    window.close();
    return;
  }

  // Main window — full page reload so all providers remount with fresh localStorage
  window.location.assign('/dashboard');
}

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      const token = searchParams.get('token');
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError('Authentication was cancelled or failed');
        setTimeout(() => window.location.assign('/login'), 3000);
        return;
      }

      // If we have a token directly, store it and get user
      if (token) {
        setToken(token);
        try {
          await getCurrentUser();
          completeAuth();
        } catch (err) {
          console.error('Failed to get user:', err);
          setError('Failed to load user data');
          setTimeout(() => window.location.assign('/login'), 3000);
        }
        return;
      }

      // If we have an authorization code from Google, exchange it for a token
      if (code) {
        try {
          await handleGoogleCallback(code);
          completeAuth();
        } catch (err) {
          // If user was redirected to signup (no account), don't show error
          if (err instanceof Error && err.message === 'NO_ACCOUNT_REDIRECT') return;
          console.error('OAuth code exchange failed:', err);
          setError(err instanceof Error ? err.message : 'Authentication failed');
          setTimeout(() => window.location.assign('/login'), 3000);
        }
        return;
      }

      setError('No token received');
      setTimeout(() => window.location.assign('/login'), 3000);
    }

    processCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="text-destructive text-xl font-semibold">
              {error}
            </div>
            <p className="text-muted-foreground">
              Redirecting to login...
            </p>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Signing you in...
            </div>
            <p className="text-muted-foreground">
              Please wait while we complete your authentication
            </p>
          </>
        )}
      </div>
    </div>
  );
}
