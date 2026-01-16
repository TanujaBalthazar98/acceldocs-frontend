import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-google-token",
};

const GEMINI_MODEL = "gemini-1.5-pro";

type GeminiPart = {
  text?: string;
  functionCall?: {
    name?: string;
    args?: Record<string, unknown> | string | null;
  };
  functionResponse?: {
    name?: string;
    response?: Record<string, unknown>;
  };
};

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

function getGeminiApiKey(): string {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return apiKey;
}

function normalizeGeminiArgs(args: unknown): Record<string, unknown> {
  if (!args) return {};
  if (typeof args === "string") {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }
  if (typeof args === "object") {
    return args as Record<string, unknown>;
  }
  return {};
}

function extractGeminiText(parts: GeminiPart[]): string {
  return parts.map((part) => part?.text || "").join("");
}

function buildGeminiContents(messages: Array<{ role: string; content: string }>): GeminiContent[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message?.content && message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}

// Tool definitions for the AI
const tools = [
  {
    name: "find_project",
    description: "Find a project by name or partial name. ALWAYS use this first when the user mentions a project by name to get its ID.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name or partial name of the project to find" }
      },
      required: ["name"]
    }
  },
  {
    name: "find_topic",
    description: "Find a topic by name within a project. Use this to get a topic's ID when the user mentions it by name.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The ID of the project" },
        name: { type: "string", description: "The name or partial name of the topic to find" }
      },
      required: ["projectId", "name"]
    }
  },
  {
    name: "create_topic",
    description: "Create a new topic (folder) within a project. Execute this immediately when the user wants to create a topic.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The ID of the project to create the topic in" },
        name: { type: "string", description: "The name of the topic to create" },
        parentTopicId: { type: "string", description: "Optional parent topic ID for creating a subtopic" }
      },
      required: ["projectId", "name"]
    }
  },
  {
    name: "create_page",
    description: "Create a new documentation page within a topic. Execute this immediately when the user wants to create a page.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The ID of the project" },
        topicId: { type: "string", description: "The ID of the topic to create the page in" },
        title: { type: "string", description: "The title of the page" },
        content: { type: "string", description: "The initial content for the page in HTML format" }
      },
      required: ["projectId", "topicId", "title"]
    }
  },
  {
    name: "update_page_content",
    description: "Update the content of an existing page.",
    parameters: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The ID of the page to update" },
        content: { type: "string", description: "The new content in HTML format" },
        append: { type: "boolean", description: "Whether to append to existing content (true) or replace it (false)" }
      },
      required: ["pageId", "content"]
    }
  },
  {
    name: "list_projects",
    description: "List all available projects.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "list_topics",
    description: "List all topics within a project with their IDs and display order.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The ID of the project to list topics for" }
      },
      required: ["projectId"]
    }
  },
  {
    name: "list_pages",
    description: "List all pages within a topic or project.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The ID of the project" },
        topicId: { type: "string", description: "Optional topic ID to filter pages" }
      },
      required: ["projectId"]
    }
  },
  {
    name: "generate_documentation",
    description: "Generate documentation content based on a description.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string", description: "The topic or subject to write about" },
        style: { type: "string", description: "The style of documentation (e.g., tutorial, reference, guide)" },
        details: { type: "string", description: "Additional details or requirements for the content" }
      },
      required: ["topic"]
    }
  }
];

// Map tools to required permissions
const toolPermissions: Record<string, string> = {
  find_project: "view",
  find_topic: "view",
  list_projects: "view",
  list_topics: "view",
  list_pages: "view",
  create_topic: "create_topic",
  create_page: "create_document",
  update_page_content: "edit_document",
  generate_documentation: "view", // Just generates content, doesn't save
};

// Check permission using the database function
async function checkPermission(
  supabase: any,
  projectId: string,
  userId: string,
  action: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_project_permission', {
    _project_id: projectId,
    _user_id: userId,
    _action: action
  });
  
  if (error) {
    console.error("Permission check error:", error);
    return false;
  }
  
  return data === true;
}

// Log action to audit_logs
async function logAuditAction(
  supabase: any,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  projectId: string | null,
  metadata: Record<string, any> = {},
  success: boolean = true,
  errorMessage: string | null = null
) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      project_id: projectId,
      metadata,
      success,
      error_message: errorMessage
    });
  } catch (e) {
    console.error("Failed to log audit action:", e);
  }
}

// Execute tool calls with permission checks
async function executeTool(
  toolName: string, 
  args: Record<string, any>, 
  supabase: any, 
  userId: string,
  googleToken: string | null,
  organizationId: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  console.log(`Executing tool: ${toolName}`, args);
  
  // Check permissions for tools that modify data
  const requiredPermission = toolPermissions[toolName];
  const projectId = args.projectId;
  
  if (projectId && requiredPermission && requiredPermission !== "view") {
    const hasPermission = await checkPermission(supabase, projectId, userId, requiredPermission);
    
    if (!hasPermission) {
      // Log unauthorized attempt
      await logAuditAction(
        supabase,
        userId,
        `ai_assistant_${toolName}`,
        "ai_action",
        null,
        projectId,
        { args, unauthorized: true },
        false,
        `Permission denied: ${requiredPermission} required`
      );
      
      return { 
        success: false, 
        error: `Permission denied. You need ${requiredPermission.replace(/_/g, " ")} permission to perform this action.` 
      };
    }
  }
  
  try {
    switch (toolName) {
      case "find_project": {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name, slug, visibility, is_published, drive_folder_id")
          .eq("organization_id", organizationId)
          .ilike("name", `%${args.name}%`);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
          return { success: false, error: `No project found matching "${args.name}"` };
        }
        
        const exactMatch = data.find((p: any) => p.name.toLowerCase() === args.name.toLowerCase());
        const project = exactMatch || data[0];
        
        return { success: true, result: { project, message: `Found project "${project.name}" (ID: ${project.id})` } };
      }
      
      case "find_topic": {
        const { data, error } = await supabase
          .from("topics")
          .select("id, name, parent_id, display_order, drive_folder_id")
          .eq("project_id", args.projectId)
          .ilike("name", `%${args.name}%`);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
          return { success: false, error: `No topic found matching "${args.name}"` };
        }
        
        const exactMatch = data.find((t: any) => t.name.toLowerCase() === args.name.toLowerCase());
        const topic = exactMatch || data[0];
        
        return { success: true, result: { topic, message: `Found topic "${topic.name}" (ID: ${topic.id})` } };
      }
      
      case "list_projects": {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name, slug, visibility, is_published")
          .eq("organization_id", organizationId);
        
        if (error) throw error;
        return { success: true, result: { projects: data } };
      }
      
      case "list_topics": {
        const { data, error } = await supabase
          .from("topics")
          .select("id, name, parent_id, display_order")
          .eq("project_id", args.projectId)
          .order("display_order");
        
        if (error) throw error;
        return { success: true, result: { topics: data, count: data?.length || 0 } };
      }
      
      case "list_pages": {
        let query = supabase
          .from("documents")
          .select("id, title, topic_id, is_published, visibility")
          .eq("project_id", args.projectId);
        
        if (args.topicId) {
          query = query.eq("topic_id", args.topicId);
        }
        
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        return { success: true, result: { pages: data } };
      }
      
      case "create_topic": {
        // Get project's drive folder
        const { data: project } = await supabase
          .from("projects")
          .select("drive_folder_id")
          .eq("id", args.projectId)
          .single();
        
        if (!project?.drive_folder_id) {
          return { success: false, error: "Project not connected to Drive" };
        }
        
        let parentFolderId = project.drive_folder_id;
        
        if (args.parentTopicId) {
          const { data: parentTopic } = await supabase
            .from("topics")
            .select("drive_folder_id")
            .eq("id", args.parentTopicId)
            .single();
          
          if (parentTopic?.drive_folder_id) {
            parentFolderId = parentTopic.drive_folder_id;
          }
        }
        
        if (!googleToken) {
          return { success: false, error: "Google Drive access required. Please reconnect to Google Drive." };
        }
        
        // Create folder in Drive
        const folderResponse = await fetch(
          "https://www.googleapis.com/drive/v3/files",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${googleToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: args.name,
              mimeType: "application/vnd.google-apps.folder",
              parents: [parentFolderId],
            }),
          }
        );
        
        if (!folderResponse.ok) {
          const error = await folderResponse.text();
          return { success: false, error: `Failed to create Drive folder: ${error}` };
        }
        
        const folder = await folderResponse.json();
        
        const { data: existingTopics } = await supabase
          .from("topics")
          .select("display_order")
          .eq("project_id", args.projectId)
          .order("display_order", { ascending: false })
          .limit(1);
        
        const nextOrder = existingTopics?.[0]?.display_order ? existingTopics[0].display_order + 1 : 0;
        
        const { data: topic, error } = await supabase
          .from("topics")
          .insert({
            name: args.name,
            drive_folder_id: folder.id,
            project_id: args.projectId,
            parent_id: args.parentTopicId || null,
            display_order: nextOrder
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Log successful action
        await logAuditAction(supabase, userId, "ai_create_topic", "topic", topic.id, args.projectId, { name: args.name });
        
        return { success: true, result: { topic, message: `✅ Created topic "${args.name}"` } };
      }
      
      case "create_page": {
        const { data: topic } = await supabase
          .from("topics")
          .select("drive_folder_id")
          .eq("id", args.topicId)
          .single();
        
        if (!topic?.drive_folder_id) {
          return { success: false, error: "Topic not found or not connected to Drive" };
        }
        
        if (!googleToken) {
          return { success: false, error: "Google Drive access required. Please reconnect to Google Drive." };
        }
        
        // Create Google Doc
        const docResponse = await fetch(
          "https://www.googleapis.com/drive/v3/files",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${googleToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: args.title,
              mimeType: "application/vnd.google-apps.document",
              parents: [topic.drive_folder_id],
            }),
          }
        );
        
        if (!docResponse.ok) {
          const error = await docResponse.text();
          return { success: false, error: `Failed to create Drive document: ${error}` };
        }
        
        const doc = await docResponse.json();
        
        const { data: document, error } = await supabase
          .from("documents")
          .insert({
            title: args.title,
            google_doc_id: doc.id,
            project_id: args.projectId,
            topic_id: args.topicId,
            content_html: args.content || `<h1>${args.title}</h1><p>Start writing your documentation here.</p>`,
            owner_id: userId,
            visibility: "internal",
            is_published: false
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Log successful action
        await logAuditAction(supabase, userId, "ai_create_page", "document", document.id, args.projectId, { title: args.title });
        
        return { success: true, result: { document, message: `✅ Created page "${args.title}"` } };
      }
      
      case "update_page_content": {
        // Get the page to find its project_id for permission check
        const { data: existingDoc, error: fetchError } = await supabase
          .from("documents")
          .select("content_html, project_id")
          .eq("id", args.pageId)
          .single();
        
        if (fetchError || !existingDoc) {
          return { success: false, error: "Page not found" };
        }
        
        // Check permission for this specific project
        const hasPermission = await checkPermission(supabase, existingDoc.project_id, userId, "edit_document");
        if (!hasPermission) {
          return { success: false, error: "Permission denied. You need edit permission to update this page." };
        }
        
        let newContent = args.content;
        if (args.append && existingDoc?.content_html) {
          newContent = existingDoc.content_html + args.content;
        }
        
        const { data, error } = await supabase
          .from("documents")
          .update({ content_html: newContent, updated_at: new Date().toISOString() })
          .eq("id", args.pageId)
          .select()
          .single();
        
        if (error) throw error;
        
        await logAuditAction(supabase, userId, "ai_update_page", "document", args.pageId, existingDoc.project_id, { append: args.append });
        
        return { success: true, result: { document: data, message: "✅ Page content updated" } };
      }
      
      case "generate_documentation": {
        const prompt = `Generate professional documentation about: ${args.topic}
${args.style ? `Style: ${args.style}` : ""}
${args.details ? `Additional requirements: ${args.details}` : ""}

Generate well-structured HTML documentation with proper headings, paragraphs, code blocks if relevant, and lists where appropriate.`;

        const apiKey = getGeminiApiKey();

        const genResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            systemInstruction: {
              parts: [{
                text: "You are a technical documentation writer. Generate clean, professional HTML documentation. Use semantic HTML tags like <h1>, <h2>, <p>, <ul>, <li>, <code>, <pre>. Do not include <html>, <head>, or <body> tags - just the content.",
              }],
            },
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
            },
          }),
        });
        
        if (!genResponse.ok) {
          const errorText = await genResponse.text();
          console.error("Gemini generation error:", genResponse.status, errorText);
          return { success: false, error: "Failed to generate content" };
        }
        
        const genData = await genResponse.json();
        const generatedContent = extractGeminiText(genData?.candidates?.[0]?.content?.parts || []);
        
        return { success: true, result: { content: generatedContent, message: "✅ Documentation generated" } };
      }
      
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    console.error(`Tool execution error:`, error);
    return { success: false, error: error?.message || "Tool execution failed" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const googleToken = req.headers.get("x-google-token");
    
    console.log("=== docs-ai-assistant request ===");
    console.log("Auth header present:", !!authHeader);
    console.log("Google token present:", !!googleToken);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from auth header by decoding the JWT
    let userId: string | null = null;
    let organizationId: string | null = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        // Decode JWT to get user ID (we trust Supabase's token since it came through the gateway)
        const [_header, payload, _signature] = decode(token);
        userId = (payload as any)?.sub || null;
        console.log("User ID from JWT:", userId);
      } catch (jwtError) {
        console.error("JWT decode error:", jwtError);
      }
      
      if (userId) {
        // Use service role client to fetch profile (bypasses RLS)
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", userId)
          .single();
        
        if (profileError) {
          console.error("Profile fetch error:", profileError.message);
        } else {
          organizationId = profile?.organization_id || null;
          console.log("Organization ID:", organizationId);
        }
      }
    } else {
      console.log("No auth header provided");
    }
    
    if (!userId || !organizationId) {
      console.log("Authentication failed - userId:", userId, "orgId:", organizationId);
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        details: !userId ? "User not authenticated" : "User has no organization"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context } = await req.json();
    const geminiApiKey = getGeminiApiKey();

    // Build context-aware system prompt
    let contextInfo = "";
    if (context?.currentProject) {
      contextInfo += `\nCURRENT PROJECT: "${context.currentProject.name}" (ID: ${context.currentProject.id})`;
    }
    if (context?.currentTopic) {
      contextInfo += `\nCURRENT TOPIC: "${context.currentTopic.name}" (ID: ${context.currentTopic.id})`;
    }

const systemPrompt = `You are an expert documentation assistant that helps users manage their documentation efficiently. You can create topics, pages, and generate high-quality documentation content.

CRITICAL RULES:
1. NEVER ask for clarification if you can figure it out - use find_project or find_topic to look up IDs by name
2. ALWAYS execute the requested action immediately - don't explain what you could do, just DO IT
3. When user mentions a project by name, use find_project to get its ID, then proceed with the action
4. When user mentions a topic by name, use find_topic to get its ID
5. Chain multiple tool calls if needed to complete the task
6. Be concise but helpful in your responses
7. When generating documentation, create comprehensive, well-structured content

${contextInfo}

RESPONSE STYLE:
- Be helpful and proactive
- After completing actions, briefly confirm what was done
- Suggest logical next steps when appropriate
- If something fails, explain clearly and suggest alternatives

DO NOT ask questions like "which project?" or "what ID?" - USE THE TOOLS TO FIND THEM.`;

    const geminiTools = [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];

    const contents = buildGeminiContents(messages);
    let assistantText = "";
    let allToolResults: any[] = [];
    let allActions: any[] = [];
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      iterations++;
      console.log(`Calling Gemini (iteration ${iterations})...`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
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
            contents,
            tools: geminiTools,
            toolConfig: {
              functionCallingConfig: { mode: "AUTO" },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts || [];

      const functionCalls = parts
        .filter((part) => part?.functionCall?.name)
        .map((part) => ({
          name: part.functionCall?.name as string,
          args: normalizeGeminiArgs(part.functionCall?.args),
        }));

      console.log("Gemini response received, functionCalls:", functionCalls.length);

      if (functionCalls.length === 0) {
        assistantText = extractGeminiText(parts).trim();
        break;
      }

      contents.push({ role: "model", parts });

      for (const call of functionCalls) {
        const functionName = call.name;
        const functionArgs = call.args || {};

        console.log(`Executing tool: ${functionName}`, functionArgs);

        const result = await executeTool(
          functionName,
          functionArgs,
          supabase,
          userId,
          googleToken,
          organizationId
        );

        console.log(`Tool ${functionName} result:`, result.success ? "success" : result.error);

        allToolResults.push(result);
        allActions.push({
          name: functionName,
          args: functionArgs,
          result,
        });

        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: functionName,
                response: result,
              },
            },
          ],
        });
      }
    }

    console.log("Returning response with", allActions.length, "actions");

    return new Response(
      JSON.stringify({
        message: assistantText || "Task completed",
        toolResults: allToolResults,
        actions: allActions,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("docs-ai-assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
