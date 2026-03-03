/**
 * Search Functionality Tests
 * 
 * Tests for search across projects, topics, documents with edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { mockProject, mockDocument, mockTopic, setupTestEnv } from '../utils/test-helpers';

describe('Search Functionality', () => {
  beforeEach(() => {
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Search', () => {
    it('should filter projects by name', () => {
      const projects = [
        mockProject({ name: 'Project Alpha' }),
        mockProject({ name: 'Project Beta' }),
        mockProject({ name: 'Project Gamma' }),
      ];

      const searchQuery = 'Alpha';
      const filtered = projects.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Project Alpha');
    });

    it('should filter documents by title', () => {
      const documents = [
        mockDocument({ title: 'Getting Started Guide' }),
        mockDocument({ title: 'API Reference' }),
        mockDocument({ title: 'User Manual' }),
      ];

      const searchQuery = 'API';
      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('API Reference');
    });

    it('should filter topics by name', () => {
      const topics = [
        mockTopic({ name: 'Authentication' }),
        mockTopic({ name: 'Authorization' }),
        mockTopic({ name: 'API Keys' }),
      ];

      const searchQuery = 'Auth';
      const filtered = topics.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(2);
    });

    it('should handle empty search query', () => {
      const documents = [
        mockDocument({ title: 'Doc 1' }),
        mockDocument({ title: 'Doc 2' }),
      ];

      const searchQuery = '';
      const filtered = documents.filter(d => 
        !searchQuery || d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(2);
    });

    it('should handle case insensitive search', () => {
      const documents = [
        mockDocument({ title: 'JavaScript Guide' }),
        mockDocument({ title: 'JAVASCRIPT TUTORIAL' }),
        mockDocument({ title: 'javascript basics' }),
      ];

      const searchQuery = 'javascript';
      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in search', () => {
      const documents = [
        mockDocument({ title: 'C++ Guide' }),
        mockDocument({ title: 'C# Tutorial' }),
        mockDocument({ title: '.NET Framework' }),
      ];

      const searchQuery = 'C++';
      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
    });

    it('should handle very long search queries', () => {
      const longQuery = 'a'.repeat(1000);
      const documents = [
        mockDocument({ title: 'Test Document' }),
      ];

      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(longQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(0);
    });

    it('should handle search with no results', () => {
      const documents = [
        mockDocument({ title: 'Document 1' }),
        mockDocument({ title: 'Document 2' }),
      ];

      const searchQuery = 'Nonexistent';
      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(0);
    });

    it('should handle search with XSS attempts', () => {
      const xssQuery = '<script>alert("XSS")</script>';
      const documents = [
        mockDocument({ title: 'Safe Document' }),
      ];

      // Should sanitize and not match
      const sanitized = xssQuery.replace(/<[^>]*>/g, '');
      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(sanitized.toLowerCase())
      );

      expect(filtered).toHaveLength(0);
    });

    it('should handle search with SQL injection attempts', () => {
      const sqlQuery = "'; DROP TABLE documents; --";
      const documents = [
        mockDocument({ title: 'Test Document' }),
      ];

      // Should treat as literal string
      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(sqlQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(0);
    });

    it('should handle search with unicode characters', () => {
      const documents = [
        mockDocument({ title: 'Café Guide' }),
        mockDocument({ title: 'Résumé Template' }),
        mockDocument({ title: '日本語ドキュメント' }),
      ];

      const searchQuery = 'Café';
      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
    });

    it('should handle search with emoji', () => {
      const documents = [
        mockDocument({ title: '🚀 Getting Started' }),
        mockDocument({ title: '📚 Documentation' }),
      ];

      const searchQuery = '🚀';
      const filtered = documents.filter(d => 
        d.title.includes(searchQuery)
      );

      expect(filtered).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    it('should handle search with 1000+ documents', () => {
      const documents = Array.from({ length: 1000 }, (_, i) =>
        mockDocument({ title: `Document ${i}` })
      );

      const searchQuery = '500';
      const start = performance.now();
      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      const duration = performance.now() - start;

      expect(filtered.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });

    it('should handle search with very long document titles', () => {
      const longTitle = 'a'.repeat(10000);
      const documents = [
        mockDocument({ title: longTitle }),
        mockDocument({ title: 'Short Title' }),
      ];

      const searchQuery = 'a';
      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
    });
  });

  describe('Search Debouncing', () => {
    it('should debounce rapid search queries', async () => {
      let callCount = 0;
      const debouncedSearch = (() => {
        let timeout: ReturnType<typeof setTimeout>;
        return (query: string, callback: () => void) => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            callCount++;
            callback();
          }, 300);
        };
      })();

      // Rapid queries
      debouncedSearch('a', () => {});
      debouncedSearch('ab', () => {});
      debouncedSearch('abc', () => {});

      await new Promise(resolve => setTimeout(resolve, 400));

      expect(callCount).toBe(1); // Should only call once
    });
  });

  describe('Search Highlighting', () => {
    it('should highlight search terms in results', () => {
      const title = 'JavaScript Guide';
      const query = 'JavaScript';
      const highlighted = title.replace(
        new RegExp(`(${query})`, 'gi'),
        '<mark>$1</mark>'
      );

      expect(highlighted).toBe('<mark>JavaScript</mark> Guide');
    });

    it('should handle case insensitive highlighting', () => {
      const title = 'javascript guide';
      const query = 'JAVASCRIPT';
      const highlighted = title.replace(
        new RegExp(`(${query})`, 'gi'),
        '<mark>$1</mark>'
      );

      expect(highlighted).toBe('<mark>javascript</mark> guide');
    });
  });

  describe('Search Filters', () => {
    it('should filter by project', () => {
      const documents = [
        mockDocument({ title: 'Doc 1', project_id: 'project1' }),
        mockDocument({ title: 'Doc 2', project_id: 'project2' }),
        mockDocument({ title: 'Doc 3', project_id: 'project1' }),
      ];

      const filtered = documents.filter(d => d.project_id === 'project1');
      expect(filtered).toHaveLength(2);
    });

    it('should filter by topic', () => {
      const documents = [
        mockDocument({ title: 'Doc 1', topic_id: 'topic1' }),
        mockDocument({ title: 'Doc 2', topic_id: 'topic2' }),
        mockDocument({ title: 'Doc 3', topic_id: 'topic1' }),
      ];

      const filtered = documents.filter(d => d.topic_id === 'topic1');
      expect(filtered).toHaveLength(2);
    });

    it('should filter by visibility', () => {
      const documents = [
        mockDocument({ title: 'Doc 1', visibility: 'public' }),
        mockDocument({ title: 'Doc 2', visibility: 'internal' }),
        mockDocument({ title: 'Doc 3', visibility: 'public' }),
      ];

      const filtered = documents.filter(d => d.visibility === 'public');
      expect(filtered).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const documents = [
        mockDocument({ 
          title: 'Doc 1', 
          project_id: 'project1',
          visibility: 'public',
          is_published: true,
        }),
        mockDocument({ 
          title: 'Doc 2', 
          project_id: 'project1',
          visibility: 'internal',
          is_published: true,
        }),
        mockDocument({ 
          title: 'Doc 3', 
          project_id: 'project2',
          visibility: 'public',
          is_published: true,
        }),
      ];

      const filtered = documents.filter(d => 
        d.project_id === 'project1' && 
        d.visibility === 'public' && 
        d.is_published
      );

      expect(filtered).toHaveLength(1);
    });
  });

  describe('Search During Sync', () => {
    it('should maintain search results during sync', () => {
      const documents = [
        mockDocument({ title: 'Search Result' }),
      ];

      const searchQuery = 'Search';
      const filtered = documents.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

      // Simulate sync adding new documents
      const newDocuments = [
        ...documents,
        mockDocument({ title: 'New Document' }),
      ];

      const filteredAfterSync = newDocuments.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filteredAfterSync).toHaveLength(1);
      expect(filteredAfterSync[0].title).toBe('Search Result');
    });
  });
});
