// MCP Connector Types following Anthropic's MCP specification

export type ConnectorType = 'atlassian' | 'claude' | 'custom_mcp';
export type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'configuring';

export interface Connector {
  id: string;
  project_id: string;
  connector_type: ConnectorType;
  name: string;
  description?: string;
  endpoint_url?: string;
  status: ConnectorStatus;
  is_enabled: boolean;
  last_health_check?: string;
  last_sync_at?: string;
  last_error?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ConnectorCredentials {
  id: string;
  connector_id: string;
  encrypted_credentials: Record<string, unknown>;
  oauth_access_token?: string;
  oauth_refresh_token?: string;
  oauth_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectorAction {
  id: string;
  connector_id: string;
  project_id: string;
  user_id: string;
  action_type: string;
  document_id?: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message?: string;
  duration_ms?: number;
  created_at: string;
}

export interface ConnectorPermission {
  id: string;
  connector_id: string;
  role: 'admin' | 'editor' | 'reviewer' | 'viewer';
  can_view: boolean;
  can_use: boolean;
  can_configure: boolean;
  created_at: string;
}

// MCP Protocol Types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

// Connector-specific configurations
export interface AtlassianConfig {
  cloud_id: string;
  site_url: string;
  jira_enabled: boolean;
  confluence_enabled: boolean;
  default_project_key?: string;
  sync_interval_minutes?: number;
}

export interface ClaudeConfig {
  model: string;
  max_tokens: number;
  temperature: number;
  page_scoped_only: boolean;
}

export interface CustomMCPConfig {
  endpoint_url: string;
  auth_type: 'api_key' | 'oauth' | 'none';
  timeout_ms: number;
  retry_count: number;
}

// Connector action types
export type AtlassianActionType = 
  | 'create_jira_ticket'
  | 'update_jira_ticket'
  | 'sync_confluence_page'
  | 'get_jira_issue'
  | 'list_confluence_pages';

export type ClaudeActionType =
  | 'summarize_page'
  | 'answer_question'
  | 'generate_content'
  | 'analyze_document';

export type CustomMCPActionType =
  | 'call_tool'
  | 'list_tools'
  | 'get_resource';

// Connector registry definition
export interface ConnectorDefinition {
  type: ConnectorType;
  name: string;
  description: string;
  icon: string;
  capabilities: string[];
  required_scopes: string[];
  config_schema: Record<string, unknown>;
  actions: string[];
}

// Available connector definitions
export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  {
    type: 'atlassian',
    name: 'Atlassian (Jira + Confluence)',
    description: 'Sync Confluence pages and create Jira tickets from documentation',
    icon: 'Building2',
    capabilities: [
      'sync_confluence',
      'create_jira_tickets',
      'pull_metadata',
      'trigger_workflows'
    ],
    required_scopes: [
      'read:jira-work',
      'write:jira-work',
      'read:confluence-content.all',
      'write:confluence-content'
    ],
    config_schema: {
      cloud_id: { type: 'string', required: true },
      site_url: { type: 'string', required: true },
      jira_enabled: { type: 'boolean', default: true },
      confluence_enabled: { type: 'boolean', default: true }
    },
    actions: ['create_jira_ticket', 'sync_confluence_page', 'get_jira_issue', 'list_confluence_pages']
  },
  {
    type: 'claude',
    name: 'Claude AI',
    description: 'AI-powered summarization and content analysis (page-scoped only)',
    icon: 'Brain',
    capabilities: [
      'summarize_pages',
      'answer_questions',
      'generate_content',
      'analyze_documents'
    ],
    required_scopes: ['document:read'],
    config_schema: {
      model: { type: 'string', default: 'claude-3-sonnet-20240229' },
      max_tokens: { type: 'number', default: 4096 },
      temperature: { type: 'number', default: 0.7 },
      page_scoped_only: { type: 'boolean', default: true, readonly: true }
    },
    actions: ['summarize_page', 'answer_question', 'generate_content', 'analyze_document']
  },
  {
    type: 'custom_mcp',
    name: 'Custom MCP Endpoint',
    description: 'Connect to any MCP-compatible endpoint',
    icon: 'Plug',
    capabilities: ['custom_tools', 'custom_resources'],
    required_scopes: [],
    config_schema: {
      endpoint_url: { type: 'string', required: true },
      auth_type: { type: 'string', enum: ['api_key', 'oauth', 'none'], default: 'api_key' },
      timeout_ms: { type: 'number', default: 30000 },
      retry_count: { type: 'number', default: 3 }
    },
    actions: ['call_tool', 'list_tools', 'get_resource']
  }
];

// Default permissions per role
export const DEFAULT_CONNECTOR_PERMISSIONS: Record<string, ConnectorPermission> = {
  admin: {
    id: '',
    connector_id: '',
    role: 'admin',
    can_view: true,
    can_use: true,
    can_configure: true,
    created_at: ''
  },
  editor: {
    id: '',
    connector_id: '',
    role: 'editor',
    can_view: true,
    can_use: true,
    can_configure: false,
    created_at: ''
  },
  reviewer: {
    id: '',
    connector_id: '',
    role: 'reviewer',
    can_view: true,
    can_use: false,
    can_configure: false,
    created_at: ''
  },
  viewer: {
    id: '',
    connector_id: '',
    role: 'viewer',
    can_view: false,
    can_use: false,
    can_configure: false,
    created_at: ''
  }
};
