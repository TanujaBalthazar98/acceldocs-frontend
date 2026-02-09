import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks (available in Supabase Edge Functions)
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void } | undefined;

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

async function decryptOrgText(
  supabase: any,
  organizationId: string,
  ciphertext: string | null
): Promise<string | null> {
  if (!ciphertext) return null;
  const { data, error } = await supabase.rpc("decrypt_org_text", {
    org_id: organizationId,
    ciphertext,
  });
  if (error || !data) {
    console.error("Failed to decrypt org token:", error?.message);
    return null;
  }
  return data as string;
}

async function getOwnerDriveAccessToken(supabase: any, projectId: string) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project?.organization_id) {
    console.error("Failed to load project organization:", projectError);
    return { token: null, reason: "project_lookup_failed" };
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("owner_id")
    .eq("id", project.organization_id)
    .single();

  if (orgError || !org?.owner_id) {
    console.error("Failed to load organization owner:", orgError);
    return { token: null, reason: "org_lookup_failed" };
  }

  const { data: ownerProfile, error: ownerError } = await supabase
    .from("profiles")
    .select("google_refresh_token, google_refresh_token_encrypted")
    .eq("id", org.owner_id)
    .single();

  const decrypted = await decryptOrgText(
    supabase,
    project.organization_id,
    ownerProfile?.google_refresh_token_encrypted ?? null
  );
  const refreshToken = decrypted || ownerProfile?.google_refresh_token;

  if (ownerError || !refreshToken) {
    console.warn("Owner refresh token missing, skipping Drive cleanup.");
    return { token: null, reason: "missing_refresh_token" };
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.warn("Google OAuth not configured, skipping Drive cleanup.");
    return { token: null, reason: "missing_oauth_config" };
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Failed to refresh owner token:", errorText);
    return { token: null, reason: "refresh_failed" };
  }

  const tokenData = await tokenResponse.json();
  return { token: tokenData.access_token as string, reason: null };
}

async function deleteDriveFile(accessToken: string, fileId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (response.status === 404) {
      return true;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to delete Drive file ${fileId}:`, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error deleting Drive file ${fileId}:`, error);
    return false;
  }
}

async function cleanupDriveArtifacts(
  accessToken: string | null,
  docIds: string[],
  folderIds: string[]
) {
  if (!accessToken) {
    return { deletedDocs: 0, deletedFolders: 0, skipped: true };
  }

  const concurrency = 5;
  let deletedDocs = 0;
  let deletedFolders = 0;

  const deleteInBatches = async (ids: string[]) => {
    let deleted = 0;
    for (let i = 0; i < ids.length; i += concurrency) {
      const batch = ids.slice(i, i + concurrency);
      const results = await Promise.all(batch.map((id) => deleteDriveFile(accessToken, id)));
      deleted += results.filter(Boolean).length;
    }
    return deleted;
  };

  if (docIds.length) {
    deletedDocs = await deleteInBatches(docIds);
  }

  if (folderIds.length) {
    deletedFolders = await deleteInBatches(folderIds);
  }

  return { deletedDocs, deletedFolders, skipped: false };
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
      .select("id, google_doc_id")
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
      .select("id, drive_folder_id")
      .eq("project_id", job.project_id)
      .gte("created_at", jobStartTime);

    if (topicsFetchError) {
      console.error("Failed to fetch topics for cleanup:", topicsFetchError);
    }

    const docIds = (docsToDelete ?? [])
      .map((doc: any) => doc.google_doc_id)
      .filter((id: string | null) => !!id) as string[];
    const folderIds = (topicsToDelete ?? [])
      .map((topic: any) => topic.drive_folder_id)
      .filter((id: string | null) => !!id) as string[];

    const { token: driveToken } = await getOwnerDriveAccessToken(supabase, job.project_id);
    const driveCleanupPromise = cleanupDriveArtifacts(driveToken, docIds, folderIds);
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(driveCleanupPromise);
    } else {
      await driveCleanupPromise;
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
      driveCleanupScheduled: true,
    });
  } catch (err) {
    console.error("stop-import-job error:", err);
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
