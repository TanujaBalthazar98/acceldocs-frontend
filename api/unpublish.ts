import { verifyAddonToken } from "./_lib/addonToken.js";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const send = (res: any, status: number, body: unknown) => {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.status(status).json(body);
};

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    send(res, 401, { error: "Missing add-on token" });
    return;
  }

  let payload;
  try {
    payload = verifyAddonToken(token);
  } catch (error: any) {
    send(res, 401, { error: error?.message || "Invalid token" });
    return;
  }

  const body = req.body || {};
  const projectId = body.projectId as string | undefined;
  const requestedVersionId = body.projectVersionId as string | undefined;
  const sourceDocId = body.sourceDocId as string | undefined;

  if (!projectId || !sourceDocId) {
    send(res, 400, { error: "projectId and sourceDocId are required" });
    return;
  }

  const supabase = getSupabaseAdmin() as any;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, organization_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
    send(res, 404, { error: "Project not found" });
    return;
  }

  if (project.organization_id !== payload.workspaceId) {
    send(res, 403, { error: "Project does not belong to workspace" });
    return;
  }

  let projectVersionId = requestedVersionId;
  if (projectVersionId) {
    const { data: versionMatch } = await supabase
      .from("project_versions")
      .select("id")
      .eq("id", projectVersionId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (!versionMatch) {
      projectVersionId = undefined;
    }
  }

  if (!projectVersionId) {
    const { data: versionRow } = await supabase
      .from("project_versions")
      .select("id")
      .eq("project_id", projectId)
      .eq("is_default", true)
      .maybeSingle();

    projectVersionId = versionRow?.id ?? undefined;
  }

  if (!projectVersionId) {
    send(res, 400, { error: "projectVersionId is required for unpublish" });
    return;
  }

  const { data: existingDoc, error: docError } = await supabase
    .from("documents")
    .select("id, title, content_html, content, published_content_html")
    .eq("project_id", projectId)
    .eq("project_version_id", projectVersionId)
    .eq("google_doc_id", sourceDocId)
    .maybeSingle();

  if (docError || !existingDoc) {
    send(res, 404, { error: "Document not found for this Google Doc" });
    return;
  }

  const { error: updateError } = await supabase
    .from("documents")
    .update({ is_published: false })
    .eq("id", existingDoc.id);

  if (updateError) {
    send(res, 500, { error: "Failed to unpublish document" });
    return;
  }

  const contentHtml =
    (existingDoc.content_html as string | null) ||
    (existingDoc.published_content_html as string | null) ||
    null;

  let versionId: string | undefined;
  if (contentHtml) {
    const { data: versionRow } = await supabase
      .from("document_versions")
      .insert({
        document_id: existingDoc.id,
        project_id: projectId,
        project_version_id: projectVersionId,
        title: existingDoc.title,
        content_html: contentHtml,
        content_text: existingDoc.content ?? null,
        source_doc_id: sourceDocId,
        created_by: payload.sub,
        is_preview: false,
        is_published: false,
      })
      .select("id")
      .single();

    if (versionRow?.id) {
      versionId = versionRow.id as string;
    }
  }

  send(res, 200, {
    status: "unpublished",
    documentId: existingDoc.id,
    versionId,
  });
}
