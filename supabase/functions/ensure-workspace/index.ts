import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnsureWorkspaceRequest {
  domain: string;
  name?: string;
  driveFolderId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as EnsureWorkspaceRequest;
    const requestedDomain = (body.domain || "").toLowerCase().trim();
    const name = (body.name || "").trim();
    const driveFolderId = body.driveFolderId?.trim();

    const email = (user.email || "").toLowerCase();
    const emailDomain = email.split("@")[1]?.trim();
    const domain = requestedDomain || emailDomain;

    if (!domain) {
      return new Response(JSON.stringify({ ok: false, error: "Missing organization domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (emailDomain && emailDomain !== domain) {
      return new Response(JSON.stringify({ ok: false, error: "Email domain not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const getOrgByDomain = async () => {
      return await supabase
        .from("organizations")
        .select("id, drive_folder_id")
        .eq("domain", domain)
        .maybeSingle();
    };

    // 1) Try fetch existing org.
    const { data: existingOrg, error: existingErr } = await getOrgByDomain();
    if (existingErr) {
      console.error("ensure-workspace: org lookup error", existingErr);
    }

    let organizationId = existingOrg?.id as string | undefined;
    let existed = !!organizationId;

    // 2) Create org if missing.
    if (!organizationId) {
      const { data: created, error: createError } = await supabase
        .from("organizations")
        .insert({
          domain,
          name: name || domain,
          owner_id: user.id,
        })
        .select("id")
        .single();

      if (createError) {
        // Handle race: another user created the row first.
        if (createError.code === "23505") {
          const { data: racedOrg } = await getOrgByDomain();
          if (racedOrg?.id) {
            organizationId = racedOrg.id;
            existed = true;
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      } else {
        organizationId = created.id;
        existed = false;
      }
    }

    // 3) Optionally set drive folder id, but never overwrite an existing one.
    if (organizationId && driveFolderId) {
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("drive_folder_id")
        .eq("id", organizationId)
        .maybeSingle();

      if (!orgRow?.drive_folder_id) {
        const { error: updateErr } = await supabase
          .from("organizations")
          .update({ drive_folder_id: driveFolderId })
          .eq("id", organizationId);
        if (updateErr) console.error("ensure-workspace: drive folder update error", updateErr);
      }
    }

    // 4) Ensure the caller is linked as org member (owner for first creator).
    // If the org already existed, we don't elevate privileges here.
    if (organizationId && !existed) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email || "",
            organization_id: organizationId,
            account_type: "team",
          },
          { onConflict: "id" }
        );
      if (profileError) console.error("ensure-workspace: profile upsert error", profileError);

      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          {
            user_id: user.id,
            organization_id: organizationId,
            role: "owner",
          },
          { onConflict: "user_id,organization_id" }
        );
      if (roleError) console.error("ensure-workspace: role upsert error", roleError);
    }

    return new Response(
      JSON.stringify({ ok: true, existed, organizationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("ensure-workspace error:", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
