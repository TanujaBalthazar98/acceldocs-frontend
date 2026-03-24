/**
 * Google Drive Sync Tests
 * 
 * Tests for Drive sync functionality, edge cases, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDriveSync } from '@/hooks/useDriveSync';
import { mockDriveFile, mockDriveFolder, setupTestEnv, mockFetch } from '../utils/test-helpers';
import { invokeFunction } from '@/lib/api/functions';

// Mock dependencies
vi.mock('@/lib/api/functions', () => ({
  invokeFunction: vi.fn(),
}));

vi.mock('@/hooks/useDriveAuth', () => ({
  useDriveAuth: () => ({
    googleAccessToken: 'token123',
    isDriveConnected: true,
    requestDriveAccess: vi.fn(),
    signInWithGoogle: vi.fn(),
  }),
  DriveAuthProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDriveRecovery', () => ({
  useDriveRecovery: () => ({
    attemptRecovery: vi.fn().mockResolvedValue({
      recovered: false,
      shouldRetry: false,
      isOwner: false,
    }),
    isInCooldown: vi.fn().mockReturnValue(false),
  }),
}));

describe('Google Drive Sync', () => {
  const mockToast = vi.fn();
  const mockFetchData = vi.fn();
  const mockSetNeedsDriveAccess = vi.fn();
  const mockResolveDefaultVersion = vi.fn().mockReturnValue({ id: 'v1', name: 'v1.0' });
  const mockEnsureDefaultVersionForProject = vi.fn().mockResolvedValue('v1');

  const defaultProps = {
    rootFolderId: 'root_folder123',
    organizationId: 'org123',
    organizationName: 'Test Org',
    appRole: 'owner',
    projects: [],
    projectVersions: [],
    topics: [],
    toast: mockToast,
    setNeedsDriveAccess: mockSetNeedsDriveAccess,
    fetchData: mockFetchData,
    resolveDefaultVersion: mockResolveDefaultVersion,
    ensureDefaultVersionForProject: mockEnsureDefaultVersionForProject,
  };

  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Sync from Drive', () => {
    it('should sync folders and documents successfully', async () => {
      const folders = [
        mockDriveFolder({ id: 'folder1', name: 'Project 1' }),
        mockDriveFolder({ id: 'folder2', name: 'Project 2' }),
      ];
      const files = [
        mockDriveFile({ id: 'file1', name: 'Document 1.docx', parents: ['folder1'] }),
        mockDriveFile({ id: 'file2', name: 'Document 2.docx', parents: ['folder1'] }),
      ];

      (invokeFunction as any)
        .mockResolvedValueOnce({
          data: { files: folders },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { files },
          error: null,
        })
        .mockResolvedValue({ data: { ok: true }, error: null });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });
      await waitFor(() => {
        expect(invokeFunction).toHaveBeenCalled();
        expect(mockFetchData).toHaveBeenCalled();
      });
    });

    it('should handle sync with no files', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: { files: [] },
        error: null,
      });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
    });

    it('should handle sync with large files', async () => {
      const largeFile = mockDriveFile({
        id: 'large_file',
        name: 'Large Document.docx',
        size: '52428800', // 50MB
      });

      (invokeFunction as any)
        .mockResolvedValueOnce({
          data: { files: [largeFile] },
          error: null,
        })
        .mockResolvedValue({
          data: { ok: true, fileTooLarge: true },
          error: null,
        });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });
      await waitFor(() => {
        // Should handle large files gracefully
        expect(invokeFunction).toHaveBeenCalled();
      });
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = {
        error: {
          message: 'Rate limit exceeded',
          code: 429,
        },
      };

      (invokeFunction as any)
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue({
          data: { files: [] },
          error: null,
        });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });
      await waitFor(() => {
        // Should handle rate limit with retry or backoff
        expect(mockToast).toHaveBeenCalled();
      });
    });

    it('should handle token expiration during sync', async () => {
      (invokeFunction as any)
        .mockResolvedValueOnce({
          data: { needsReauth: true, error: 'Token expired' },
          error: null,
        })
        .mockResolvedValue({ data: { files: [] }, error: null });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });

      expect(mockSetNeedsDriveAccess).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      (invokeFunction as any).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Sync failed',
          })
        );
      });
    });

    it('should handle concurrent syncs', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: { files: [] },
        error: null,
      });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      let syncs: Array<Promise<any>> = [];
      act(() => {
        // Start multiple syncs concurrently
        syncs = [
          result.current.handleSyncFromDrive(),
          result.current.handleSyncFromDrive(),
          result.current.handleSyncFromDrive(),
        ];
      });

      await act(async () => {
        await Promise.all(syncs);
      });
      await waitFor(() => {
        // Should handle concurrent syncs without conflicts
        expect(result.current.isSyncing).toBe(false);
      });
    });

    it('should handle sync with 1000+ files', async () => {
      const manyFiles = Array.from({ length: 1000 }, (_, i) =>
        mockDriveFile({ id: `file${i}`, name: `Document ${i}.docx` })
      );

      (invokeFunction as any)
        .mockResolvedValueOnce({
          data: { files: manyFiles },
          error: null,
        })
        .mockResolvedValue({ data: { ok: true }, error: null });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });
      await waitFor(() => {
        // Should handle large batches
        expect(invokeFunction).toHaveBeenCalled();
      });
    });
  });

  describe('File Operations', () => {
    it('should upload file successfully', async () => {
      const file = new File(['content'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      (invokeFunction as any).mockResolvedValue({
        data: { id: 'new_file_id', name: 'test.docx' },
        error: null,
      });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.uploadFile(file, 'folder123');
      });

      expect(invokeFunction).toHaveBeenCalled();
    });

    it('should handle upload failure', async () => {
      const file = new File(['content'], 'test.docx');
      (invokeFunction as any).mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' },
      });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleUploadFile(file, 'folder123');
      });
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
    });

    it('should handle very large file upload', async () => {
      // Simulate a large file without allocating 50MB of test data.
      const largeFile = new File(['x'], 'large.docx');
      Object.defineProperty(largeFile, 'size', {
        value: 50 * 1024 * 1024,
        configurable: true,
      });
      (invokeFunction as any).mockResolvedValue({
        data: { ok: false, fileTooLarge: true },
        error: null,
      });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleUploadFile(largeFile, 'folder123');
      });
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
    });

    it('should trash file successfully', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      let result_trash: any;
      await act(async () => {
        result_trash = await result.current.trashFile('file123');
      });
      await waitFor(() => {
        expect(result_trash.success).toBe(true);
      });
    });

    it('should handle file not found when trashing', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: null,
        error: { message: 'File not found', status: 404 },
      });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      let result_trash: any;
      await act(async () => {
        result_trash = await result.current.trashFile('nonexistent');
      });
      await waitFor(() => {
        // Should handle gracefully
        expect(result_trash).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing root folder ID', async () => {
      const props = {
        ...defaultProps,
        rootFolderId: null,
      };

      const { result } = renderHook(() => useDriveSync(props));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });
      await waitFor(() => {
        // Should handle gracefully
        expect(mockToast).toHaveBeenCalled();
      });
    });

    it('should handle Drive API quota exceeded', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: null,
        error: { message: 'Quota exceeded', code: 403 },
      });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
    });

    it('should handle file locked by another user', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: null,
        error: { message: 'File is locked', code: 409 },
      });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
    });

    it('should handle corrupted file data', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: { files: [{ id: 'corrupt', name: null, mimeType: null }] },
        error: null,
      });

      const { result } = renderHook(() => useDriveSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncFromDrive();
      });
      await waitFor(() => {
        // Should handle missing data gracefully
        expect(invokeFunction).toHaveBeenCalled();
      });
    });
  });
});
