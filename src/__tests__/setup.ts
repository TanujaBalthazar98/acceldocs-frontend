// Test setup and utilities
import { vi } from 'vitest';

// Mock Supabase client
export const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(),
        single: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(),
    })),
  })),
  rpc: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
};

// Mock user factory
export function createMockUser(overrides = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    ...overrides,
  };
}

// Mock project factory
export function createMockProject(overrides = {}) {
  return {
    id: 'project-123',
    name: 'Test Project',
    organization_id: 'org-123',
    is_published: true,
    visibility: 'public',
    ...overrides,
  };
}

// Mock permission response factory
export function createMockPermissionResponse(role: string, allowed: boolean) {
  return {
    allowed,
    role,
    action: 'test_action',
  };
}

// Reset all mocks
export function resetMocks() {
  vi.clearAllMocks();
}
