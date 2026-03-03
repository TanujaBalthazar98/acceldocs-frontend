/**
 * Test Utilities and Helpers
 * 
 * Common utilities for testing across the application
 */

import { vi } from 'vitest';

/**
 * Mock localStorage
 */
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };
};

/**
 * Mock fetch with response
 */
export const mockFetch = (response: any, ok: boolean = true) => {
  return vi.fn(() =>
    Promise.resolve({
      ok,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(typeof response === 'string' ? response : JSON.stringify(response)),
      status: ok ? 200 : 400,
      statusText: ok ? 'OK' : 'Bad Request',
    } as Response)
  );
};

/**
 * Mock fetch with error
 */
export const mockFetchError = (error: Error) => {
  return vi.fn(() => Promise.reject(error));
};

/**
 * Mock Google Drive API responses
 */
export const mockDriveFile = (overrides: Partial<any> = {}) => ({
  id: 'file123',
  name: 'Test Document',
  mimeType: 'application/vnd.google-apps.document',
  modifiedTime: new Date().toISOString(),
  parents: ['folder123'],
  ...overrides,
});

export const mockDriveFolder = (overrides: Partial<any> = {}) => ({
  id: 'folder123',
  name: 'Test Folder',
  mimeType: 'application/vnd.google-apps.folder',
  modifiedTime: new Date().toISOString(),
  parents: [],
  ...overrides,
});

/**
 * Mock Strapi API responses
 */
export const mockStrapiEntity = (data: any, id: string = '1') => ({
  id,
  attributes: data,
});

export const mockStrapiResponse = (data: any) => ({
  data: Array.isArray(data) ? data.map((item, idx) => mockStrapiEntity(item, String(idx + 1))) : mockStrapiEntity(data),
  meta: {
    pagination: {
      page: 1,
      pageSize: 25,
      pageCount: 1,
      total: Array.isArray(data) ? data.length : 1,
    },
  },
});

/**
 * Mock user session
 */
export const mockUser = (overrides: Partial<any> = {}) => ({
  id: 'user123',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
    account_type: 'individual',
  },
  ...overrides,
});

export const mockSession = (overrides: Partial<any> = {}) => ({
  user: mockUser(),
  access_token: 'token123',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  provider_token: 'google_token123',
  ...overrides,
});

/**
 * Mock project
 */
export const mockProject = (overrides: Partial<any> = {}) => ({
  id: 'project123',
  name: 'Test Project',
  slug: 'test-project',
  visibility: 'internal',
  is_published: true,
  organization_id: 'org123',
  parent_id: null,
  drive_folder_id: 'drive_folder123',
  ...overrides,
});

/**
 * Mock document
 */
export const mockDocument = (overrides: Partial<any> = {}) => ({
  id: 'doc123',
  title: 'Test Document',
  slug: 'test-document',
  google_doc_id: 'google_doc123',
  project_id: 'project123',
  topic_id: null,
  visibility: 'internal',
  is_published: false,
  content_html: '<p>Test content</p>',
  published_content_html: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Mock topic
 */
export const mockTopic = (overrides: Partial<any> = {}) => ({
  id: 'topic123',
  name: 'Test Topic',
  slug: 'test-topic',
  project_id: 'project123',
  parent_id: null,
  display_order: 1,
  ...overrides,
});

/**
 * Wait for async operations
 */
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait for condition
 */
export const waitForCondition = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Condition timeout');
    }
    await waitFor(interval);
  }
};

/**
 * Mock window.location
 */
export const mockLocation = (url: string) => {
  const absoluteUrl =
    url.startsWith("http://") || url.startsWith("https://")
      ? url
      : `http://localhost${url.startsWith("/") ? "" : "/"}${url}`;
  const location = new URL(absoluteUrl);
  Object.defineProperty(window, 'location', {
    value: {
      href: location.href,
      origin: location.origin,
      host: location.host,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      hostname: location.hostname,
      port: location.port,
      protocol: location.protocol,
      assign: vi.fn(),
      replace: vi.fn(),
    },
    writable: true,
  });
};

/**
 * Mock window.open
 */
export const mockWindowOpen = () => {
  const openedWindows: Window[] = [];
  const mockWindow = {
    location: { href: '' },
    closed: false,
    focus: vi.fn(),
    close: vi.fn(() => {
      mockWindow.closed = true;
    }),
  } as unknown as Window;

  const originalOpen = window.open;
  window.open = vi.fn((url?: string) => {
    if (url) {
      mockWindow.location.href = url;
    }
    openedWindows.push(mockWindow);
    return mockWindow;
  });

  return {
    mockWindow,
    openedWindows,
    restore: () => {
      window.open = originalOpen;
    },
  };
};

/**
 * Create mock error
 */
export const createMockError = (message: string, status: number = 400) => ({
  message,
  status,
  context: {
    status,
    body: JSON.stringify({ error: { message } }),
  },
});

/**
 * Mock toast
 */
export const mockToast = () => ({
  toast: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
});

/**
 * Setup test environment
 */
export const setupTestEnv = () => {
  // Mock localStorage
  const localStorageMock = mockLocalStorage();
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Provide a controllable window.location (jsdom navigation is not implemented)
  mockLocation("http://localhost/");

  // Mock fetch
  global.fetch = mockFetch({});

  // Reset mocks
  vi.clearAllMocks();

  return {
    localStorage: localStorageMock,
    restore: () => {
      vi.restoreAllMocks();
    },
  };
};
