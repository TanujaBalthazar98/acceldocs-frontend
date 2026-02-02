import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find Drive-backed projects
    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("id, organization_id")
      .not("drive_folder_id", "is", null);

    if (projectError) {
      return new Response(
        JSON.stringify({ error: projectError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectEntries = (projects || []).map((p: { id: string; organization_id: string | null }) => ({
      id: p.id,
      organization_id: p.organization_id,
    }));
    const projectIds = projectEntries.map((p) => p.id);
    if (projectIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceHeader = { "x-service-role": supabaseKey };
    const syncPromises = projectIds.map((projectId) =>
      fetch(`${supabaseUrl}/functions/v1/sync-drive-permissions`, {
        method: "POST",
        headers: {
          ...serviceHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          direction: "pull",
          enforceNoDownload: true,
        }),
      })
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .catch((err) => ({ ok: false, data: { error: String(err) } }))
    );

    const results = await Promise.all(syncPromises);
    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.length - successCount;

    const successOrgIds = new Set(
      results
        .map((result, index) => (result.ok ? projectEntries[index]?.organization_id : null))
        .filter((orgId): orgId is string => !!orgId)
    );

    if (successOrgIds.size > 0) {
      await supabase
        .from("organizations")
        .update({ drive_permissions_last_synced_at: new Date().toISOString() })
        .in("id", Array.from(successOrgIds));
    }

    return new Response(
      JSON.stringify({
        success: true,
        projects: projectIds.length,
        synced: successCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
