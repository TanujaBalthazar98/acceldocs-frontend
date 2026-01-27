import { verifyAddonToken } from "../_lib/addonToken.js";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  const addonToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!addonToken) {
    send(res, 401, { error: "Missing add-on token" });
    return;
  }

  let tokenPayload;
  try {
    tokenPayload = verifyAddonToken(addonToken);
  } catch (err: any) {
    send(res, 401, { error: err?.message || "Invalid add-on token" });
    return;
  }

  const supabase = getSupabaseAdmin();
  const workspaceId = tokenPayload.workspaceId;

  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id,name,parent_id,slug,organization_id")
    .eq("organization_id", workspaceId);

  if (projectError) {
    send(res, 500, { error: projectError.message });
    return;
  }

  const projectIds = (projects || []).map((project) => project.id);
  if (projectIds.length === 0) {
    send(res, 200, { projects: [], projectVersions: [], topics: [] });
    return;
  }

  const { data: projectVersions, error: versionError } = await supabase
    .from("project_versions")
    .select("id,project_id,name,slug,is_default,is_published")
    .in("project_id", projectIds);

  if (versionError) {
    send(res, 500, { error: versionError.message });
    return;
  }

  const { data: topics, error: topicError } = await supabase
    .from("topics")
    .select("id,name,project_id,parent_id,display_order")
    .in("project_id", projectIds);

  if (topicError) {
    send(res, 500, { error: topicError.message });
    return;
  }

  send(res, 200, {
    projects: projects || [],
    projectVersions: projectVersions || [],
    topics: topics || [],
  });
}
