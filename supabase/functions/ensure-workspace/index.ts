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

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "tutanota.com",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
]);

const toSlug = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return normalized || "user";
};

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
    const isPersonalEmailDomain = !!emailDomain && PERSONAL_EMAIL_DOMAINS.has(emailDomain);
    const requestedIsEmail = requestedDomain.includes("@");
    const domain = requestedDomain
      ? (isPersonalEmailDomain && !requestedIsEmail ? email : requestedDomain)
      : (isPersonalEmailDomain ? email : emailDomain);
    const isPersonalWorkspace = domain.includes("@");
    const personalSlug = isPersonalWorkspace ? `${toSlug(email.split("@")[0] || "user")}-${user.id.slice(0, 8)}` : null;

    if (!domain) {
      return new Response(JSON.stringify({ ok: false, error: "Missing organization domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isPersonalWorkspace) {
      if (!email || email !== domain) {
        return new Response(JSON.stringify({ ok: false, error: "Email address not allowed" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (emailDomain && emailDomain !== domain) {
      return new Response(JSON.stringify({ ok: false, error: "Email domain not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const getOrgByDomain = async () => {
      return await supabase
        .from("organizations")
        .select("id, drive_folder_id, slug")
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
          name: name || (isPersonalWorkspace ? "Personal Workspace" : domain),
          owner_id: user.id,
          ...(personalSlug ? { slug: personalSlug } : {}),
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

    // 3) Ensure personal workspaces have a slug for clean URLs.
    if (organizationId && personalSlug && !existingOrg?.slug) {
      const { error: slugError } = await supabase
        .from("organizations")
        .update({ slug: personalSlug })
        .eq("id", organizationId);
      if (slugError) console.error("ensure-workspace: slug update error", slugError);
    }

    // 4) Optionally set drive folder id, but never overwrite an existing one.
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

    // 5) Ensure the caller is linked as org member (owner for first creator).
    // For personal workspaces we always link the owner, even if it already existed.
    if (organizationId && (!existed || isPersonalWorkspace)) {
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
