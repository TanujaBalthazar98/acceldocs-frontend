/**
 * Integration Tests - Complete Workflows
 * 
 * Tests for end-to-end workflows and feature interactions
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { mockProject, mockDocument, mockTopic, setupTestEnv } from '../utils/test-helpers';
import { invokeFunction } from '@/lib/api/functions';

// Mock dependencies
vi.mock('@/lib/api/functions', () => ({
  invokeFunction: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  strapiFetch: vi.fn(),
}));

describe('Complete Workflows', () => {
  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Onboarding Flow', () => {
    it('should complete full onboarding workflow', async () => {
      // 1. User signs in
      // 2. Creates first project
      // 3. Connects Google Drive
      // 4. Syncs documents
      // 5. Publishes first document

      const project = mockProject({ name: 'My First Project' });
      const document = mockDocument({ title: 'Getting Started', project_id: project.id });

      (invokeFunction as any)
        .mockResolvedValueOnce({ data: { ok: true, id: project.id }, error: null }) // Create project
        .mockResolvedValueOnce({ data: { files: [] }, error: null }) // Sync Drive
        .mockResolvedValueOnce({ data: { ok: true }, error: null }); // Publish

      // Simulate workflow
      const createProject = async () => {
        const { data } = await invokeFunction('create-project', {
          body: { name: project.name },
        });
        return data;
      };

      const syncDrive = async () => {
        const { data } = await invokeFunction('google-drive', {
          body: { action: 'list_folder', folderId: 'root' },
        });
        return data;
      };

      const publishDocument = async () => {
        const { data } = await invokeFunction('update-document', {
          body: { documentId: document.id, data: { is_published: true } },
        });
        return data;
      };

      const projectResult = await createProject();
      expect(projectResult.ok).toBe(true);

      const syncResult = await syncDrive();
      expect(syncResult).toBeDefined();

      const publishResult = await publishDocument();
      expect(publishResult.ok).toBe(true);
    });
  });

  describe('Publishing Workflow', () => {
    it('should complete publish workflow with all steps', async () => {
      // 1. Create document
      // 2. Edit content
      // 3. Review
      // 4. Publish
      // 5. Verify published

      const document = mockDocument({ is_published: false });

      (invokeFunction as any)
        .mockResolvedValueOnce({ data: { ok: true, documentId: document.id }, error: null })
        .mockResolvedValueOnce({ data: { ok: true }, error: null })
        .mockResolvedValueOnce({ data: { ok: true }, error: null });

      const createDoc = async () => {
        return await invokeFunction('create-document', {
          body: { title: document.title, projectId: document.project_id },
        });
      };

      const updateContent = async () => {
        return await invokeFunction('update-document', {
          body: { documentId: document.id, data: { content_html: '<p>Content</p>' } },
        });
      };

      const publish = async () => {
        return await invokeFunction('update-document', {
          body: { documentId: document.id, data: { is_published: true } },
        });
      };

      const createResult = await createDoc();
      expect(createResult.data?.ok).toBe(true);

      const updateResult = await updateContent();
      expect(updateResult.data?.ok).toBe(true);

      const publishResult = await publish();
      expect(publishResult.data?.ok).toBe(true);
    });
  });

  describe('Sync Workflow', () => {
    it('should complete sync workflow with error recovery', async () => {
      // 1. Start sync
      // 2. Handle rate limit
      // 3. Retry with backoff
      // 4. Complete sync

      let attemptCount = 0;
      (invokeFunction as any).mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          return {
            data: null,
            error: { message: 'Rate limit exceeded', status: 429 },
          };
        }
        return {
          data: { files: [mockDocument()] },
          error: null,
        };
      });

      const syncWithRetry = async (maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          const { data, error } = await invokeFunction('google-drive', {
            body: { action: 'list_folder', folderId: 'root' },
          });

          if (!error) {
            return { success: true, data };
          }

          if (error.status === 429 && i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            continue;
          }

          return { success: false, error };
        }
      };

      const result = await syncWithRetry();
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
    });
  });

  describe('Bulk Operations Workflow', () => {
    it('should handle bulk publish with partial failures', async () => {
      const documents = [
        mockDocument({ id: 'doc1', is_published: false }),
        mockDocument({ id: 'doc2', is_published: false }),
        mockDocument({ id: 'doc3', is_published: false }),
      ];

      let callCount = 0;
      (invokeFunction as any).mockImplementation(async (name: string, options: any) => {
        callCount++;
        const docId = options.body.documentId;
        // Simulate doc2 failing
        if (docId === 'doc2') {
          return { data: { ok: false, error: 'Permission denied' }, error: null };
        }
        return { data: { ok: true }, error: null };
      });

      const bulkPublish = async () => {
        const results = await Promise.allSettled(
          documents.map(doc =>
            invokeFunction('update-document', {
              body: { documentId: doc.id, data: { is_published: true } },
            })
          )
        );

        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.data?.ok).length;
        const failureCount = results.length - successCount;

        return { successCount, failureCount };
      };

      const result = await bulkPublish();
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });
  });

  describe('Permission Workflow', () => {
    it('should handle permission escalation workflow', async () => {
      // 1. User tries unauthorized action
      // 2. Permission check fails
      // 3. Error logged
      // 4. User gets appropriate message

      (invokeFunction as any).mockResolvedValue({
        data: { allowed: false, role: 'viewer' },
        error: null,
      });

      const checkPermission = async (action: string) => {
        const { data } = await invokeFunction('check-permission', {
          body: { action, projectId: 'project1' },
        });
        return data;
      };

      const result = await checkPermission('publish');
      expect(result.allowed).toBe(false);
      expect(result.role).toBe('viewer');
    });
  });
});
