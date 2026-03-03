/**
 * React hook for authentication state management
 */

import { useState, useEffect, useMemo, createContext, useContext, ReactNode } from 'react';
import {
  User,
  getStoredUser,
  getCurrentUser,
  isAuthenticated as checkAuth,
  signOut as authSignOut,
} from '@/lib/auth-new';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    setLoading(true);
    setError(null);

    try {
      // Check if we have a token
      if (!checkAuth()) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Try to load from localStorage first (instant)
      const storedUser = getStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }

      // Then fetch fresh data from backend
      const freshUser = await getCurrentUser();
      setUser(freshUser);
    } catch (err) {
      console.error('Failed to load user:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await authSignOut();
    setUser(null);
  }

  async function refreshUser() {
    await loadUser();
  }

  const value: AuthContextType = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: user !== null,
      signOut,
      refreshUser,
    }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
