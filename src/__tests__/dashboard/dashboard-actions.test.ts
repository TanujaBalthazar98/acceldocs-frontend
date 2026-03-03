/**
 * Dashboard Actions Tests
 * 
 * Tests for dashboard CRUD operations, bulk actions, and edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardActions } from '@/hooks/useDashboardActions';
import { mockProject, mockDocument, mockTopic, setupTestEnv, mockFetch } from '../utils/test-helpers';
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

describe('Dashboard Actions', () => {
  const mockToast = vi.fn();
  const mockNavigate = vi.fn();
  const mockFetchData = vi.fn();
  const mockLogAction = vi.fn();
  const mockLogUnauthorizedAttempt = vi.fn();
  const mockTrashFile = vi.fn().mockResolvedValue({ success: true });
  const mockCanPublishForProject = vi.fn().mockResolvedValue(true);
  const mockResolveDefaultVersion = vi.fn().mockReturnValue({ id: 'v1', name: 'v1.0' });
  const mockGetAssignableTopics = vi.fn().mockReturnValue([]);
  const mockEnsureDefaultVersionForProject = vi.fn().mockResolvedValue('v1');

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
      canDeleteProject: true,
      canDeleteTopic: true,
      canDeleteDocument: true,
      canPublish: true,
    },
    logAction: mockLogAction,
    logUnauthorizedAttempt: mockLogUnauthorizedAttempt,
    canPublishForProject: mockCanPublishForProject,
    fetchData: mockFetchData,
    trashFile: mockTrashFile,
    resolveDefaultVersion: mockResolveDefaultVersion,
    getAssignableTopics: mockGetAssignableTopics,
    ensureDefaultVersionForProject: mockEnsureDefaultVersionForProject,
    navigate: mockNavigate,
    signOut: vi.fn(),
  };

  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Project Management', () => {
    it('should delete project successfully', async () => {
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const { result } = renderHook(() => useDashboardActions(defaultProps));

      await waitFor(async () => {
        const success = await result.current.handleDeleteProject('project123', false);
        expect(success).toBe(true);
        expect(invokeFunction).toHaveBeenCalledWith('delete-project', {
          body: { projectId: 'project123' },
        });
        expect(mockLogAction).toHaveBeenCalled();
      });
    });

    it('should handle delete project permission denied', async () => {
      const propsWithoutPermission = {
        ...defaultProps,
        permissions: { ...defaultProps.permissions, canDeleteProject: false },
      };

      const { result } = renderHook(() => useDashboardActions(propsWithoutPermission));

      await waitFor(async () => {
        const success = await result.current.handleDeleteProject('project123', false);
        expect(success).toBe(false);
        expect(mockLogUnauthorizedAttempt).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Permission Denied',
          })
        );
      });
    });

    it('should handle delete project with Drive folder', async () => {
      const projectWithDrive = mockProject({ drive_folder_id: 'drive_folder123' });
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });
      mockTrashFile.mockResolvedValue({ success: true });

      const props = {
        ...defaultProps,
        projects: [projectWithDrive],
        selectedProject: projectWithDrive,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const success = await result.current.handleDeleteProject('project123', false);
        expect(success).toBe(true);
        expect(mockTrashFile).toHaveBeenCalledWith('drive_folder123');
      });
    });

    it('should handle delete project failure', async () => {
      (invokeFunction as any).mockResolvedValue({ data: { ok: false }, error: null });

      const { result } = renderHook(() => useDashboardActions(defaultProps));

      await waitFor(async () => {
        const success = await result.current.handleDeleteProject('project123', false);
        expect(success).toBe(false);
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
          })
        );
      });
    });

    it('should handle force delete when Drive deletion fails', async () => {
      const projectWithDrive = mockProject({ drive_folder_id: 'drive_folder123' });
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });
      mockTrashFile.mockResolvedValue({ success: false, error: 'Permission denied' });

      const props = {
        ...defaultProps,
        projects: [projectWithDrive],
        selectedProject: projectWithDrive,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const success = await result.current.handleDeleteProject('project123', true);
        expect(success).toBe(true);
        // Should still succeed with force delete
      });
    });
  });

  describe('Document Management', () => {
    it('should publish document successfully', async () => {
      const document = mockDocument({ id: 'doc123', is_published: false });
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const props = {
        ...defaultProps,
        documents: [document],
        selectedDocument: document,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const event = { stopPropagation: vi.fn() } as any;
        await result.current.handleTogglePublishPage(event, 'doc123', false);
        expect(invokeFunction).toHaveBeenCalled();
        expect(mockLogAction).toHaveBeenCalled();
      });
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

    it('should handle bulk publish', async () => {
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

      // Select documents
      const event = { stopPropagation: vi.fn() } as any;
      act(() => {
        result.current.handleSelectDoc('doc1', event);
        result.current.handleSelectDoc('doc2', event);
      });

      await waitFor(() => {
        expect(result.current.selectedDocIds.size).toBe(2);
      });

      await waitFor(async () => {
        await result.current.handleBulkPublish();
        expect(invokeFunction).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle bulk publish with partial failures', async () => {
      const documents = [
        mockDocument({ id: 'doc1', is_published: false }),
        mockDocument({ id: 'doc2', is_published: false }),
      ];
      (invokeFunction as any)
        .mockResolvedValueOnce({ data: { ok: true }, error: null })
        .mockResolvedValueOnce({ data: { ok: false }, error: { message: 'Failed' } });

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

      await waitFor(async () => {
        await result.current.handleBulkPublish();
        expect(mockToast).toHaveBeenCalled();
      });
    });

    it('should handle delete document', async () => {
      const document = mockDocument({ id: 'doc123' });
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });
      mockTrashFile.mockResolvedValue({ success: true });

      const props = {
        ...defaultProps,
        documents: [document],
        selectedDocument: document,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const success = await result.current.handleDeleteDocument('doc123');
        expect(success).toBe(true);
        expect(invokeFunction).toHaveBeenCalled();
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should select all documents', async () => {
      const documents = [
        mockDocument({ id: 'doc1' }),
        mockDocument({ id: 'doc2' }),
        mockDocument({ id: 'doc3' }),
      ];

      const props = {
        ...defaultProps,
        documents,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      act(() => {
        result.current.handleSelectAll(documents);
      });

      await waitFor(() => {
        expect(result.current.selectedDocIds.size).toBe(3);
      });
    });

    it('should clear selection', async () => {
      const { result } = renderHook(() => useDashboardActions(defaultProps));

      act(() => {
        result.current.handleSelectDoc('doc1', { stopPropagation: vi.fn() } as any);
      });

      await waitFor(() => {
        expect(result.current.selectedDocIds.size).toBe(1);
      });

      act(() => {
        result.current.clearSelection();
      });

      await waitFor(() => {
        expect(result.current.selectedDocIds.size).toBe(0);
      });
    });

    it('should handle bulk delete', async () => {
      const documents = [
        mockDocument({ id: 'doc1' }),
        mockDocument({ id: 'doc2' }),
      ];
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });
      mockTrashFile.mockResolvedValue({ success: true });

      const props = {
        ...defaultProps,
        documents,
        permissions: {
          ...defaultProps.permissions,
          canDeleteDocument: true,
        },
      };

      const { result } = renderHook(() => useDashboardActions(props));

      act(() => {
        const event = { stopPropagation: vi.fn() } as any;
        result.current.handleSelectDoc('doc1', event);
        result.current.handleSelectDoc('doc2', event);
      });

      await waitFor(() => {
        expect(result.current.selectedDocIds.size).toBe(2);
      });

      await act(async () => {
        await result.current.handleBulkDelete();
      });

      expect(invokeFunction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      (invokeFunction as any).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDashboardActions(defaultProps));

      let success = true;
      await act(async () => {
        success = await result.current.handleDeleteProject('project123', false);
      });
      await waitFor(() => {
        expect(success).toBe(false);
        expect(mockToast).toHaveBeenCalled();
      });
    });

    it('should handle concurrent operations', async () => {
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const { result } = renderHook(() => useDashboardActions(defaultProps));

      // Start multiple operations concurrently
      const promises = [
        result.current.handleDeleteProject('project1', false),
        result.current.handleDeleteProject('project2', false),
        result.current.handleDeleteProject('project3', false),
      ];

      let results: boolean[] = [];
      await act(async () => {
        results = await Promise.all(promises);
      });
      await waitFor(() => {
        expect(results.every(r => r === true)).toBe(true);
      });
    });

    it('should handle very large bulk operations', async () => {
      const documents = Array.from({ length: 100 }, (_, i) =>
        mockDocument({ id: `doc${i}` })
      );
      (invokeFunction as any).mockResolvedValue({ data: { ok: true }, error: null });

      const props = {
        ...defaultProps,
        documents,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      act(() => {
        result.current.handleSelectAll(documents);
      });

      await act(async () => {
        await result.current.handleBulkPublish();
      });
      await waitFor(() => {
        expect(invokeFunction).toHaveBeenCalledTimes(100);
      });
    });

    it('should handle missing project gracefully', async () => {
      (invokeFunction as any).mockResolvedValue({ data: { ok: false }, error: null });

      const props = {
        ...defaultProps,
        projects: [],
        selectedProject: null,
      };

      const { result } = renderHook(() => useDashboardActions(props));

      await waitFor(async () => {
        const success = await result.current.handleDeleteProject('nonexistent', false);
        expect(success).toBe(false);
      });
    });
  });
});
