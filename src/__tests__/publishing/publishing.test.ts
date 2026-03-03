/**
 * Publishing System Tests
 * 
 * Tests for publish/unpublish operations, visibility levels, and edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardActions } from '@/hooks/useDashboardActions';
import { mockProject, mockDocument, setupTestEnv } from '../utils/test-helpers';
import { invokeFunction } from '@/lib/api/functions';

// Mock dependencies
vi.mock('@/lib/api/functions', () => ({
  invokeFunction: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  strapiFetch: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/dashboard' }),
}));

describe('Publishing System', () => {
  const mockToast = vi.fn();
  const mockFetchData = vi.fn();
  const mockLogAction = vi.fn();
  const mockLogUnauthorizedAttempt = vi.fn();
  const mockCanPublishForProject = vi.fn().mockResolvedValue(true);

  const defaultProps = {
    user: { id: 'user1', email: 'test@example.com' },
    googleAccessToken: 'token123',
    toast: mockToast,
    projects: [mockProject()],
    documents: [mockDocument()],
    setDocuments: vi.fn(),
    selectedProject: mockProject(),
    setSelectedProject: vi.fn(),
    selectedTopic: null,
    setSelectedTopic: vi.fn(),
    selectedDocument: null,
    setSelectedDocument: vi.fn(),
    selectedPage: null,
    setSelectedPage: vi.fn(),
    permissions: {
      canPublish: true,
      canUnpublish: true,
      canDeleteDocument: true,
    },
    logAction: mockLogAction,
    logUnauthorizedAttempt: mockLogUnauthorizedAttempt,
    canPublishForProject: mockCanPublishForProject,
    fetchData: mockFetchData,
    trashFile: vi.fn().mockResolvedValue({ success: true }),
    resolveDefaultVersion: vi.fn().mockReturnValue({ id: 'v1' }),
    getAssignableTopics: vi.fn().mockReturnValue([]),
    ensureDefaultVersionForProject: vi.fn().mockResolvedValue('v1'),
    navigate: vi.fn(),
    signOut: vi.fn(),
  };

  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Publish Operations', () => {
    it('should publish document successfully', async () => {
      const document = mockDocument({ id: 'doc123', is_published: false });
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const props = {
        ...defaultProps,
        documents: [document],
        selectedDocument: document,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      const event = { stopPropagation: vi.fn() } as any;
      await act(async () => {
        await result.current.handleTogglePublishPage(event, 'doc123', false);
      });

      expect(invokeFunction).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it('should unpublish document successfully', async () => {
      const document = mockDocument({ id: 'doc123', is_published: true });
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const props = {
        ...defaultProps,
        documents: [document],
        selectedDocument: document,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      const event = { stopPropagation: vi.fn() } as any;
      await act(async () => {
        await result.current.handleTogglePublishPage(event, 'doc123', true);
      });

      expect(invokeFunction).toHaveBeenCalled();
    });

    it('should handle publish permission denied', async () => {
      const propsWithoutPermission = {
        ...defaultProps,
        permissions: { ...defaultProps.permissions, canPublish: false },
      };

      const { result } = renderHook(() => useDashboardActions(propsWithoutPermission));

      await waitFor(async () => {
        const event = { stopPropagation: vi.fn() } as any;
        await result.current.handleTogglePublishPage(event, 'doc123', false);
        expect(mockLogUnauthorizedAttempt).toHaveBeenCalled();
      });
    });

    it('should handle publish with no content', async () => {
      const document = mockDocument({
        id: 'doc123',
        is_published: false,
        content_html: null,
        published_content_html: null,
      });
      (invokeFunction as any).mockResolvedValue({ data: { ok: false, error: 'No content' }, error: null });

      const props = {
        ...defaultProps,
        documents: [document],
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const event = { stopPropagation: vi.fn() } as any;
        await result.current.handleTogglePublishPage(event, 'doc123', false);
        expect(mockToast).toHaveBeenCalled();
      });
    });
  });

  describe('Bulk Publish', () => {
    it('should bulk publish multiple documents', async () => {
      const documents = [
        mockDocument({ id: 'doc1', is_published: false }),
        mockDocument({ id: 'doc2', is_published: false }),
        mockDocument({ id: 'doc3', is_published: false }),
      ];
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const props = {
        ...defaultProps,
        documents,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      const event = { stopPropagation: vi.fn() } as any;
      act(() => {
        result.current.handleSelectDoc('doc1', event);
        result.current.handleSelectDoc('doc2', event);
        result.current.handleSelectDoc('doc3', event);
      });

      await waitFor(() => {
        expect(result.current.selectedDocIds.size).toBe(3);
      });

      await act(async () => {
        await result.current.handleBulkPublish();
      });

      expect(invokeFunction).toHaveBeenCalledTimes(3);
    });

    it('should handle bulk publish with partial failures', async () => {
      const documents = [
        mockDocument({ id: 'doc1', is_published: false }),
        mockDocument({ id: 'doc2', is_published: false }),
      ];
      (invokeFunction as any)
        .mockResolvedValueOnce({ data: { ok: true }, error: null })
        .mockResolvedValueOnce({ data: { ok: false, error: 'Failed' }, error: null });

      const props = {
        ...defaultProps,
        documents,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      const event = { stopPropagation: vi.fn() } as any;
      act(() => {
        result.current.handleSelectDoc('doc1', event);
        result.current.handleSelectDoc('doc2', event);
      });

      await waitFor(() => {
        expect(result.current.selectedDocIds.size).toBe(2);
      });

      await act(async () => {
        await result.current.handleBulkPublish();
      });

      expect(mockToast).toHaveBeenCalled();
    });

    it('should handle bulk publish with 100+ documents', async () => {
      const documents = Array.from({ length: 100 }, (_, i) =>
        mockDocument({ id: `doc${i}`, is_published: false })
      );
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const props = {
        ...defaultProps,
        documents,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      act(() => {
        documents.forEach(doc => {
          result.current.handleSelectDoc(doc.id, { stopPropagation: vi.fn() } as any);
        });
      });

      await waitFor(() => {
        expect(result.current.selectedDocIds.size).toBe(100);
      });

      await act(async () => {
        await result.current.handleBulkPublish();
      });

      expect(invokeFunction).toHaveBeenCalledTimes(100);
    });
  });

  describe('Visibility Levels', () => {
    it('should publish with public visibility', async () => {
      const document = mockDocument({
        id: 'doc123',
        visibility: 'public',
        is_published: false,
      });
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const props = {
        ...defaultProps,
        documents: [document],
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const event = { stopPropagation: vi.fn() } as any;
        await result.current.handleTogglePublishPage(event, 'doc123', false);
        expect(invokeFunction).toHaveBeenCalled();
      });
    });

    it('should publish with internal visibility', async () => {
      const document = mockDocument({
        id: 'doc123',
        visibility: 'internal',
        is_published: false,
      });
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const props = {
        ...defaultProps,
        documents: [document],
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const event = { stopPropagation: vi.fn() } as any;
        await result.current.handleTogglePublishPage(event, 'doc123', false);
        expect(invokeFunction).toHaveBeenCalled();
      });
    });

    it('should publish with external visibility', async () => {
      const document = mockDocument({
        id: 'doc123',
        visibility: 'external',
        is_published: false,
      });
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const props = {
        ...defaultProps,
        documents: [document],
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const event = { stopPropagation: vi.fn() } as any;
        await result.current.handleTogglePublishPage(event, 'doc123', false);
        expect(invokeFunction).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent publish operations', async () => {
      const documents = [
        mockDocument({ id: 'doc1', is_published: false }),
        mockDocument({ id: 'doc2', is_published: false }),
      ];
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const props = {
        ...defaultProps,
        documents,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      const event = { stopPropagation: vi.fn() } as any;
      const promises = [
        result.current.handleTogglePublishPage(event, 'doc1', false),
        result.current.handleTogglePublishPage(event, 'doc2', false),
      ];

      await waitFor(async () => {
        await Promise.all(promises);
        expect(invokeFunction).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle network errors during publish', async () => {
      const document = mockDocument({ id: 'doc123', is_published: false });
      (invokeFunction as any).mockRejectedValue(new Error('Network error'));

      const props = {
        ...defaultProps,
        documents: [document],
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const event = { stopPropagation: vi.fn() } as any;
        await result.current.handleTogglePublishPage(event, 'doc123', false);
        expect(mockToast).toHaveBeenCalled();
      });
    });

    it('should handle publish of deleted document', async () => {
      const document = mockDocument({ id: 'doc123', is_published: false });
      (invokeFunction as any).mockResolvedValue({
        data: { ok: false, error: 'Document not found' },
        error: null,
      });

      const props = {
        ...defaultProps,
        documents: [document],
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const event = { stopPropagation: vi.fn() } as any;
        await result.current.handleTogglePublishPage(event, 'doc123', false);
        expect(mockToast).toHaveBeenCalled();
      });
    });
  });
});
