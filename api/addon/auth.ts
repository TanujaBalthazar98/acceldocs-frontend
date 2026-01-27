import { createAddonToken } from "../_lib/addonToken.js";
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
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!accessToken) {
    send(res, 401, { error: "Missing Supabase access token" });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    send(res, 401, { error: "Invalid Supabase access token" });
    return;
  }

  const userId = userData.user.id;
  const requestedWorkspaceId = req.body?.workspaceId as string | undefined;

  let workspaceId = requestedWorkspaceId;
  if (!workspaceId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();

    workspaceId = profile?.organization_id ?? undefined;
  }

  if (!workspaceId) {
    const { data: ownedOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    workspaceId = ownedOrg?.id ?? undefined;
  }

  if (!workspaceId) {
    send(res, 400, { error: "No workspace found for user" });
    return;
  }

  let role: string | undefined;
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", workspaceId)
    .maybeSingle();

  if (roleRow?.role) {
    role = roleRow.role as string;
  } else {
    const { data: ownerRow } = await supabase
      .from("organizations")
      .select("owner_id")
      .eq("id", workspaceId)
      .maybeSingle();

    if (ownerRow?.owner_id === userId) {
      role = "owner";
    }
  }

  if (!role) {
    send(res, 403, { error: "User is not a member of this workspace" });
    return;
  }

  const token = createAddonToken({ sub: userId, workspaceId, role }, 10 * 60);

  send(res, 200, {
    token,
    userId,
    workspaceId,
    role,
    expiresIn: 600,
  });
}
