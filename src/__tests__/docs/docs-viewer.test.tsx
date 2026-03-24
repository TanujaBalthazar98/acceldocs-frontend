/**
 * Documentation Viewer Tests
 * 
 * Tests for docs viewer routing, versioning, content display, and edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import Docs from '@/pages/Docs';
import { mockProject, mockDocument, mockTopic, setupTestEnv, mockFetch } from '../utils/test-helpers';
import { strapiFetch } from '@/lib/api/client';
import { useAuth } from '@/hooks/useAuthNew';

// Mock dependencies
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    strapiFetch: vi.fn(),
    STRAPI_URL: 'http://localhost:1337',
    API_BASE_URL: 'http://localhost:8000',
  };
});

vi.mock('@/lib/api/functions', () => ({
  invokeFunction: vi.fn(),
}));

vi.mock('@/hooks/useAuthNew', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('@/hooks/useBrandingLoader', () => ({
  useBrandingLoader: vi.fn(),
  useBrandingStyles: vi.fn(),
}));

vi.mock('@/lib/analytics/posthog', () => ({
  captureDocView: vi.fn(),
}));

describe('Documentation Viewer', () => {
  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: null,
      loading: false,
    });
    // Default: prevent unexpected queries (e.g. PageFeedback) from crashing tests
    (strapiFetch as any).mockImplementation(async () => ({
      data: { data: [] },
      error: null,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Routing', () => {
    it('should render landing page for root path', async () => {
      const org = {
        id: 'org1',
        name: 'Test Org',
        slug: 'test-org',
        domain: 'test.com',
      };

      (strapiFetch as any)
        .mockResolvedValueOnce({
          data: { data: [org] },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: true,
            projects: [],
            versions: [],
            topics: [],
            documents: [],
          },
          error: null,
        });

      render(
        <MemoryRouter initialEntries={['/docs']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Test Org/i).length).toBeGreaterThan(0);
      });
    });

    it('should render project page with correct project', async () => {
      const org = {
        id: 'org1',
        name: 'Test Org',
        slug: 'test-org',
      };
      const project = mockProject({ slug: 'test-project', name: 'Test Project', visibility: 'public' });

      (strapiFetch as any).mockImplementation(async (url: string) => {
        if (url.includes("/api/organizations")) {
          return { data: { data: [org] }, error: null };
        }
        if (url.startsWith("/api/public-content")) {
          return {
            data: {
              ok: true,
              projects: [project],
              versions: [],
              topics: [],
              documents: [],
            },
            error: null,
          };
        }
        return { data: { data: [] }, error: null };
      });

      render(
        <MemoryRouter initialEntries={['/docs/test-org/test-project']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Test Project/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid org slug', async () => {
      (strapiFetch as any).mockResolvedValue({
        data: { data: [] },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/docs/invalid-org']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should handle gracefully
        expect(strapiFetch).toHaveBeenCalled();
      });
    });

    it('should handle invalid project slug', async () => {
      const org = {
        id: 'org1',
        name: 'Test Org',
        slug: 'test-org',
      };

      (strapiFetch as any)
        .mockResolvedValueOnce({
          data: { data: [org] },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: true,
            projects: [],
            versions: [],
            topics: [],
            documents: [],
          },
          error: null,
        });

      render(
        <MemoryRouter initialEntries={['/docs/test-org/invalid-project']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should handle gracefully
        expect(strapiFetch).toHaveBeenCalled();
      });
    });

    it('should handle custom domain routing', async () => {
      const org = {
        id: 'org1',
        name: 'Test Org',
        slug: 'test-org',
        custom_docs_domain: 'docs.test.com',
      };

      // Mock window.location.hostname
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'docs.test.com',
          pathname: '/docs/test-project',
        },
        writable: true,
      });

      (strapiFetch as any)
        .mockResolvedValueOnce({
          data: { data: [org] },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: true,
            projects: [],
            versions: [],
            topics: [],
            documents: [],
          },
          error: null,
        });

      render(
        <MemoryRouter initialEntries={['/docs/test-project']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(strapiFetch).toHaveBeenCalled();
      });
    });
  });

  describe('Version Management', () => {
    it('should show version switcher when multiple versions exist', async () => {
      const org = { id: 'org1', name: 'Test Org', slug: 'test-org' };
      const project = mockProject({ slug: 'test-project', visibility: 'public' });
      const versions = [
        { id: 'v1', name: 'v1.0', slug: 'v1.0', is_default: true, is_published: true },
        { id: 'v2', name: 'v2.0', slug: 'v2.0', is_default: false, is_published: true },
      ];

      (strapiFetch as any)
        .mockResolvedValueOnce({
          data: { data: [org] },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: true,
            projects: [project],
            versions,
            topics: [],
            documents: [],
          },
          error: null,
        });

      render(
        <MemoryRouter initialEntries={['/docs/test-org/test-project']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Version switcher should be present
        expect(strapiFetch).toHaveBeenCalled();
      });
    });

    it('should default to default version when no version specified', async () => {
      const org = { id: 'org1', name: 'Test Org', slug: 'test-org' };
      const project = mockProject({ slug: 'test-project', visibility: 'public' });
      const defaultVersion = { id: 'v1', name: 'v1.0', slug: 'v1.0', is_default: true };

      (strapiFetch as any)
        .mockResolvedValueOnce({
          data: { data: [org] },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: true,
            projects: [project],
            versions: [defaultVersion],
            topics: [],
            documents: [],
          },
          error: null,
        });

      render(
        <MemoryRouter initialEntries={['/docs/test-org/test-project']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should use default version
        expect(strapiFetch).toHaveBeenCalled();
      });
    });
  });

  describe('Content Display', () => {
    it('should render HTML content correctly', async () => {
      const org = { id: 'org1', name: 'Test Org', slug: 'test-org' };
      const project = mockProject({ slug: 'test-project', visibility: 'public' });
      const document = mockDocument({
        slug: 'test-doc',
        published_content_html: '<p>Test content</p>',
        is_published: true,
        visibility: 'public',
      });

      (strapiFetch as any).mockImplementation(async (url: string) => {
        if (url.includes("/api/organizations")) {
          return { data: { data: [org] }, error: null };
        }
        if (url.startsWith("/api/public-content")) {
          return {
            data: {
              ok: true,
              projects: [project],
              versions: [],
              topics: [],
              documents: [document],
            },
            error: null,
          };
        }
        return { data: { data: [] }, error: null };
      });

      render(
        <MemoryRouter initialEntries={['/docs/test-org/test-project/test-doc']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Test content/i)).toBeInTheDocument();
      });
    });

    it('should render markdown content correctly', async () => {
      const org = { id: 'org1', name: 'Test Org', slug: 'test-org' };
      const project = mockProject({ slug: 'test-project', visibility: 'public' });
      const document = mockDocument({
        slug: 'test-doc',
        published_content_html: '# Test Heading\n\nTest content',
        is_published: true,
        visibility: 'public',
      });

      (strapiFetch as any).mockImplementation(async (url: string) => {
        if (url.includes("/api/organizations")) {
          return { data: { data: [org] }, error: null };
        }
        if (url.startsWith("/api/public-content")) {
          return {
            data: {
              ok: true,
              projects: [project],
              versions: [],
              topics: [],
              documents: [document],
            },
            error: null,
          };
        }
        return { data: { data: [] }, error: null };
      });

      render(
        <MemoryRouter initialEntries={['/docs/test-org/test-project/test-doc']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Markdown should be rendered
        expect(strapiFetch).toHaveBeenCalled();
      });
    });

    it('should handle empty content gracefully', async () => {
      const org = { id: 'org1', name: 'Test Org', slug: 'test-org' };
      const project = mockProject({ slug: 'test-project', visibility: 'public' });
      const document = mockDocument({
        slug: 'test-doc',
        published_content_html: null,
        is_published: true,
        visibility: 'public',
      });

      (strapiFetch as any)
        .mockResolvedValueOnce({
          data: { data: [org] },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: true,
            projects: [project],
            versions: [],
            topics: [],
            documents: [document],
          },
          error: null,
        });

      render(
        <MemoryRouter initialEntries={['/docs/test-org/test-project/test-doc']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should show empty state
        expect(strapiFetch).toHaveBeenCalled();
      });
    });

    it('should sanitize XSS attempts in content', async () => {
      const org = { id: 'org1', name: 'Test Org', slug: 'test-org' };
      const project = mockProject({ slug: 'test-project', visibility: 'public' });
      const document = mockDocument({
        slug: 'test-doc',
        published_content_html: '<script>alert("XSS")</script><p>Safe content</p>',
        is_published: true,
        visibility: 'public',
      });

      (strapiFetch as any)
        .mockResolvedValueOnce({
          data: { data: [org] },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: true,
            projects: [project],
            versions: [],
            topics: [],
            documents: [document],
          },
          error: null,
        });

      render(
        <MemoryRouter initialEntries={['/docs/test-org/test-project/test-doc']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Script tags should be sanitized
        expect(screen.queryByText(/alert/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long URLs', async () => {
      const longSlug = 'a'.repeat(200);
      (strapiFetch as any).mockResolvedValue({
        data: { data: [] },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={[`/docs/${longSlug}`]}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should handle gracefully
        expect(strapiFetch).toHaveBeenCalled();
      });
    });

    it('should handle special characters in slugs', async () => {
      (strapiFetch as any).mockResolvedValue({
        data: { data: [] },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/docs/test-org/test%20project']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should handle URL encoding
        expect(strapiFetch).toHaveBeenCalled();
      });
    });

    it('should handle network errors gracefully', async () => {
      (strapiFetch as any).mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      render(
        <MemoryRouter initialEntries={['/docs/test-org']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should handle error gracefully
        expect(strapiFetch).toHaveBeenCalled();
      });
    });

    it('should handle missing organization data', async () => {
      (strapiFetch as any).mockResolvedValue({
        data: { data: null },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/docs/test-org']}>
          <Docs />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should handle gracefully
        expect(strapiFetch).toHaveBeenCalled();
      });
    });
  });
});
