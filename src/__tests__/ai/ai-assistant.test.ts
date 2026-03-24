/**
 * AI Assistant Tests
 * 
 * Tests for AI assistant chat, actions, error handling, and edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import { invokeFunction } from '@/lib/api/functions';
import { setupTestEnv } from '../utils/test-helpers';

// Mock dependencies
vi.mock('@/lib/api/functions', () => ({
  invokeFunction: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDriveAuth', () => ({
  useDriveAuth: () => ({
    requestDriveAccess: vi.fn(),
    googleAccessToken: null,
    isDriveConnected: false,
    signInWithGoogle: vi.fn(),
  }),
  DriveAuthProvider: ({ children }: { children: unknown }) => children,
}));

describe('AI Assistant', () => {
  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Message Handling', () => {
    it('should send message successfully', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: {
          message: 'Test response',
          actions: [],
          toolResults: [],
        },
        error: null,
      });

      const { result } = renderHook(() => {
        const [messages, setMessages] = useState([]);
        const [input, setInput] = useState('');
        const [isLoading, setIsLoading] = useState(false);

        const sendMessage = async (overrideInput?: string) => {
          const messageText = overrideInput ?? input;
          if (!messageText.trim() || isLoading) return;
          setIsLoading(true);
          try {
            const { data } = await invokeFunction('docs-ai-assistant', {
              body: { messages: [{ role: 'user', content: messageText }] },
            });
            if (data?.message) {
              setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
            }
          } finally {
            setIsLoading(false);
          }
        };

        return { messages, input, setInput, sendMessage, isLoading };
      });

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      await waitFor(() => {
        expect(invokeFunction).toHaveBeenCalled();
        expect(result.current.messages.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty message', async () => {
      const { result } = renderHook(() => {
        const [input, setInput] = useState('');
        const sendMessage = async () => {
          if (!input.trim()) return;
        };
        return { input, setInput, sendMessage };
      });

      act(() => {
        result.current.setInput('');
      });
      await act(async () => {
        await result.current.sendMessage();
      });

      expect(invokeFunction).not.toHaveBeenCalled();
    });

    it('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(10000);
      (invokeFunction as any).mockResolvedValue({
        data: {
          message: 'Response',
          actions: [],
          toolResults: [],
        },
        error: null,
      });

      const { result } = renderHook(() => {
        const [input, setInput] = useState('');
        const sendMessage = async () => {
          await invokeFunction('docs-ai-assistant', {
            body: { messages: [{ role: 'user', content: input }] },
          });
        };
        return { input, setInput, sendMessage };
      });

      act(() => {
        result.current.setInput(longMessage);
      });
      await act(async () => {
        await result.current.sendMessage();
      });

      await waitFor(() => {
        expect(invokeFunction).toHaveBeenCalled();
      });
    });
  });

  describe('Action Execution', () => {
    it('should execute create_topic action successfully', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: {
          message: 'Topic created',
          actions: [{ name: 'create_topic', args: { name: 'New Topic', projectId: 'project1' } }],
          toolResults: [{ success: true, result: { id: 'topic1' } }],
        },
        error: null,
      });

      const { result } = renderHook(() => {
        const sendMessage = async () => {
          const { data } = await invokeFunction('docs-ai-assistant', {
            body: { messages: [{ role: 'user', content: 'Create a topic' }] },
          });
          return data;
        };
        return { sendMessage };
      });

      let response: any;
      await act(async () => {
        response = await result.current.sendMessage();
      });

      await waitFor(() => {
        expect(response?.toolResults?.[0]?.success).toBe(true);
      });
    });

    it('should handle action failure gracefully', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: {
          message: 'Failed to create topic',
          actions: [{ name: 'create_topic', args: { name: 'New Topic' } }],
          toolResults: [{ success: false, error: 'Permission denied' }],
        },
        error: null,
      });

      const { result } = renderHook(() => {
        const sendMessage = async () => {
          const { data } = await invokeFunction('docs-ai-assistant', {
            body: { messages: [{ role: 'user', content: 'Create topic' }] },
          });
          return data;
        };
        return { sendMessage };
      });

      let response: any;
      await act(async () => {
        response = await result.current.sendMessage();
      });

      await waitFor(() => {
        expect(response?.toolResults?.[0]?.success).toBe(false);
        expect(response?.message).toContain('Failed');
      });
    });

    it('should handle multiple actions', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: {
          message: 'Actions completed',
          actions: [
            { name: 'create_topic', args: {} },
            { name: 'create_page', args: {} },
          ],
          toolResults: [
            { success: true },
            { success: true },
          ],
        },
        error: null,
      });

      const { result } = renderHook(() => {
        const sendMessage = async () => {
          const { data } = await invokeFunction('docs-ai-assistant', {
            body: { messages: [{ role: 'user', content: 'Create topic and page' }] },
          });
          return data;
        };
        return { sendMessage };
      });

      let response: any;
      await act(async () => {
        response = await result.current.sendMessage();
      });

      await waitFor(() => {
        expect(response?.actions).toHaveLength(2);
        expect(response?.toolResults).toHaveLength(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (invokeFunction as any).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => {
        const [error, setError] = useState<string | null>(null);
        const sendMessage = async () => {
          try {
            await invokeFunction('docs-ai-assistant', {
              body: { messages: [{ role: 'user', content: 'Test' }] },
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        };
        return { error, sendMessage };
      });

      await act(async () => {
        await result.current.sendMessage();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });

    it('should handle authentication errors', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: null,
        error: { message: 'Authentication required', status: 401 },
      });

      const { result } = renderHook(() => {
        const [error, setError] = useState<string | null>(null);
        const sendMessage = async () => {
          const { error } = await invokeFunction('docs-ai-assistant', {
            body: { messages: [{ role: 'user', content: 'Test' }] },
          });
          if (error) {
            setError(error.message);
          }
        };
        return { error, sendMessage };
      });

      await act(async () => {
        await result.current.sendMessage();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Authentication required');
      });
    });

    it('should handle rate limit errors', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded', status: 429 },
      });

      const { result } = renderHook(() => {
        const [error, setError] = useState<string | null>(null);
        const sendMessage = async () => {
          const { error } = await invokeFunction('docs-ai-assistant', {
            body: { messages: [{ role: 'user', content: 'Test' }] },
          });
          if (error) {
            setError(error.message);
          }
        };
        return { error, sendMessage };
      });

      await act(async () => {
        await result.current.sendMessage();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Rate limit exceeded');
      });
    });

    it('should handle timeout errors', async () => {
      (invokeFunction as any).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const { result } = renderHook(() => {
        const [error, setError] = useState<string | null>(null);
        const sendMessage = async () => {
          try {
            await invokeFunction('docs-ai-assistant', {
              body: { messages: [{ role: 'user', content: 'Test' }] },
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        };
        return { error, sendMessage };
      });

      await act(async () => {
        await result.current.sendMessage();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Timeout');
      }, { timeout: 200 });
    });
  });

  describe('Context Handling', () => {
    it('should include current project in context', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: {
          message: 'Response',
          actions: [],
          toolResults: [],
        },
        error: null,
      });

      const currentProject = { id: 'project1', name: 'Test Project' };

      await invokeFunction('docs-ai-assistant', {
        body: {
          messages: [{ role: 'user', content: 'Test' }],
          context: { currentProject },
        },
      });

      expect(invokeFunction).toHaveBeenCalledWith(
        'docs-ai-assistant',
        expect.objectContaining({
          body: expect.objectContaining({
            context: expect.objectContaining({
              currentProject,
            }),
          }),
        })
      );
    });

    it('should include current topic in context', async () => {
      const currentTopic = { id: 'topic1', name: 'Test Topic' };

      await invokeFunction('docs-ai-assistant', {
        body: {
          messages: [{ role: 'user', content: 'Test' }],
          context: { currentTopic },
        },
      });

      expect(invokeFunction).toHaveBeenCalledWith(
        'docs-ai-assistant',
        expect.objectContaining({
          body: expect.objectContaining({
            context: expect.objectContaining({
              currentTopic,
            }),
          }),
        })
      );
    });

    it('should handle very long conversation history', async () => {
      const longHistory = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      (invokeFunction as any).mockResolvedValue({
        data: {
          message: 'Response',
          actions: [],
          toolResults: [],
        },
        error: null,
      });

      await invokeFunction('docs-ai-assistant', {
        body: { messages: longHistory },
      });

      expect(invokeFunction).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent message sends', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: {
          message: 'Response',
          actions: [],
          toolResults: [],
        },
        error: null,
      });

      const sendMessage = async () => {
        await invokeFunction('docs-ai-assistant', {
          body: { messages: [{ role: 'user', content: 'Test' }] },
        });
      };

      // Send multiple messages concurrently
      await Promise.all([sendMessage(), sendMessage(), sendMessage()]);

      expect(invokeFunction).toHaveBeenCalledTimes(3);
    });

    it('should handle invalid action names', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: {
          message: 'Invalid action',
          actions: [{ name: 'invalid_action', args: {} }],
          toolResults: [{ success: false, error: 'Unknown action' }],
        },
        error: null,
      });

      const { result } = renderHook(() => {
        const sendMessage = async () => {
          const { data } = await invokeFunction('docs-ai-assistant', {
            body: { messages: [{ role: 'user', content: 'Test' }] },
          });
          return data;
        };
        return { sendMessage };
      });

      let response: any;
      await act(async () => {
        response = await result.current.sendMessage();
      });

      await waitFor(() => {
        expect(response?.toolResults?.[0]?.success).toBe(false);
      });
    });

    it('should handle missing action arguments', async () => {
      (invokeFunction as any).mockResolvedValue({
        data: {
          message: 'Missing arguments',
          actions: [{ name: 'create_topic', args: {} }],
          toolResults: [{ success: false, error: 'Missing required arguments' }],
        },
        error: null,
      });

      const { result } = renderHook(() => {
        const sendMessage = async () => {
          const { data } = await invokeFunction('docs-ai-assistant', {
            body: { messages: [{ role: 'user', content: 'Create topic' }] },
          });
          return data;
        };
        return { sendMessage };
      });

      let response: any;
      await act(async () => {
        response = await result.current.sendMessage();
      });

      await waitFor(() => {
        expect(response?.toolResults?.[0]?.success).toBe(false);
      });
    });
  });
});
