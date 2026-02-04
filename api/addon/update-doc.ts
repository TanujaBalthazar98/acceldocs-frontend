import { verifyAddonToken } from "../_lib/addonToken.js";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";

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
  try {
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
    const projectVersionId = body.projectVersionId as string | undefined;
    const sourceDocId = body.sourceDocId as string | undefined;
    const slug = body.slug as string | undefined;

    if (!projectId || !sourceDocId) {
      send(res, 400, { error: "projectId and sourceDocId are required" });
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

    let query = supabase
      .from("documents")
      .update({ slug: slug || null })
      .eq("google_doc_id", sourceDocId)
      .eq("project_id", projectId);

    if (projectVersionId) {
      query = query.eq("project_version_id", projectVersionId);
    }

    const { data: updatedRows, error: updateError } = await query.select("id, slug");

    if (updateError) {
      send(res, 500, { error: updateError.message });
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      send(res, 404, { error: "Document not found for this Google Doc" });
      return;
    }

    send(res, 200, { updated: updatedRows.length, slug });
  } catch (err: any) {
    console.error("addon/update-doc error", err);
    send(res, 500, { error: err?.message || "Server error" });
  }
}
