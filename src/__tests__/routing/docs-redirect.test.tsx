import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/api/client", () => ({
  API_BASE_URL: "https://docs-backend.example.com",
  getAuthToken: () => null,
}));

vi.mock("@/pages/Docs", () => ({
  __esModule: true,
  default: () => <div data-testid="legacy-docs">legacy-docs</div>,
}));

import DocsRedirect, {
  buildDocsRedirectTarget,
  normalizePublicDocsPathForBackend,
  shouldRedirectToBackend,
} from "@/pages/DocsRedirect";

describe("DocsRedirect", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds backend target url from current path", () => {
    expect(
      buildDocsRedirectTarget({
        orgSlug: "acme",
        pathname: "/docs/acme/release-notes/version-4-9/3-version-4-9-0",
        search: "?q=v4.9",
        hash: "#intro",
        apiBaseUrl: "https://docs-backend.example.com",
      }),
    ).toBe("https://docs-backend.example.com/docs/acme/3-version-4-9-0?q=v4.9#intro");
  });

  it("normalizes legacy deep docs routes to backend page routes", () => {
    expect(normalizePublicDocsPathForBackend("/docs/acme", "acme")).toBe("/docs/acme");
    expect(normalizePublicDocsPathForBackend("/docs/acme/release-notes", "acme")).toBe(
      "/docs/acme/release-notes",
    );
    expect(
      normalizePublicDocsPathForBackend("/docs/acme/adoc/release-notes/3-version-4-9-0", "acme"),
    ).toBe("/docs/acme/3-version-4-9-0");
    expect(normalizePublicDocsPathForBackend("/docs/acme/search", "acme")).toBe(
      "/docs/acme/search",
    );
    expect(normalizePublicDocsPathForBackend("/docs/acme/p/42/getting-started", "acme")).toBe(
      "/docs/acme/p/42/getting-started",
    );
  });

  it("only redirects when target differs from current url", () => {
    expect(shouldRedirectToBackend("https://a/docs/acme", "https://b/docs/acme")).toBe(true);
    expect(shouldRedirectToBackend("https://a/docs/acme", "https://a/docs/acme")).toBe(false);
    expect(shouldRedirectToBackend("", "https://a/docs/acme")).toBe(false);
  });

  it("shows backend redirect target for org-scoped docs routes", () => {
    render(
      <MemoryRouter initialEntries={["/docs/acme/adoc/release-notes/3-version-4-9-0"]}>
        <Routes>
          <Route path="/docs/:orgSlug/*" element={<DocsRedirect />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Redirecting to published docs/i)).toBeInTheDocument();
    expect(
      screen.getByText("https://docs-backend.example.com/docs/acme/3-version-4-9-0"),
    ).toBeInTheDocument();
  });

  it("preserves canonical id-based docs routes when redirecting", () => {
    render(
      <MemoryRouter initialEntries={["/docs/acme/p/42/getting-started"]}>
        <Routes>
          <Route path="/docs/:orgSlug/*" element={<DocsRedirect />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Redirecting to published docs/i)).toBeInTheDocument();
    expect(
      screen.getByText("https://docs-backend.example.com/docs/acme/p/42/getting-started"),
    ).toBeInTheDocument();
  });

  it("falls back to legacy docs renderer when org slug is missing", () => {
    render(
      <MemoryRouter initialEntries={["/docs"]}>
        <Routes>
          <Route path="/docs" element={<DocsRedirect />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("legacy-docs")).toBeInTheDocument();
  });
});
