import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};

const send = (res: any, status: number, body: unknown) => {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.status(status).json(body);
};

const encryptField = async (supabase: any, organizationId: string, value: string | null | undefined) => {
  if (!value) return null;
  const { data, error } = await supabase.rpc("encrypt_org_text", {
    org_id: organizationId,
    plaintext: value,
  });
  if (error || !data) {
    throw new Error(error?.message || "Failed to encrypt field");
  }
  return data as string;
};

const decryptField = async (supabase: any, organizationId: string, value: string | null | undefined) => {
  if (!value) return null;
  const { data, error } = await supabase.rpc("decrypt_org_text", {
    org_id: organizationId,
    ciphertext: value,
  });
  if (error || !data) {
    throw new Error(error?.message || "Failed to decrypt field");
  }
  return data as string;
};

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    res.status(204).end();
    return;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    send(res, 401, { error: "Missing authorization token" });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    send(res, 401, { error: "Invalid authorization token" });
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.organization_id) {
    send(res, 403, { error: "Organization not found for user" });
    return;
  }

  const organizationId = profile.organization_id as string;

  if (req.method === "GET") {
    const documentId = req.query?.documentId as string | undefined;
    if (!documentId) {
      send(res, 400, { error: "documentId is required" });
      return;
    }

    const { data: cacheRow, error: cacheError } = await supabase
      .from("document_cache")
      .select(
        "document_id, content_html_encrypted, content_text_encrypted, headings_encrypted, published_content_html_encrypted, updated_at"
      )
      .eq("document_id", documentId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (cacheError) {
      send(res, 500, { error: cacheError.message });
      return;
    }

    if (!cacheRow) {
      send(res, 404, { error: "Document cache not found" });
      return;
    }

    try {
      const [contentHtml, contentText, headings, publishedHtml] = await Promise.all([
        decryptField(supabase, organizationId, cacheRow.content_html_encrypted),
        decryptField(supabase, organizationId, cacheRow.content_text_encrypted),
        decryptField(supabase, organizationId, cacheRow.headings_encrypted),
        decryptField(supabase, organizationId, cacheRow.published_content_html_encrypted),
      ]);

      send(res, 200, {
        documentId: cacheRow.document_id,
        contentHtml,
        contentText,
        headings: headings ? JSON.parse(headings) : null,
        publishedContentHtml: publishedHtml,
        updatedAt: cacheRow.updated_at,
      });
      return;
    } catch (error: any) {
      send(res, 500, { error: error?.message || "Failed to decrypt cache" });
      return;
    }
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const documentId = body.documentId as string | undefined;
    if (!documentId) {
      send(res, 400, { error: "documentId is required" });
      return;
    }

    try {
      const [contentHtml, contentText, headings, publishedHtml] = await Promise.all([
        encryptField(supabase, organizationId, body.contentHtml),
        encryptField(supabase, organizationId, body.contentText),
        encryptField(
          supabase,
          organizationId,
          body.headings ? JSON.stringify(body.headings) : null
        ),
        encryptField(supabase, organizationId, body.publishedContentHtml),
      ]);

      const { error: upsertError } = await supabase
        .from("document_cache")
        .upsert(
          {
            document_id: documentId,
            organization_id: organizationId,
            content_html_encrypted: contentHtml,
            content_text_encrypted: contentText,
            headings_encrypted: headings,
            published_content_html_encrypted: publishedHtml,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "document_id" }
        );

      if (upsertError) {
        send(res, 500, { error: upsertError.message });
        return;
      }

      send(res, 200, { success: true });
      return;
    } catch (error: any) {
      send(res, 500, { error: error?.message || "Failed to encrypt cache" });
      return;
    }
  }

  send(res, 405, { error: "Method not allowed" });
}
