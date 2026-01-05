import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-google-token",
};

// Tool definitions for the AI
const tools = [
  {
    name: "create_topic",
    description: "Create a new topic (folder) within a project. Use this when the user wants to create a new section or category for documentation.",
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
    description: "Create a new documentation page within a topic. Use this when the user wants to create a new document or page.",
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
    description: "Update the content of an existing page. Use this when the user wants to modify or add content to a page.",
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
    description: "List all available projects. Use this to help the user see what projects exist.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "list_topics",
    description: "List all topics within a project. Use this to help the user see the structure of a project.",
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
    description: "List all pages within a topic or project. Use this to help the user see existing documentation.",
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
    description: "Generate documentation content based on a description or requirements. Use this when the user wants AI-generated content.",
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

// Execute tool calls
async function executeTool(
  toolName: string, 
  args: Record<string, any>, 
  supabase: any, 
  userId: string,
  googleToken: string | null,
  organizationId: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  console.log(`Executing tool: ${toolName}`, args);
  
  try {
    switch (toolName) {
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
        return { success: true, result: { topics: data } };
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
        
        // If parent topic, get its folder
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
        
        // Create folder in Drive
        if (!googleToken) {
          return { success: false, error: "Google Drive access required" };
        }
        
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
        
        // Get max display order
        const { data: existingTopics } = await supabase
          .from("topics")
          .select("display_order")
          .eq("project_id", args.projectId)
          .order("display_order", { ascending: false })
          .limit(1);
        
        const nextOrder = existingTopics?.[0]?.display_order ? existingTopics[0].display_order + 1 : 0;
        
        // Create topic in DB
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
        return { success: true, result: { topic, message: `Created topic "${args.name}"` } };
      }
      
      case "create_page": {
        // Get topic's drive folder
        const { data: topic } = await supabase
          .from("topics")
          .select("drive_folder_id")
          .eq("id", args.topicId)
          .single();
        
        if (!topic?.drive_folder_id) {
          return { success: false, error: "Topic not found or not connected to Drive" };
        }
        
        if (!googleToken) {
          return { success: false, error: "Google Drive access required" };
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
        
        // Create document in DB
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
        return { success: true, result: { document, message: `Created page "${args.title}"` } };
      }
      
      case "update_page_content": {
        const { data: existingDoc } = await supabase
          .from("documents")
          .select("content_html")
          .eq("id", args.pageId)
          .single();
        
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
        return { success: true, result: { document: data, message: "Page content updated" } };
      }
      
      case "generate_documentation": {
        // Use AI to generate content
        const prompt = `Generate professional documentation about: ${args.topic}
${args.style ? `Style: ${args.style}` : ""}
${args.details ? `Additional requirements: ${args.details}` : ""}

Generate well-structured HTML documentation with proper headings, paragraphs, code blocks if relevant, and lists where appropriate.`;

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        
        const genResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a technical documentation writer. Generate clean, professional HTML documentation. Use semantic HTML tags like <h1>, <h2>, <p>, <ul>, <li>, <code>, <pre>. Do not include <html>, <head>, or <body> tags - just the content." },
              { role: "user", content: prompt }
            ],
          }),
        });
        
        if (!genResponse.ok) {
          return { success: false, error: "Failed to generate content" };
        }
        
        const genData = await genResponse.json();
        const generatedContent = genData.choices?.[0]?.message?.content || "";
        
        return { success: true, result: { content: generatedContent, message: "Documentation generated" } };
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
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from auth header
    let userId: string | null = null;
    let organizationId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
      
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", userId)
          .single();
        organizationId = profile?.organization_id || null;
      }
    }
    
    if (!userId || !organizationId) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a documentation assistant that helps users create and manage their documentation. You have access to tools that can:
- List projects, topics, and pages
- Create new topics and subtopics
- Create new documentation pages
- Update page content
- Generate documentation content using AI

${context?.currentProject ? `Current project: ${context.currentProject.name} (ID: ${context.currentProject.id})` : ""}
${context?.currentTopic ? `Current topic: ${context.currentTopic.name} (ID: ${context.currentTopic.id})` : ""}

When the user asks you to create something:
1. First check if you have the necessary context (project, topic)
2. If not, ask them to specify or use list tools to show options
3. Use the appropriate tool to create the item
4. Confirm what was created

Always be helpful and proactive. If you can accomplish the task with the tools available, do so. If you need more information, ask specific questions.`;

    // Convert tools to Gemini function calling format
    const geminiTools = [{
      function_declarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
    }];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: geminiTools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message;
    
    // Check if there are tool calls
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: any[] = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function?.name;
        let functionArgs = {};
        
        try {
          functionArgs = JSON.parse(toolCall.function?.arguments || "{}");
        } catch (e) {
          console.error("Failed to parse tool arguments:", e);
        }
        
        const result = await executeTool(
          functionName, 
          functionArgs, 
          supabase, 
          userId, 
          googleToken,
          organizationId
        );
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(result)
        });
      }
      
      // Send tool results back for final response
      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            assistantMessage,
            ...toolResults
          ],
        }),
      });
      
      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error("Final AI response error:", errorText);
        return new Response(JSON.stringify({ error: "Failed to process tool results" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const finalData = await finalResponse.json();
      return new Response(JSON.stringify({
        message: finalData.choices?.[0]?.message?.content || "Task completed",
        toolResults: toolResults.map(tr => JSON.parse(tr.content)),
        actions: assistantMessage.tool_calls.map((tc: any) => ({
          name: tc.function?.name,
          args: JSON.parse(tc.function?.arguments || "{}")
        }))
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No tool calls, just return the message
    return new Response(JSON.stringify({
      message: assistantMessage?.content || "I'm not sure how to help with that.",
      toolResults: [],
      actions: []
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("docs-ai-assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
