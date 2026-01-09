import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StopImportRequest = {
  jobId: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Invalid session" }, 401);
    }

    const body = (await req.json().catch(() => null)) as StopImportRequest | null;
    const jobId = body?.jobId;

    if (!jobId || typeof jobId !== "string") {
      return jsonResponse({ error: "jobId is required" }, 400);
    }

    // Fetch job
    const { data: job, error: jobError } = await supabase
      .from("import_jobs")
      .select("id, user_id, project_id, created_at, status, errors")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      console.error("Failed to load import job:", jobError);
      return jsonResponse({ error: "Failed to load import job" }, 500);
    }

    if (!job) {
      return jsonResponse({ error: "Import job not found" }, 404);
    }

    // Permission: job owner OR project admin/editor
    let allowed = job.user_id === user.id;
    if (!allowed) {
      const { data: role, error: roleError } = await supabase.rpc("get_project_role", {
        _project_id: job.project_id,
        _user_id: user.id,
      });

      if (!roleError && (role === "admin" || role === "editor")) {
        allowed = true;
      }
    }

    if (!allowed) {
      return jsonResponse({ error: "Not allowed" }, 403);
    }

    // Mark as stopped first so the running import aborts ASAP
    const existingErrors = Array.isArray(job.errors) ? job.errors : [];
    const updatedErrors = [
      ...existingErrors,
      "Import stopped by user - cleaning up partial content",
    ];

    const nowIso = new Date().toISOString();

    const { error: stopError } = await supabase
      .from("import_jobs")
      .update({
        status: "stopped",
        completed_at: nowIso,
        updated_at: nowIso,
        current_file: null,
        errors: updatedErrors,
      })
      .eq("id", jobId);

    if (stopError) {
      console.error("Failed to stop import job:", stopError);
      return jsonResponse({ error: "Failed to stop import job" }, 500);
    }

    // Give the running background import a moment to observe the stop signal
    await delay(1500);

    // Cleanup DB content created after job started (documents first, then topics)
    const jobStartTime = job.created_at;

    const { data: docsToDelete, error: docsFetchError } = await supabase
      .from("documents")
      .select("id")
      .eq("project_id", job.project_id)
      .gte("created_at", jobStartTime);

    if (docsFetchError) {
      console.error("Failed to fetch documents for cleanup:", docsFetchError);
    }

    if (docsToDelete?.length) {
      const { error: deleteDocsError } = await supabase
        .from("documents")
        .delete()
        .in(
          "id",
          docsToDelete.map((d: any) => d.id)
        );

      if (deleteDocsError) {
        console.error("Failed to delete documents during cleanup:", deleteDocsError);
      }
    }

    const { data: topicsToDelete, error: topicsFetchError } = await supabase
      .from("topics")
      .select("id")
      .eq("project_id", job.project_id)
      .gte("created_at", jobStartTime);

    if (topicsFetchError) {
      console.error("Failed to fetch topics for cleanup:", topicsFetchError);
    }

    if (topicsToDelete?.length) {
      const { error: deleteTopicsError } = await supabase
        .from("topics")
        .delete()
        .in(
          "id",
          topicsToDelete.map((t: any) => t.id)
        );

      if (deleteTopicsError) {
        console.error("Failed to delete topics during cleanup:", deleteTopicsError);
      }
    }

    return jsonResponse({
      success: true,
      deletedPages: docsToDelete?.length ?? 0,
      deletedTopics: topicsToDelete?.length ?? 0,
    });
  } catch (err) {
    console.error("stop-import-job error:", err);
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
