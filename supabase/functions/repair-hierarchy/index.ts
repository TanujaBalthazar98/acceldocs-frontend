import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Project {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  drive_folder_id: string | null;
}

interface Topic {
  id: string;
  name: string;
  slug: string | null;
  project_id: string;
  parent_id: string | null;
  drive_folder_id: string;
}

interface Document {
  id: string;
  title: string;
  topic_id: string | null;
  project_id: string;
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

    const { projectId, dryRun = false } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "projectId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Repair hierarchy for project ${projectId}, dryRun: ${dryRun}`);

    // Get the project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, slug, parent_id, drive_folder_id, organization_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get sub-projects of this project
    const { data: subProjects } = await supabase
      .from("projects")
      .select("id, name, slug, parent_id, drive_folder_id")
      .eq("parent_id", projectId) as { data: Project[] | null };

    // Get topics in this project
    const { data: topics } = await supabase
      .from("topics")
      .select("id, name, slug, project_id, parent_id, drive_folder_id")
      .eq("project_id", projectId) as { data: Topic[] | null };

    const repairs: string[] = [];
    const duplicates: { type: string; name: string; topicId?: string; projectId?: string }[] = [];

    // Find duplicates: topics that have the same name/drive_folder_id as sub-projects
    if (subProjects && topics) {
      for (const subProject of subProjects) {
        // Match by name (case-insensitive) or drive_folder_id
        const matchingTopic = topics.find(
          (t) =>
            t.name.toLowerCase() === subProject.name.toLowerCase() ||
            (subProject.drive_folder_id && t.drive_folder_id === subProject.drive_folder_id)
        );

        if (matchingTopic) {
          duplicates.push({
            type: "topic-matches-subproject",
            name: subProject.name,
            topicId: matchingTopic.id,
            projectId: subProject.id,
          });

          if (!dryRun) {
            // Get documents under the topic
            const { data: topicDocs } = await supabase
              .from("documents")
              .select("id, title, topic_id, project_id")
              .eq("topic_id", matchingTopic.id) as { data: Document[] | null };

            // Move documents from topic to the sub-project (set topic_id to null, change project_id)
            if (topicDocs && topicDocs.length > 0) {
              for (const doc of topicDocs) {
                await supabase
                  .from("documents")
                  .update({ 
                    project_id: subProject.id, 
                    topic_id: null 
                  })
                  .eq("id", doc.id);
                repairs.push(`Moved document "${doc.title}" from topic to sub-project "${subProject.name}"`);
              }
            }

            // Delete the duplicate topic
            const { error: deleteError } = await supabase
              .from("topics")
              .delete()
              .eq("id", matchingTopic.id);

            if (!deleteError) {
              repairs.push(`Deleted duplicate topic "${matchingTopic.name}" (merged into sub-project)`);
            } else {
              console.error("Failed to delete topic:", deleteError);
            }
          }
        }
      }
    }

    // Find orphaned topics (topics whose drive_folder_id no longer exists in Drive - we can't check this without Drive API,
    // but we can check if topic has same name as a deleted/non-existent sub-project by looking for empty topics)
    if (topics && !dryRun) {
      for (const topic of topics) {
        // Check if topic has any documents
        const { count } = await supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("topic_id", topic.id);

        // Skip if topic was already deleted above
        if (duplicates.some((d) => d.topicId === topic.id)) continue;

        // If topic is empty and not a duplicate, flag it (but don't auto-delete, just report)
        if (count === 0) {
          duplicates.push({
            type: "empty-topic",
            name: topic.name,
            topicId: topic.id,
          });
        }
      }
    }

    const result = {
      success: true,
      dryRun,
      projectId,
      projectName: project.name,
      duplicatesFound: duplicates.length,
      duplicates,
      repairsApplied: repairs.length,
      repairs,
    };

    console.log("Repair result:", JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const error = err as Error;
    console.error("Repair hierarchy error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
