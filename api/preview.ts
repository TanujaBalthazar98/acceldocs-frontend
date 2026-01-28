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

const isBillingActive = (status: string | null | undefined) =>
  !status || ["active", "trialing", "grace"].includes(status);

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
  const topicId = body.topicId as string | undefined;
  const requestedVersionId = body.projectVersionId as string | undefined;
  const sourceDocId = body.sourceDocId as string | undefined;
  const title = body.title as string | undefined;
  const contentHtml = body.contentHtml as string | undefined;
  const contentText = body.contentText as string | undefined;

  if (!projectId || !title || !contentHtml) {
    send(res, 400, { error: "projectId, title, and contentHtml are required" });
    return;
  }

  const supabase = getSupabaseAdmin();

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

  let billingStatus: string | null | undefined;
  const { data: orgRow, error: orgError } = await supabase
    .from("organizations")
    .select("billing_status")
    .eq("id", payload.workspaceId)
    .maybeSingle();

  if (!orgError) {
    billingStatus = orgRow?.billing_status as string | null | undefined;
  }

  if (!isBillingActive(billingStatus)) {
    send(res, 402, { error: "Billing inactive", reason: billingStatus });
    return;
  }

  let projectVersionId = requestedVersionId;
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
    send(res, 400, { error: "projectVersionId is required for preview" });
    return;
  }

  const { data: existingDoc } = await supabase
    .from("documents")
    .select("id")
    .eq("project_id", projectId)
    .eq("project_version_id", projectVersionId)
    .eq("google_doc_id", sourceDocId || "")
    .maybeSingle();

  const docId = existingDoc?.id ?? null;

  const { data: versionRow, error: versionInsertError } = await supabase
    .from("document_versions")
    .insert({
      document_id: docId,
      project_id: projectId,
      project_version_id: projectVersionId,
      title,
      content_html: contentHtml,
      content_text: contentText ?? null,
      source_doc_id: sourceDocId || null,
      created_by: payload.sub,
      is_preview: true,
      is_published: false,
    })
    .select("id")
    .single();

  if (versionInsertError || !versionRow) {
    send(res, 500, { error: "Failed to create preview version" });
    return;
  }

  send(res, 200, {
    status: "preview",
    previewId: versionRow.id,
  });
}
