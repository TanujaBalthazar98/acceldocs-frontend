import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthProvider as NewAuthProvider } from "@/hooks/useAuthNew";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";

// New auth pages
import LoginPage from "./pages/LoginNew";
import SignUpPage from "./pages/SignUp";
import AuthCallbackPage from "./pages/AuthCallback";
import AdminDashboard from "./pages/admin/Dashboard";

// Original pages
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import PagePreview from "./pages/PagePreview";
import Docs from "./pages/Docs";
import DocsRedirect from "./pages/DocsRedirect";
import InternalDocsRedirect from "./pages/InternalDocsRedirect";
import APIDocs from "./pages/APIDocs";
import MCPDocs from "./pages/MCPDocs";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Help from "./pages/Help";
import Support from "./pages/Support";
import ReportIssue from "./pages/ReportIssue";
import NotFound from "./pages/NotFound";
import AutomationConsole from "./pages/AutomationConsole";

const queryClient = new QueryClient();
const useAutomationBackend = import.meta.env.VITE_USE_AUTOMATION_BACKEND === "true";

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <NewAuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <ErrorBoundary>
                    <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Index />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/support/report-issue" element={<ReportIssue />} />

                    {/* New Auth routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/auth/callback" element={<AuthCallbackPage />} />

                    {/* Admin routes (new auth system) */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* Dashboard route */}
                    <Route
                      path="/dashboard/*"
                      element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* Automation console (optional) */}
                    {useAutomationBackend && (
                      <Route path="/automation" element={<ProtectedRoute><AutomationConsole /></ProtectedRoute>} />
                    )}

                    {/* Protected page preview */}
                    <Route
                      path="/page/:id"
                      element={
                        <ProtectedRoute>
                          <PagePreview />
                        </ProtectedRoute>
                      }
                    />

                    {/* Public documentation routes */}
                    <Route path="/docs" element={<Docs />} />
                    <Route path="/docs/:orgSlug/*" element={<DocsRedirect />} />

                    {/* Internal docs routes map to the authenticated workspace directly. */}
                    <Route
                      path="/internal"
                      element={
                        <ProtectedRoute>
                          <InternalDocsRedirect />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/internal/:orgSlug/*"
                      element={
                        <ProtectedRoute>
                          <InternalDocsRedirect />
                        </ProtectedRoute>
                      }
                    />

                    {/* Standalone API documentation routes */}
                    <Route path="/api/:orgSlug" element={<APIDocs />} />

                    {/* Standalone MCP documentation routes */}
                    <Route path="/mcp/:orgSlug" element={<MCPDocs />} />

                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                    </Routes>
                  </ErrorBoundary>
                </BrowserRouter>
              </TooltipProvider>
            </NewAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
