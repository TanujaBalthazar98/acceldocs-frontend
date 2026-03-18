import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage from "@/pages/LoginNew";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuthNew";
import { signInWithGoogle } from "@/lib/auth-new";
import { setupTestEnv } from "../utils/test-helpers";

vi.mock("@/hooks/useAuthNew", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/auth-new", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-new")>("@/lib/auth-new");
  return {
    ...actual,
    signInWithGoogle: vi.fn(),
  };
});

type MockAuthState = {
  user: {
    id: number;
    email: string;
    name: string;
    role: "viewer" | "editor" | "reviewer" | "admin";
    google_id: string;
    created_at: string;
  } | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const makeAuthState = (overrides: Partial<MockAuthState> = {}): MockAuthState => ({
  user: null,
  loading: false,
  isAuthenticated: false,
  error: null,
  signOut: vi.fn(async () => undefined),
  refreshUser: vi.fn(async () => undefined),
  ...overrides,
});

const renderWithRouter = (ui: ReactNode, initialEntries = ["/"]) => {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
};

describe("Authentication", () => {
  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
    localStorage.clear();
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue(makeAuthState());
  });

  describe("Login page", () => {
    it("renders login page", async () => {
      renderWithRouter(<LoginPage />, ["/login"]);

      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
    });

    it("starts Google sign-in when CTA is clicked", async () => {
      (signInWithGoogle as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      renderWithRouter(<LoginPage />, ["/login"]);

      await act(async () => {
        screen.getByText(/continue with google/i).click();
      });

      await waitFor(() => {
        expect(signInWithGoogle).toHaveBeenCalledTimes(1);
      });
    });

    it("stores invite token from query param", async () => {
      renderWithRouter(<LoginPage />, ["/login?invite=abc123"]);

      await waitFor(() => {
        expect(localStorage.getItem("acceldocs_pending_invite")).toBe("abc123");
      });
    });

    it("redirects authenticated users to dashboard", async () => {
      (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        makeAuthState({
          user: {
            id: 1,
            email: "user@example.com",
            name: "User",
            role: "editor",
            google_id: "gid",
            created_at: new Date().toISOString(),
          },
          isAuthenticated: true,
        })
      );

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
      });
    });
  });

  describe("ProtectedRoute", () => {
    it("shows loading state while auth is loading", () => {
      (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        makeAuthState({ loading: true })
      );

      render(
        <MemoryRouter initialEntries={["/private"]}>
          <Routes>
            <Route
              path="/private"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("redirects unauthenticated users to /login", async () => {
      render(
        <MemoryRouter initialEntries={["/private"]}>
          <Routes>
            <Route path="/login" element={<div>Login Route</div>} />
            <Route
              path="/private"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Login Route")).toBeInTheDocument();
      });
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("renders protected content for authenticated users", async () => {
      (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        makeAuthState({
          user: {
            id: 1,
            email: "user@example.com",
            name: "User",
            role: "editor",
            google_id: "gid",
            created_at: new Date().toISOString(),
          },
          isAuthenticated: true,
        })
      );

      render(
        <MemoryRouter initialEntries={["/private"]}>
          <Routes>
            <Route
              path="/private"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Protected Content")).toBeInTheDocument();
      });
    });

    it("blocks when role requirement is not met", async () => {
      (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        makeAuthState({
          user: {
            id: 1,
            email: "viewer@example.com",
            name: "Viewer",
            role: "viewer",
            google_id: "gid2",
            created_at: new Date().toISOString(),
          },
          isAuthenticated: true,
        })
      );

      render(
        <MemoryRouter initialEntries={["/private"]}>
          <Routes>
            <Route
              path="/private"
              element={
                <ProtectedRoute requiredRole="editor">
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
  });
});
