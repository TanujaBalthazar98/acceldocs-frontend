import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Topic {
  id: string;
  name: string;
  slug: string;
  project_id: string;
  drive_folder_id: string;
  parent_id: string | null;
  display_order: number;
}

interface Document {
  id: string;
  topic_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "Project ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Normalizing structure for project ${projectId}`);

    // Get all topics for this project
    const { data: topics, error: topicsError } = await supabase
      .from("topics")
      .select("*")
      .eq("project_id", projectId)
      .order("name");

    if (topicsError) {
      throw new Error(`Failed to fetch topics: ${topicsError.message}`);
    }

    if (!topics || topics.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No topics to normalize", merged: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group topics by their base name (first part before " / ")
    const topicGroups = new Map<string, Topic[]>();
    const standaloneTopics: Topic[] = [];

    for (const topic of topics as Topic[]) {
      const parts = topic.name.split(' / ');
      if (parts.length > 1) {
        const baseName = parts[0].trim();
        if (!topicGroups.has(baseName)) {
          topicGroups.set(baseName, []);
        }
        topicGroups.get(baseName)!.push(topic);
      } else {
        // Check if this is a parent for other topics
        const hasChildren = (topics as Topic[]).some(t => 
          t.name.startsWith(topic.name + ' / ') || t.name.startsWith(topic.name + '/')
        );
        if (hasChildren) {
          if (!topicGroups.has(topic.name)) {
            topicGroups.set(topic.name, []);
          }
          topicGroups.get(topic.name)!.unshift(topic); // Add as first (parent)
        } else {
          standaloneTopics.push(topic);
        }
      }
    }

    let mergedCount = 0;
    let parentTopicsCreated = 0;
    const errors: string[] = [];

    // Process each group
    for (const [baseName, groupTopics] of topicGroups) {
      try {
        console.log(`Processing group "${baseName}" with ${groupTopics.length} topics`);

        // Find or create the parent topic
        let parentTopic = groupTopics.find(t => t.name === baseName);
        
        if (!parentTopic) {
          // Need to create a parent topic
          // Use the first topic's drive folder as parent (or we'd need Google token to create new folder)
          const { data: newParent, error: createError } = await supabase
            .from("topics")
            .insert({
              name: baseName,
              slug: baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
              project_id: projectId,
              drive_folder_id: groupTopics[0].drive_folder_id, // Use first topic's folder
              parent_id: null,
              display_order: 0,
            })
            .select()
            .single();

          if (createError) {
            console.error(`Failed to create parent topic ${baseName}:`, createError);
            errors.push(`Failed to create parent: ${baseName}`);
            continue;
          }

          parentTopic = newParent as Topic;
          parentTopicsCreated++;
          console.log(`Created parent topic: ${baseName}`);
        }

        // Update child topics to reference the parent
        for (const childTopic of groupTopics) {
          if (childTopic.id === parentTopic.id) continue;

          // Extract the child name (after the " / ")
          const parts = childTopic.name.split(' / ');
          const childName = parts.slice(1).join(' / ').trim() || parts[0];

          // Update the topic to have proper parent and simplified name
          const { error: updateError } = await supabase
            .from("topics")
            .update({
              name: childName,
              parent_id: parentTopic.id,
              slug: childName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            })
            .eq("id", childTopic.id);

          if (updateError) {
            console.error(`Failed to update topic ${childTopic.name}:`, updateError);
            errors.push(`Failed to update: ${childTopic.name}`);
          } else {
            mergedCount++;
            console.log(`Updated topic "${childTopic.name}" -> "${childName}" under "${baseName}"`);
          }
        }
      } catch (err) {
        console.error(`Error processing group ${baseName}:`, err);
        errors.push(`Error with group: ${baseName}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Normalized ${mergedCount} topics, created ${parentTopicsCreated} parent topics`,
        merged: mergedCount,
        parentTopicsCreated,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Normalize error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Normalize failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
