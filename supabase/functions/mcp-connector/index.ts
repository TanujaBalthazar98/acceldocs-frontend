import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_MODEL_FLASH = "gemini-1.5-flash";
const GEMINI_MODEL_PRO = "gemini-1.5-pro";

function getGeminiApiKey(): string {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return apiKey;
}

function resolveGeminiModel(model?: string): string {
  if (!model) return GEMINI_MODEL_FLASH;
  const normalized = model.toLowerCase();
  if (normalized.includes("flash")) return GEMINI_MODEL_FLASH;
  if (normalized.includes("pro")) return GEMINI_MODEL_PRO;
  return GEMINI_MODEL_PRO;
}

function extractGeminiText(parts: Array<{ text?: string }>): string {
  return parts.map((part) => part?.text || "").join("");
}

interface MCPRequest {
  action: string;
  connector_id: string;
  project_id: string;
  params?: Record<string, unknown>;
}

// MCP Tool definitions that can be exposed to AI models
const MCP_TOOLS = {
  // Document actions
  create_page: {
    name: 'create_page',
    description: 'Create a new documentation page in the project',
    parameters: {
      projectId: { type: 'string', required: true },
      topicId: { type: 'string', required: false },
      title: { type: 'string', required: true },
      content: { type: 'string', required: true },
    },
    requiredPermission: 'create_document'
  },
  update_page: {
    name: 'update_page',
    description: 'Update an existing documentation page',
    parameters: {
      pageId: { type: 'string', required: true },
      title: { type: 'string', required: false },
      content: { type: 'string', required: false },
      mode: { type: 'string', enum: ['append', 'replace'], default: 'replace' }
    },
    requiredPermission: 'edit_document'
  },
  delete_page: {
    name: 'delete_page',
    description: 'Delete a documentation page',
    parameters: {
      pageId: { type: 'string', required: true }
    },
    requiredPermission: 'delete_document'
  },
  get_page: {
    name: 'get_page',
    description: 'Get a documentation page by ID',
    parameters: {
      pageId: { type: 'string', required: true }
    },
    requiredPermission: 'view'
  },
  search_docs: {
    name: 'search_docs',
    description: 'Search documentation pages by query',
    parameters: {
      query: { type: 'string', required: true },
      projectId: { type: 'string', required: true },
      limit: { type: 'number', default: 10 }
    },
    requiredPermission: 'view'
  },
  // Topic actions
  create_topic: {
    name: 'create_topic',
    description: 'Create a new topic/folder in the project',
    parameters: {
      projectId: { type: 'string', required: true },
      name: { type: 'string', required: true },
      parentId: { type: 'string', required: false }
    },
    requiredPermission: 'create_topic'
  },
  list_topics: {
    name: 'list_topics',
    description: 'List all topics in a project',
    parameters: {
      projectId: { type: 'string', required: true }
    },
    requiredPermission: 'view'
  },
  // Project actions
  publish_project: {
    name: 'publish_project',
    description: 'Publish the entire project',
    parameters: {
      projectId: { type: 'string', required: true }
    },
    requiredPermission: 'publish'
  },
  unpublish_project: {
    name: 'unpublish_project',
    description: 'Unpublish the project',
    parameters: {
      projectId: { type: 'string', required: true }
    },
    requiredPermission: 'unpublish'
  },
  get_project: {
    name: 'get_project',
    description: 'Get project details',
    parameters: {
      projectId: { type: 'string', required: true }
    },
    requiredPermission: 'view'
  },
  // AI actions
  summarize_page: {
    name: 'summarize_page',
    description: 'Generate an AI summary of a page',
    parameters: {
      documentId: { type: 'string', required: true }
    },
    requiredPermission: 'view'
  },
  answer_question: {
    name: 'answer_question',
    description: 'Answer a question about a page',
    parameters: {
      documentId: { type: 'string', required: true },
      question: { type: 'string', required: true }
    },
    requiredPermission: 'view'
  },
  generate_content: {
    name: 'generate_content',
    description: 'Generate content based on a prompt and context',
    parameters: {
      prompt: { type: 'string', required: true },
      context: { type: 'string', required: false }
    },
    requiredPermission: 'create_document'
  }
};

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

    console.log(`MCP request: action=${action}, connector=${connector_id}, project=${project_id}`);

    // Special action: list_tools returns available MCP tools
    if (action === 'list_tools') {
      return new Response(
        JSON.stringify({ success: true, data: { tools: Object.values(MCP_TOOLS) } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user can use this connector
    const { data: canUse } = await supabase.rpc('can_use_connector', {
      _connector_id: connector_id,
      _user_id: user.id
    });

    if (!canUse) {
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

    // Allow health_check even if connector is disabled
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
        document_id: params.documentId || params.pageId || null,
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

// Claude AI action handler with full MCP tool support
async function handleClaudeAction(
  connector: any,
  action: string,
  params: Record<string, unknown>,
  userId: string,
  projectId: string,
  supabase: any
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const config = connector.metadata || {};

  // Check tool permission
  const tool = MCP_TOOLS[action as keyof typeof MCP_TOOLS];
  if (tool?.requiredPermission) {
    const { data: hasPermission } = await supabase.rpc('check_project_permission', {
      _project_id: projectId,
      _user_id: userId,
      _action: tool.requiredPermission
    });

    if (!hasPermission) {
      return { success: false, error: `Permission denied: requires ${tool.requiredPermission}` };
    }
  }

  // Handle different action types
  switch (action) {
    case 'health_check':
      return { success: true, data: { status: 'connected', tools: Object.keys(MCP_TOOLS) } };

    // Document actions
    case 'create_page': {
      const { projectId: pid, topicId, title, content } = params as { 
        projectId: string; topicId?: string; title: string; content: string 
      };

      if (!title || !content) {
        return { success: false, error: 'Title and content are required' };
      }

      // Create a placeholder Google Doc ID (in production, would create actual Google Doc)
      const googleDocId = `mcp_${crypto.randomUUID()}`;
      
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          project_id: pid || projectId,
          topic_id: topicId || null,
          title,
          content,
          content_html: `<div>${content}</div>`,
          google_doc_id: googleDocId,
          owner_id: userId,
          is_published: false,
          visibility: 'internal'
        })
        .select()
        .single();

      if (docError) {
        return { success: false, error: `Failed to create page: ${docError.message}` };
      }

      return { success: true, data: { pageId: doc.id, title: doc.title, slug: doc.slug } };
    }

    case 'update_page': {
      const { pageId, title, content, mode = 'replace' } = params as { 
        pageId: string; title?: string; content?: string; mode?: 'append' | 'replace' 
      };

      // Get existing page
      const { data: existing, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', pageId)
        .single();

      if (fetchError || !existing) {
        return { success: false, error: 'Page not found' };
      }

      // Verify project access
      if (existing.project_id !== projectId) {
        const { data: hasAccess } = await supabase.rpc('check_project_permission', {
          _project_id: existing.project_id,
          _user_id: userId,
          _action: 'edit_document'
        });
        if (!hasAccess) {
          return { success: false, error: 'Permission denied' };
        }
      }

      const updates: Record<string, unknown> = {};
      if (title) updates.title = title;
      if (content) {
        updates.content = mode === 'append' ? `${existing.content || ''}\n\n${content}` : content;
        updates.content_html = `<div>${updates.content}</div>`;
      }

      const { error: updateError } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', pageId);

      if (updateError) {
        return { success: false, error: `Failed to update page: ${updateError.message}` };
      }

      return { success: true, data: { pageId, updated: Object.keys(updates) } };
    }

    case 'delete_page': {
      const { pageId } = params as { pageId: string };

      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', pageId);

      if (deleteError) {
        return { success: false, error: `Failed to delete page: ${deleteError.message}` };
      }

      return { success: true, data: { deleted: pageId } };
    }

    case 'get_page': {
      const { pageId } = params as { pageId: string };

      const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('id, title, content, content_html, slug, is_published, topic_id, created_at, updated_at')
        .eq('id', pageId)
        .single();

      if (fetchError || !doc) {
        return { success: false, error: 'Page not found' };
      }

      return { success: true, data: doc };
    }

    case 'search_docs': {
      const { query, projectId: pid, limit = 10 } = params as { 
        query: string; projectId: string; limit?: number 
      };

      const { data: docs, error: searchError } = await supabase
        .from('documents')
        .select('id, title, content, slug, is_published, topic_id')
        .eq('project_id', pid || projectId)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .limit(limit);

      if (searchError) {
        return { success: false, error: `Search failed: ${searchError.message}` };
      }

      return { success: true, data: { results: docs, count: docs?.length || 0 } };
    }

    // Topic actions
    case 'create_topic': {
      const { projectId: pid, name, parentId } = params as { 
        projectId: string; name: string; parentId?: string 
      };

      const driveFolderId = `mcp_${crypto.randomUUID()}`;

      const { data: topic, error: topicError } = await supabase
        .from('topics')
        .insert({
          project_id: pid || projectId,
          name,
          parent_id: parentId || null,
          drive_folder_id: driveFolderId
        })
        .select()
        .single();

      if (topicError) {
        return { success: false, error: `Failed to create topic: ${topicError.message}` };
      }

      return { success: true, data: { topicId: topic.id, name: topic.name, slug: topic.slug } };
    }

    case 'list_topics': {
      const { projectId: pid } = params as { projectId: string };

      const { data: topics, error: fetchError } = await supabase
        .from('topics')
        .select('id, name, slug, parent_id, display_order')
        .eq('project_id', pid || projectId)
        .order('display_order');

      if (fetchError) {
        return { success: false, error: `Failed to list topics: ${fetchError.message}` };
      }

      return { success: true, data: { topics, count: topics?.length || 0 } };
    }

    // Project actions
    case 'publish_project': {
      const { projectId: pid } = params as { projectId: string };

      // Publish all documents in the project
      const { error: publishDocsError } = await supabase
        .from('documents')
        .update({ 
          is_published: true,
          published_content_html: supabase.raw('content_html')
        })
        .eq('project_id', pid || projectId);

      if (publishDocsError) {
        console.error('Error publishing docs:', publishDocsError);
      }

      // Mark project as published
      const { error: publishError } = await supabase
        .from('projects')
        .update({ is_published: true })
        .eq('id', pid || projectId);

      if (publishError) {
        return { success: false, error: `Failed to publish project: ${publishError.message}` };
      }

      return { success: true, data: { published: true, projectId: pid || projectId } };
    }

    case 'unpublish_project': {
      const { projectId: pid } = params as { projectId: string };

      const { error: unpublishError } = await supabase
        .from('projects')
        .update({ is_published: false })
        .eq('id', pid || projectId);

      if (unpublishError) {
        return { success: false, error: `Failed to unpublish project: ${unpublishError.message}` };
      }

      return { success: true, data: { published: false, projectId: pid || projectId } };
    }

    case 'get_project': {
      const { projectId: pid } = params as { projectId: string };

      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('id, name, description, slug, is_published, visibility, created_at')
        .eq('id', pid || projectId)
        .single();

      if (fetchError || !project) {
        return { success: false, error: 'Project not found' };
      }

      return { success: true, data: project };
    }

    // AI-powered actions
    case 'summarize_page':
    case 'answer_question':
    case 'analyze_document':
    case 'generate_content': {
      return await handleAIAction(action, params, userId, projectId, config, supabase);
    }

    default:
      return { success: false, error: `Unknown action: ${action}. Available: ${Object.keys(MCP_TOOLS).join(', ')}` };
  }
}

// Handle AI-powered actions
async function handleAIAction(
  action: string,
  params: Record<string, unknown>,
  userId: string,
  projectId: string,
  config: Record<string, unknown>,
  supabase: any
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Get document content if documentId provided
  let documentContent = params.documentContent as string;
  let documentTitle = params.documentTitle as string;

  if (params.documentId) {
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, title, content, project_id')
      .eq('id', params.documentId)
      .single();

    if (docError || !doc) {
      return { success: false, error: 'Document not found' };
    }

    // Verify access
    if (doc.project_id !== projectId) {
      const { data: hasAccess } = await supabase.rpc('check_project_permission', {
        _project_id: doc.project_id,
        _user_id: userId,
        _action: 'view'
      });
      if (!hasAccess) {
        return { success: false, error: 'Permission denied' };
      }
    }

    documentContent = doc.content;
    documentTitle = doc.title;
  }

  let apiKey: string;
  try {
    apiKey = getGeminiApiKey();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "AI API key not configured" };
  }

  const model = resolveGeminiModel(config.model as string);
  const maxTokens = (config.max_tokens as number) || 4096;

  const systemPrompt = `You are a helpful documentation assistant. You help users with their documentation tasks.
${documentContent ? 'You have access to the following document content. Base your responses on this content.' : ''}`;

  let userMessage: string;
  switch (action) {
    case 'summarize_page':
      userMessage = `Please provide a clear and concise summary of this document.\n\nDocument Title: ${documentTitle}\n\nDocument Content:\n${documentContent}`;
      break;
    case 'answer_question':
      userMessage = `Based on the following document, please answer the question.\n\nDocument Title: ${documentTitle}\n\nDocument Content:\n${documentContent}\n\nQuestion: ${params.question}`;
      break;
    case 'analyze_document':
      userMessage = `Please analyze this document and provide insights about its structure, key topics, and suggestions for improvement.\n\nDocument Title: ${documentTitle}\n\nDocument Content:\n${documentContent}`;
      break;
    case 'generate_content':
      userMessage = `${params.prompt}${params.context ? `\n\nContext:\n${params.context}` : ''}`;
      break;
    default:
      return { success: false, error: `Unknown AI action: ${action}` };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            role: "system",
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userMessage }],
            },
          ],
          generationConfig: {
            maxOutputTokens: maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `AI API error: ${error}` };
    }

    const result = await response.json();
    const parts = result?.candidates?.[0]?.content?.parts || [];
    const content = extractGeminiText(parts);

    return {
      success: true,
      data: {
        response: content,
        summary: action === "summarize_page" ? content : undefined,
        answer: action === "answer_question" ? content : undefined,
        analysis: action === "analyze_document" ? content : undefined,
        generated: action === "generate_content" ? content : undefined,
        model,
        usage: result?.usageMetadata,
      },
    };
  } catch (err) {
    return { success: false, error: `AI request failed: ${err}` };
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

  if (action === 'health_check') {
    if (!config.endpoint_url) {
      return { success: true, data: { status: 'configuring', message: 'Please configure the MCP endpoint URL' } };
    }
  }

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
