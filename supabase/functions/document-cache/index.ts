import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CacheAction = "get" | "set";

interface CacheRequest {
  action: CacheAction;
  documentId: string;
  contentHtml?: string;
  contentText?: string;
  headings?: Array<{ level: number; text: string }>;
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return jsonResponse({ error: "No authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return jsonResponse({ error: "Invalid session" }, 401);

    const body = (await req.json()) as CacheRequest;
    if (!body?.documentId || !body?.action) {
      return jsonResponse({ error: "Missing documentId or action" }, 400);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return jsonResponse({ error: "Organization not found for user" }, 400);
    }

    const { data: doc } = await supabase
      .from("documents")
      .select("id, project_id")
      .eq("id", body.documentId)
      .maybeSingle();

    if (!doc?.project_id) {
      return jsonResponse({ error: "Document not found" }, 404);
    }

    const { data: project } = await supabase
      .from("projects")
      .select("organization_id")
      .eq("id", doc.project_id)
      .maybeSingle();

    const orgId = project?.organization_id as string | undefined;
    if (!orgId || orgId !== profile.organization_id) {
      return jsonResponse({ error: "Not authorized for this document" }, 403);
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!role?.role) {
      return jsonResponse({ error: "Not authorized for this workspace" }, 403);
    }

    if (body.action === "get") {
      const { data: cache } = await supabase
        .from("document_cache")
        .select("content_html_encrypted, content_text_encrypted, headings_encrypted")
        .eq("document_id", body.documentId)
        .maybeSingle();

      if (!cache) {
        return jsonResponse({ success: true, contentHtml: null, contentText: null, headings: [] });
      }

      const decrypt = async (ciphertext: string | null) => {
        if (!ciphertext) return null;
        const { data, error } = await supabase.rpc("decrypt_org_text", {
          org_id: orgId,
          ciphertext,
        });
        if (error) return null;
        return data as string;
      };

      const contentHtml = await decrypt(cache.content_html_encrypted);
      const contentText = await decrypt(cache.content_text_encrypted);
      const headingsJson = await decrypt(cache.headings_encrypted);
      const headings = headingsJson ? JSON.parse(headingsJson) : [];

      return jsonResponse({
        success: true,
        contentHtml,
        contentText,
        headings,
      });
    }

    if (body.action === "set") {
      if (!body.contentHtml) {
        return jsonResponse({ error: "Missing contentHtml" }, 400);
      }

      const encrypt = async (plaintext: string | null) => {
        if (!plaintext) return null;
        const { data, error } = await supabase.rpc("encrypt_org_text", {
          org_id: orgId,
          plaintext,
        });
        if (error) return null;
        return data as string;
      };

      const encryptedHtml = await encrypt(body.contentHtml);
      const encryptedText = await encrypt(body.contentText || "");
      const encryptedHeadings = await encrypt(JSON.stringify(body.headings || []));

      await supabase
        .from("document_cache")
        .upsert(
          {
            document_id: body.documentId,
            organization_id: orgId,
            content_html_encrypted: encryptedHtml,
            content_text_encrypted: encryptedText,
            headings_encrypted: encryptedHeadings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "document_id" }
        );

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("document-cache error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
