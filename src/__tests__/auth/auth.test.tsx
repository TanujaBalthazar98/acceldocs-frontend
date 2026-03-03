/**
 * Authentication Tests
 * 
 * Tests for authentication flow, token management, and edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Auth from '@/pages/Auth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { setupTestEnv, mockFetch, mockFetchError, mockSession, mockUser, mockLocation } from '../utils/test-helpers';
import { auth } from '@/lib/api/auth';

// Mock dependencies
vi.mock('@/lib/api/auth', () => ({
  auth: {
    signInWithGoogle: vi.fn(),
    requestDriveAccess: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
}));

vi.mock('@/lib/api/functions', () => ({
  invokeFunction: vi.fn(),
}));

vi.mock('@/lib/analytics/posthog', () => ({
  identifyPosthog: vi.fn(),
  resetPosthog: vi.fn(),
}));

describe('Authentication', () => {
  const renderWithAuth = async (ui: ReactNode) => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            {ui}
          </AuthProvider>
        </BrowserRouter>
      );
    });
  };

  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
    // Ensure AuthProvider initial session check doesn't crash tests
    (auth.getSession as any).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Auth Page', () => {
    it('should render auth page correctly', async () => {
      await renderWithAuth(<Auth />);

      expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
      expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
    });

    it('should handle Google sign in click', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({ url: 'https://oauth.url', error: null });
      (auth.signInWithGoogle as any).mockImplementation(mockSignIn);

      await renderWithAuth(<Auth />);

      const signInButton = screen.getByText(/Continue with Google/i);
      act(() => {
        signInButton.click();
      });

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled();
      });
    });

    it('should handle OAuth callback with JWT token', async () => {
      const jwt = 'test-jwt-token';
      mockLocation(`/auth?jwt=${jwt}`);

      const apiClient = await import('@/lib/api/client');
      const setTokenSpy = vi.spyOn(apiClient, 'setStrapiToken');

      await renderWithAuth(<Auth />);

      await waitFor(() => {
        expect(setTokenSpy).toHaveBeenCalled();
      });
    });

    it('should handle OAuth callback with access_token', async () => {
      const accessToken = 'test-access-token';
      mockLocation(`/auth?access_token=${accessToken}`);

      global.fetch = mockFetch({ jwt: 'test-jwt' });

      await renderWithAuth(<Auth />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle OAuth errors gracefully', async () => {
      mockLocation('/auth?error=access_denied&error_description=User%20denied%20access');

      await renderWithAuth(<Auth />);

      await waitFor(() => {
        expect(screen.getByText(/User denied access/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors during token exchange', async () => {
      const accessToken = 'test-access-token';
      mockLocation(`/auth?access_token=${accessToken}`);

      global.fetch = mockFetchError(new Error('Network error'));

      await renderWithAuth(<Auth />);

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    it('should navigate to OAuth URL on sign in', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({ url: 'https://oauth.url', error: null });
      (auth.signInWithGoogle as any).mockImplementation(mockSignIn);

      await renderWithAuth(<Auth />);

      const signInButton = screen.getByText(/Continue with Google/i);
      act(() => {
        signInButton.click();
      });

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled();
        expect(window.location.assign).toHaveBeenCalledWith('https://oauth.url');
      });
    });
  });

  describe('Protected Route', () => {
    it('should redirect to auth when not logged in', async () => {
      (auth.getSession as any).mockResolvedValue(null);

      await renderWithAuth(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should show loading state while checking auth', async () => {
      (auth.getSession as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      await renderWithAuth(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it('should render protected content when logged in', async () => {
      (auth.getSession as any).mockResolvedValue(mockSession());

      await renderWithAuth(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });
  });

  describe('Token Management', () => {
    it('should store Google access token in localStorage', async () => {
      const session = mockSession({ provider_token: 'google-token-123' });
      (auth.getSession as any).mockResolvedValue(session);

      await renderWithAuth(<div>Test</div>);

      await waitFor(() => {
        expect(localStorage.getItem('google_access_token')).toBe('google-token-123');
      });
    });

    it('should clear tokens on sign out', async () => {
      localStorage.setItem('google_access_token', 'token123');
      localStorage.setItem('strapi_jwt', 'jwt123');

      const session = mockSession();
      (auth.getSession as any).mockResolvedValue(session);
      (auth.signOut as any).mockResolvedValue(undefined);

      const TestComponent = () => {
        const { signOut } = useAuth();
        return <button onClick={signOut}>Sign Out</button>;
      };

      await renderWithAuth(<TestComponent />);

      const signOutButton = screen.getByText('Sign Out');
      act(() => {
        signOutButton.click();
      });

      await waitFor(() => {
        expect(localStorage.getItem('google_access_token')).toBeNull();
      });
    });

    it('should handle expired token refresh', async () => {
      vi.useFakeTimers();
      try {
        const expiredSession = mockSession({
          expires_at: Math.floor(Date.now() / 1000) - 100, // Expired
        });
        (auth.getSession as any).mockResolvedValue(expiredSession);

        const authSession = await import('@/lib/authSession');
        const refreshSpy = vi
          .spyOn(authSession, 'ensureFreshSession')
          .mockResolvedValue(undefined as any);

        await renderWithAuth(<div>Test</div>);

        // The refresh scheduler has a 30s minimum delay
        await act(async () => {
          await vi.advanceTimersByTimeAsync(31_000);
          await vi.runOnlyPendingTimersAsync();
        });

        expect(refreshSpy).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent login attempts', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({ url: 'https://oauth.url', error: null });
      (auth.signInWithGoogle as any).mockImplementation(mockSignIn);

      await renderWithAuth(<Auth />);

      const signInButton = screen.getByText(/Continue with Google/i);
      
      // Click multiple times rapidly
      act(() => {
        signInButton.click();
        signInButton.click();
        signInButton.click();
      });

      await waitFor(() => {
        // Should only call once or handle gracefully
        expect(mockSignIn).toHaveBeenCalled();
      });
    });

    it('should handle invalid token format', async () => {
      mockLocation('/auth?jwt=invalid-token-format');

      await renderWithAuth(<Auth />);

      // Should not crash, should handle gracefully
      await waitFor(() => {
        expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
      });
    });

    it('should handle missing redirect URL', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({ url: null, error: new Error('No URL') });
      (auth.signInWithGoogle as any).mockImplementation(mockSignIn);

      await renderWithAuth(<Auth />);

      const signInButton = screen.getByText(/Continue with Google/i);
      act(() => {
        signInButton.click();
      });

      await waitFor(() => {
        expect(screen.getByText(/No URL/i)).toBeInTheDocument();
      });
    });

    it('should handle embedded iframe scenario', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Mock iframe detection
      Object.defineProperty(window, 'self', {
        value: { ...window },
        writable: true,
      });
      Object.defineProperty(window, 'top', {
        value: { ...window },
        writable: true,
      });

      await renderWithAuth(<Auth />);

      await waitFor(() => {
        expect(screen.getByText(/in preview/i)).toBeInTheDocument();
      });
      errorSpy.mockRestore();
    });
  });
});
