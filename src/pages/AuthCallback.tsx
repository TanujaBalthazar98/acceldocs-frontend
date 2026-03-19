/**
 * OAuth callback handler
 * Handles the redirect from Google OAuth
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setToken, getCurrentUser, handleGoogleCallback } from '@/lib/auth-new';
import { apiFetch } from '@/lib/api/client';
import { Loader2, CheckCircle2 } from 'lucide-react';

const ORG_ID_KEY = 'acceldocs_current_org_id';

/**
 * Decode a ``next`` docs URL from the OAuth state parameter.
 * Returns null if state is absent, malformed, or has no next key.
 */
function extractDocsNextFromState(state: string | null): string | null {
  if (!state) return null;
  try {
    // state is base64url-encoded JSON produced by /auth/docs-login
    const decoded = JSON.parse(atob(state.replace(/-/g, '+').replace(/_/g, '/')));
    const next = decoded?.next;
    if (typeof next === 'string' && next.startsWith('http')) return next;
  } catch {
    // Not our JSON state — could be a signup token or other value
  }
  return null;
}

/**
 * Accept an invite token by calling the backend.
 * Returns the result or an object with errorMessage on failure.
 */
async function acceptInviteToken(inviteToken: string): Promise<{
  ok: boolean;
  status: string;
  role: string;
  organization?: { id: number; name: string; slug: string };
  errorMessage?: string;
}> {
  const resp = await apiFetch<{
    ok: boolean;
    status: string;
    role: string;
    organization?: { id: number; name: string; slug: string };
  }>('/api/org/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token: inviteToken }),
  });
  if (resp.error) {
    console.error('Failed to accept invite:', resp.error.message);
    return { ok: false, status: 'error', role: '', errorMessage: resp.error.message };
  }
  return resp.data ?? { ok: false, status: 'error', role: '', errorMessage: 'Empty response' };
}

/**
 * After tokens are stored, notify the opener window (if popup)
 * or do a full-page redirect (if main window).
 *
 * If a ``docsNextUrl`` is provided (from /auth/docs-login flow),
 * redirect to that docs page with an auth_token query param so
 * the backend can bootstrap the session cookie.
 */
function completeAuth(docsNextUrl?: string | null) {
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

  // If we have a docs next URL (from the gate page sign-in), redirect there
  // with the auth token so the backend can bootstrap the cookie.
  if (docsNextUrl) {
    const token = localStorage.getItem('acceldocs_auth_token');
    if (token) {
      const u = new URL(docsNextUrl);
      u.searchParams.set('auth_token', token);
      window.location.assign(u.toString());
      return;
    }
  }

  // Main window — full page reload so all providers remount with fresh localStorage
  window.location.assign('/dashboard');
}

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{
    status: string;
    role: string;
    orgName?: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState('Signing you in...');

  useEffect(() => {
    async function processCallback() {
      const token = searchParams.get('token');
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      const stateParam = searchParams.get('state');
      // Invite token: from URL param or stashed in localStorage before OAuth redirect
      const inviteToken = searchParams.get('invite') || localStorage.getItem('acceldocs_pending_invite');
      const docsNextUrl = extractDocsNextFromState(stateParam);

      if (errorParam) {
        setError('Authentication was cancelled or failed');
        setTimeout(() => window.location.assign('/login'), 3000);
        return;
      }

      // Helper: after auth is done, handle invite acceptance if present
      async function handlePostAuth() {
        if (inviteToken) {
          setStatusMessage('Accepting invitation...');
          localStorage.removeItem('acceldocs_pending_invite');
          const result = await acceptInviteToken(inviteToken);
          if (result.ok || result.status === 'accepted' || result.status === 'already_member') {
            if (result.organization?.id) {
              localStorage.setItem(ORG_ID_KEY, String(result.organization.id));
            }
            setInviteResult({
              status: result.status,
              role: result.role,
              orgName: result.organization?.name,
            });
            setTimeout(() => window.location.assign('/dashboard'), 2000);
            return;
          }
          // Show error to user instead of silently ignoring
          setError(`Failed to accept invitation: ${result.errorMessage || 'Unknown error'}`);
          setTimeout(() => window.location.assign('/dashboard'), 4000);
          return;
        }
        completeAuth(docsNextUrl);
      }

      // If we have a token directly, store it and get user
      if (token) {
        setToken(token);
        try {
          await getCurrentUser();
          await handlePostAuth();
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
          await handlePostAuth();
        } catch (err) {
          // If user was redirected to signup (no account), preserve invite token
          if (err instanceof Error && (err.message === 'NO_ACCOUNT_REDIRECT' || err.message === 'JOIN_REQUEST_PENDING_REDIRECT')) {
            // Re-stash the invite token so it survives through the signup flow
            if (inviteToken) {
              localStorage.setItem('acceldocs_pending_invite', inviteToken);
            }
            return;
          }
          console.error('OAuth code exchange failed:', err);
          setError(err instanceof Error ? err.message : 'Authentication failed');
          setTimeout(() => window.location.assign('/login'), 3000);
        }
        return;
      }

      // No code/token but have an invite token — user might already be logged in
      if (inviteToken) {
        localStorage.removeItem('acceldocs_pending_invite');
        const existingToken = localStorage.getItem('acceldocs_auth_token');
        if (existingToken) {
          setStatusMessage('Accepting invitation...');
          const result = await acceptInviteToken(inviteToken);
          if (result.ok || result.status === 'accepted' || result.status === 'already_member') {
            if (result.organization?.id) {
              localStorage.setItem(ORG_ID_KEY, String(result.organization.id));
            }
            setInviteResult({
              status: result.status,
              role: result.role,
              orgName: result.organization?.name,
            });
            setTimeout(() => window.location.assign('/dashboard'), 2000);
            return;
          }
          // Show the actual error
          setError(`Failed to accept invitation: ${result.errorMessage || 'Unknown error'}`);
          setTimeout(() => window.location.assign('/dashboard'), 4000);
          return;
        }
        // Not logged in — stash token and redirect to login
        localStorage.setItem('acceldocs_pending_invite', inviteToken);
        window.location.assign('/login?invite=' + encodeURIComponent(inviteToken));
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
        ) : inviteResult ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {inviteResult.status === 'already_member'
                ? `You're already a member!`
                : `You've joined${inviteResult.orgName ? ` ${inviteResult.orgName}` : ''}!`}
            </div>
            <p className="text-muted-foreground">
              {inviteResult.status === 'already_member'
                ? 'Redirecting to dashboard...'
                : `You've been added as ${inviteResult.role}. Redirecting...`}
            </p>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {statusMessage}
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
