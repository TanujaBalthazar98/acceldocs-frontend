import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import PagePreview from "./pages/PagePreview";
import Docs from "./pages/Docs";
import APIDocs from "./pages/APIDocs";
import MCPDocs from "./pages/MCPDocs";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Help from "./pages/Help";
import AddonSetup from "./pages/AddonSetup";
import AdminConfig from "./pages/AdminConfig";
import Support from "./pages/Support";
import ReportIssue from "./pages/ReportIssue";
import PostInstall from "./pages/PostInstall";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/help" element={<Help />} />
                <Route path="/support" element={<Support />} />
                <Route path="/support/report-issue" element={<ReportIssue />} />
                <Route path="/post-install" element={<PostInstall />} />
                <Route path="/docs/addon-setup" element={<AddonSetup />} />
                <Route path="/docs/admin-config" element={<AdminConfig />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/page/:id"
                  element={
                    <ProtectedRoute>
                      <PagePreview />
                    </ProtectedRoute>
                  }
                />
                {/* Public documentation routes - slug-based URLs with redirect support */}
                <Route path="/docs" element={<Docs />} />
                <Route path="/docs/:orgSlug" element={<Docs />} />
                <Route path="/docs/:orgSlug/:projectSlug" element={<Docs />} />
                <Route path="/docs/:orgSlug/:projectSlug/:pageSlug" element={<Docs />} />
                <Route path="/docs/:orgSlug/:projectSlug/:topicSlug/:pageSlug" element={<Docs />} />
                <Route path="/docs/:orgSlug/:projectSlug/:versionSlug/:topicSlug/:pageSlug" element={<Docs />} />
                {/* Internal documentation routes - domain-restricted */}
                <Route path="/internal" element={<Docs mode="internal" />} />
                <Route path="/internal/:orgSlug" element={<Docs mode="internal" />} />
                <Route path="/internal/:orgSlug/:projectSlug" element={<Docs mode="internal" />} />
                <Route path="/internal/:orgSlug/:projectSlug/:pageSlug" element={<Docs mode="internal" />} />
                <Route path="/internal/:orgSlug/:projectSlug/:topicSlug/:pageSlug" element={<Docs mode="internal" />} />
                <Route path="/internal/:orgSlug/:projectSlug/:versionSlug/:topicSlug/:pageSlug" element={<Docs mode="internal" />} />
                {/* Standalone API documentation routes */}
                <Route path="/api/:orgSlug" element={<APIDocs />} />
                {/* Standalone MCP documentation routes */}
                <Route path="/mcp/:orgSlug" element={<MCPDocs />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
