import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MCPRequest {
  action: string;
  connector_id: string;
  project_id: string;
  params?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: MCPRequest = await req.json();
    const { action, connector_id, project_id, params = {} } = body;

    console.log(`MCP Connector request: ${action} for connector ${connector_id}`);

    // Check if user can use this connector
    const { data: canUse } = await supabase.rpc('can_use_connector', {
      _connector_id: connector_id,
      _user_id: user.id
    });

    if (!canUse) {
      // Log unauthorized attempt
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'unauthorized_connector_action',
        entity_type: 'connector',
        entity_id: connector_id,
        project_id,
        metadata: { attempted_action: action },
        success: false,
        error_message: 'User does not have permission to use this connector'
      });

      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'PERMISSION_DENIED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get connector details
    const { data: connector, error: connectorError } = await supabase
      .from('connectors')
      .select('*, connector_credentials(*)')
      .eq('id', connector_id)
      .single();

    if (connectorError || !connector) {
      return new Response(
        JSON.stringify({ error: 'Connector not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allow health_check even if connector is disabled (for testing)
    if (!connector.is_enabled && action !== 'health_check') {
      return new Response(
        JSON.stringify({ error: 'Connector is not enabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create action record
    const startTime = Date.now();
    const { data: actionRecord, error: actionError } = await supabase
      .from('connector_actions')
      .insert({
        connector_id,
        project_id,
        user_id: user.id,
        action_type: action,
        document_id: params.documentId || null,
        input_data: params,
        status: 'running'
      })
      .select()
      .single();

    if (actionError) {
      console.error('Failed to create action record:', actionError);
    }

    let result: { success: boolean; data?: unknown; error?: string };

    try {
      // Route to appropriate handler based on connector type
      switch (connector.connector_type) {
        case 'atlassian':
          result = await handleAtlassianAction(connector, action, params, supabase);
          break;
        case 'claude':
          result = await handleClaudeAction(connector, action, params, user.id, project_id, supabase);
          break;
        case 'custom_mcp':
          result = await handleCustomMCPAction(connector, action, params);
          break;
        default:
          result = { success: false, error: 'Unknown connector type' };
      }
    } catch (err) {
      console.error('Connector action error:', err);
      result = { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }

    const duration = Date.now() - startTime;

    // Update action record
    if (actionRecord) {
      await supabase
        .from('connector_actions')
        .update({
          status: result.success ? 'completed' : 'failed',
          output_data: result.data || {},
          error_message: result.error,
          duration_ms: duration
        })
        .eq('id', actionRecord.id);
    }

    // Log to audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: `connector_${action}`,
      entity_type: 'connector',
      entity_id: connector_id,
      project_id,
      metadata: { 
        connector_type: connector.connector_type,
        action,
        duration_ms: duration,
        success: result.success
      },
      success: result.success,
      error_message: result.error
    });

    return new Response(
      JSON.stringify({ 
        success: result.success, 
        data: result.data, 
        error: result.error,
        action: actionRecord
      }),
      { 
        status: result.success ? 200 : 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('MCP Connector error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Atlassian (Jira/Confluence) action handler
async function handleAtlassianAction(
  connector: any,
  action: string,
  params: Record<string, unknown>,
  supabase: any
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const credentials = connector.connector_credentials?.[0]?.encrypted_credentials || {};
  const config = connector.metadata || {};

  if (!credentials.api_email || !credentials.api_token) {
    return { success: false, error: 'Atlassian credentials not configured' };
  }

  const authHeader = `Basic ${btoa(`${credentials.api_email}:${credentials.api_token}`)}`;
  const baseUrl = config.site_url;

  switch (action) {
    case 'health_check': {
      try {
        const response = await fetch(`${baseUrl}/rest/api/3/myself`, {
          headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
        });
        return { success: response.ok, data: { status: response.ok ? 'connected' : 'error' } };
      } catch {
        return { success: false, error: 'Failed to connect to Atlassian' };
      }
    }

    case 'create_jira_ticket': {
      if (!config.jira_enabled) {
        return { success: false, error: 'Jira integration is not enabled' };
      }

      const projectKey = config.default_project_key || params.projectKey;
      if (!projectKey) {
        return { success: false, error: 'No Jira project key specified' };
      }

      try {
        const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              project: { key: projectKey },
              summary: params.summary,
              description: {
                type: 'doc',
                version: 1,
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: params.description || '' }]
                }]
              },
              issuetype: { name: params.issueType || 'Task' }
            }
          })
        });

        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Jira API error: ${error}` };
        }

        const issue = await response.json();
        return { success: true, data: { issueKey: issue.key, issueId: issue.id } };
      } catch (err) {
        return { success: false, error: `Failed to create Jira ticket: ${err}` };
      }
    }

    case 'sync_confluence_page': {
      if (!config.confluence_enabled) {
        return { success: false, error: 'Confluence integration is not enabled' };
      }

      try {
        // Search for the page
        const searchResponse = await fetch(
          `${baseUrl}/wiki/rest/api/content/search?cql=title~"${encodeURIComponent(params.documentTitle as string)}"`,
          { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
        );

        if (!searchResponse.ok) {
          return { success: false, error: 'Failed to search Confluence' };
        }

        const searchResult = await searchResponse.json();
        const pages = searchResult.results || [];

        if (pages.length === 0) {
          return { success: false, error: 'No matching Confluence page found' };
        }

        // Get full content of first matching page
        const pageId = pages[0].id;
        const contentResponse = await fetch(
          `${baseUrl}/wiki/rest/api/content/${pageId}?expand=body.storage`,
          { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
        );

        if (!contentResponse.ok) {
          return { success: false, error: 'Failed to fetch Confluence page content' };
        }

        const pageContent = await contentResponse.json();
        return { 
          success: true, 
          data: { 
            pageId,
            title: pageContent.title,
            content: pageContent.body?.storage?.value
          } 
        };
      } catch (err) {
        return { success: false, error: `Failed to sync from Confluence: ${err}` };
      }
    }

    default:
      return { success: false, error: `Unknown Atlassian action: ${action}` };
  }
}

// Claude AI action handler
async function handleClaudeAction(
  connector: any,
  action: string,
  params: Record<string, unknown>,
  userId: string,
  projectId: string,
  supabase: any
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const credentials = connector.connector_credentials?.[0]?.encrypted_credentials || {};
  const config = connector.metadata || {};

  // SECURITY: Verify user has access to the document
  if (params.documentId) {
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, project_id')
      .eq('id', params.documentId)
      .single();

    if (docError || !doc) {
      return { success: false, error: 'Document not found' };
    }

    // Verify document belongs to the project
    if (doc.project_id !== projectId) {
      return { success: false, error: 'Document does not belong to this project' };
    }

    // Verify user has access to the project
    const { data: canAccess } = await supabase.rpc('check_project_permission', {
      _project_id: projectId,
      _user_id: userId,
      _action: 'view'
    });

    if (!canAccess) {
      return { success: false, error: 'You do not have access to this document' };
    }
  }

  // Use Lovable AI gateway or Anthropic API
  const apiKey = Deno.env.get('LOVABLE_API_KEY') || credentials.anthropic_api_key;
  if (!apiKey) {
    return { success: false, error: 'Claude API key not configured' };
  }

  const model = config.model || 'google/gemini-2.5-flash';
  const maxTokens = config.max_tokens || 4096;
  const temperature = config.temperature || 0.7;

  // Build system prompt enforcing page-scoped access
  const systemPrompt = `You are a helpful AI assistant with access ONLY to the specific document provided. 
You must not reference or pretend to have access to any other documents or external information.
If asked about content not in the provided document, clearly state that you can only help with the current document.`;

  let userMessage: string;
  switch (action) {
    case 'summarize_page':
      userMessage = `Please provide a clear and concise summary of this document.

Document Title: ${params.documentTitle}

Document Content:
${params.documentContent}`;
      break;

    case 'answer_question':
      userMessage = `Based ONLY on the following document, please answer the user's question.

Document Title: ${params.documentTitle}

Document Content:
${params.documentContent}

User's Question: ${params.question}`;
      break;

    case 'analyze_document':
      userMessage = `Please analyze this document and provide insights about its structure, key topics, and suggestions for improvement.

Document Title: ${params.documentTitle}

Document Content:
${params.documentContent}`;
      break;

    case 'health_check':
      return { success: true, data: { status: 'connected' } };

    default:
      return { success: false, error: `Unknown Claude action: ${action}` };
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `AI API error: ${error}` };
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content;

    return { 
      success: true, 
      data: { 
        [action === 'summarize_page' ? 'summary' : 'answer']: answer,
        model: result.model,
        usage: result.usage
      } 
    };
  } catch (err) {
    return { success: false, error: `Failed to get AI response: ${err}` };
  }
}

// Custom MCP endpoint handler
async function handleCustomMCPAction(
  connector: any,
  action: string,
  params: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const credentials = connector.connector_credentials?.[0]?.encrypted_credentials || {};
  const config = connector.metadata || {};

  if (!config.endpoint_url) {
    return { success: false, error: 'MCP endpoint URL not configured' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (config.auth_type === 'api_key' && credentials.api_key) {
    headers['Authorization'] = `Bearer ${credentials.api_key}`;
  }

  const timeout = config.timeout_ms || 30000;
  const retryCount = config.retry_count || 3;

  // MCP JSON-RPC request
  const mcpRequest = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: action,
    params
  };

  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(config.endpoint_url, {
        method: 'POST',
        headers,
        body: JSON.stringify(mcpRequest),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 && attempt < retryCount - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        const error = await response.text();
        return { success: false, error: `MCP error: ${error}` };
      }

      const mcpResponse = await response.json();
      
      if (mcpResponse.error) {
        return { success: false, error: mcpResponse.error.message };
      }

      return { success: true, data: mcpResponse.result };
    } catch (err) {
      if (attempt < retryCount - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { success: false, error: `MCP request failed: ${err}` };
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}
