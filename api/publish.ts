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
  const slug = body.slug as string | undefined;
  const visibility = body.visibility as string | undefined;

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

  let safeTopicId = topicId;
  if (safeTopicId) {
    const { data: topicMatch } = await supabase
      .from("topics")
      .select("id")
      .eq("id", safeTopicId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (!topicMatch) {
      safeTopicId = undefined;
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
    const { data: createdVersion, error: versionError } = await supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        name: "v1.0",
        slug: "v1.0",
        is_default: true,
        is_published: true,
        created_by: payload.sub,
      })
      .select("id")
      .single();

    if (versionError) {
      send(res, 500, { error: "Failed to create default project version" });
      return;
    }

    projectVersionId = createdVersion.id as string;
  }

  let existingDoc: { id: string; slug: string | null; project_id: string; project_version_id: string | null } | null = null;
  if (sourceDocId) {
    const { data: docRows } = await supabase
      .from("documents")
      .select("id, slug, project_id, project_version_id")
      .eq("google_doc_id", sourceDocId);

    if (docRows && docRows.length > 0) {
      const projectIds = Array.from(new Set(docRows.map((doc: any) => doc.project_id)));
      const { data: docProjects } = await supabase
        .from("projects")
        .select("id, organization_id")
        .in("id", projectIds);

      const allowedProjectIds = new Set(
        (docProjects || [])
          .filter((proj: any) => proj.organization_id === payload.workspaceId)
          .map((proj: any) => proj.id)
      );

      const workspaceDocs = docRows.filter((doc: any) => allowedProjectIds.has(doc.project_id));
      if (workspaceDocs.length > 0) {
        const sameProjectDocs = workspaceDocs.filter((doc: any) => doc.project_id === projectId);
        const exactMatch = sameProjectDocs.find(
          (doc: any) => doc.project_version_id === projectVersionId
        );

        if (exactMatch) {
          existingDoc = exactMatch;
        } else if (sameProjectDocs.length > 0) {
          existingDoc = null;
        } else {
          existingDoc = workspaceDocs[0];
        }
      }
    }
  }

  const docPayload = {
    project_id: projectId,
    project_version_id: projectVersionId,
    topic_id: safeTopicId ?? null,
    google_doc_id: sourceDocId || "",
    title,
    slug: slug ?? existingDoc?.slug ?? null,
    content: contentText ?? null,
    content_html: contentHtml,
    published_content_html: contentHtml,
    is_published: true,
    visibility: visibility ?? undefined,
    owner_id: payload.sub,
  };

  let documentId = existingDoc?.id as string | undefined;

  if (documentId) {
    const { error: updateError } = await supabase
      .from("documents")
      .update(docPayload)
      .eq("id", documentId);

    if (updateError) {
      send(res, 500, { error: "Failed to update document" });
      return;
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("documents")
      .insert(docPayload)
      .select("id")
      .single();

    if (insertError || !inserted) {
      send(res, 500, { error: "Failed to create document" });
      return;
    }

    documentId = inserted.id as string;
  }

  let versionId: string | undefined;
  const { data: versionRow, error: versionInsertError } = await supabase
    .from("document_versions")
    .insert({
      document_id: documentId,
      project_id: projectId,
      project_version_id: projectVersionId,
      title,
      content_html: contentHtml,
      content_text: contentText ?? null,
      source_doc_id: sourceDocId || null,
      created_by: payload.sub,
      is_preview: false,
      is_published: true,
    })
    .select("id")
    .single();

  if (!versionInsertError && versionRow?.id) {
    versionId = versionRow.id as string;
  }

  send(res, 200, {
    status: "published",
    documentId,
    versionId,
  });
}
