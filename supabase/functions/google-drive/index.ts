import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-google-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateFolderRequest {
  action: "create_folder";
  name: string;
  parentFolderId: string;
  projectId?: string;
}

interface CreateDocRequest {
  action: "create_doc";
  title: string;
  parentFolderId: string;
  projectId?: string;
}

interface ListFolderRequest {
  action: "list_folder";
  folderId: string;
  projectId?: string;
}

interface GetDocContentRequest {
  action: "get_doc_content";
  docId: string;
  projectId?: string;
}

interface SyncDocContentRequest {
  action: "sync_doc_content";
  documentId: string;
  googleDocId: string;
  projectId?: string;
}

interface UpdateDocContentRequest {
  action: "update_doc_content";
  documentId: string;
  googleDocId: string;
  html: string;
  projectId?: string;
}

interface TrashFileRequest {
  action: "trash_file";
  fileId: string;
  projectId?: string;
}

interface MoveFileRequest {
  action: "move_file";
  fileId: string;
  targetFolderId: string;
  projectId?: string;
}

type RequestBody =
  | CreateFolderRequest
  | CreateDocRequest
  | ListFolderRequest
  | GetDocContentRequest
  | SyncDocContentRequest
  | UpdateDocContentRequest
  | TrashFileRequest
  | MoveFileRequest;

const isDriveNotFound = (errorText: string) =>
  errorText.includes("File not found") || errorText.includes("\"notFound\"");

const isScopeInsufficient = (errorText: string) =>
  errorText.includes("SCOPE_INSUFFICIENT") ||
  errorText.includes("insufficientPermissions") ||
  errorText.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") ||
  errorText.includes("Insufficient Permission");

const driveFolderAccessHint =
  "Folder not accessible. Make sure the root folder belongs to the connected Google account, then re-select it in Settings.";

// Check if user has permission for a Drive operation
async function checkDrivePermission(
  supabase: any,
  userId: string,
  projectId: string | undefined,
  operation: string
): Promise<{ allowed: boolean; error?: string }> {
  if (!projectId) {
    // If no project context, allow basic operations (backwards compatibility)
    console.log("No project context provided, allowing operation");
    return { allowed: true };
  }

  try {
    const { data: allowed, error } = await supabase.rpc('can_access_drive', {
      _project_id: projectId,
      _user_id: userId,
      _operation: operation,
    });

    if (error) {
      console.error("Permission check error:", error);
      return { allowed: false, error: "Failed to check permissions" };
    }

    if (!allowed) {
      // Log unauthorized attempt
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: `unauthorized_drive_${operation}`,
        entity_type: 'drive',
        entity_id: null,
        project_id: projectId,
        metadata: { operation, attempted: true },
        success: false,
        error_message: `User attempted Drive ${operation} without permission`,
      });
    }

    return { allowed: !!allowed };
  } catch (err) {
    console.error("Permission check exception:", err);
    return { allowed: false, error: "Permission check failed" };
  }
}

// Map action to Drive operation type
function getOperationForAction(action: string): string {
  switch (action) {
    case 'create_folder':
    case 'create_doc':
      return 'edit';
    case 'list_folder':
      return 'view';
    case 'get_doc_content':
      return 'view';
    case 'sync_doc_content':
      return 'edit';
    case 'update_doc_content':
      return 'edit';
    case 'trash_file':
      return 'edit';
    case 'move_file':
      return 'edit';
    default:
      return 'view';
  }
}

// Attempt to resolve project context when callers don't provide projectId
// (needed so non-owners can operate using the org owner's Drive connection)
async function resolveProjectIdFromFolderId(
  supabase: any,
  folderId: string
): Promise<string | undefined> {
  // Topic folder → project
  const { data: topic } = await supabase
    .from("topics")
    .select("project_id")
    .eq("drive_folder_id", folderId)
    .maybeSingle();

  if (topic?.project_id) return topic.project_id as string;

  // Project folder → project
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("drive_folder_id", folderId)
    .maybeSingle();

  return project?.id as string | undefined;
}

async function resolveProjectIdFromFileId(
  supabase: any,
  fileId: string
): Promise<string | undefined> {
  // Document file → project
  const { data: doc } = await supabase
    .from("documents")
    .select("project_id")
    .eq("google_doc_id", fileId)
    .maybeSingle();

  if (doc?.project_id) return doc.project_id as string;

  // Folder file → project/topic folder
  return resolveProjectIdFromFolderId(supabase, fileId);
}

async function resolveProjectIdFromBody(
  supabase: any,
  body: RequestBody
): Promise<string | undefined> {
  // If client provided a projectId, trust it (still subject to RBAC)
  if ("projectId" in body && body.projectId) return body.projectId;

  switch (body.action) {
    case "list_folder":
      return resolveProjectIdFromFolderId(supabase, body.folderId);
    case "create_folder":
    case "create_doc":
      return resolveProjectIdFromFolderId(supabase, body.parentFolderId);
    case "get_doc_content":
      return resolveProjectIdFromFileId(supabase, body.docId);
    case "sync_doc_content": {
      const { data: dbDoc } = await supabase
        .from("documents")
        .select("project_id")
        .eq("id", body.documentId)
        .maybeSingle();
      return (dbDoc?.project_id as string | undefined) ??
        (body.googleDocId ? await resolveProjectIdFromFileId(supabase, body.googleDocId) : undefined);
    }
    case "update_doc_content": {
      const { data: dbDoc } = await supabase
        .from("documents")
        .select("project_id")
        .eq("id", body.documentId)
        .maybeSingle();
      return (dbDoc?.project_id as string | undefined) ??
        (body.googleDocId ? await resolveProjectIdFromFileId(supabase, body.googleDocId) : undefined);
    }
    case "trash_file":
      return resolveProjectIdFromFileId(supabase, body.fileId);
    default:
      return undefined;
  }
}

async function getDriveTokenOwnerIdForProject(
  supabase: any,
  projectId: string
): Promise<string | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project?.organization_id) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("owner_id")
    .eq("id", project.organization_id)
    .maybeSingle();

  return (org?.owner_id as string | null) ?? null;
}

async function getDriveTokenOwnerIdForOrgFolder(
  supabase: any,
  folderId: string
): Promise<string | null> {
  const { data: org } = await supabase
    .from("organizations")
    .select("owner_id")
    .eq("drive_folder_id", folderId)
    .maybeSingle();

  return (org?.owner_id as string | null) ?? null;
}

// Refresh Google access token using refresh token
async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    return null;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token refresh failed:", errorText);
      return null;
    }

    const data = await response.json();
    console.log("Token refreshed successfully");
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

async function decryptOrgText(
  supabase: any,
  organizationId: string,
  ciphertext: string | null
): Promise<string | null> {
  if (!ciphertext) return null;
  const { data, error } = await supabase.rpc("decrypt_org_text", {
    org_id: organizationId,
    ciphertext,
  });
  if (error || !data) {
    console.error("Failed to decrypt org token:", error?.message);
    return null;
  }
  return data as string;
}

async function encryptOrgText(
  supabase: any,
  organizationId: string,
  plaintext: string | null
): Promise<string | null> {
  if (!plaintext) return null;
  const { data, error } = await supabase.rpc("encrypt_org_text", {
    org_id: organizationId,
    plaintext,
  });
  if (error || !data) {
    console.error("Failed to encrypt org content:", error?.message);
    return null;
  }
  return data as string;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function htmlToPlainText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  const decoded = decodeHtmlEntities(stripped);
  const normalized = decoded
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized ? `${normalized}\n` : "\n";
}

async function refreshUserAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, google_refresh_token_encrypted, google_refresh_token")
    .eq("id", userId)
    .single();

  const orgId = (profile as { organization_id: string | null } | null)?.organization_id ?? null;
  const encryptedToken = (profile as { google_refresh_token_encrypted: string | null } | null)
    ?.google_refresh_token_encrypted ?? null;
  const legacyToken = (profile as { google_refresh_token: string | null } | null)
    ?.google_refresh_token ?? null;

  if (profileError || !orgId) {
    console.log("No organization available for user");
    return null;
  }

  const refreshToken = encryptedToken
    ? await decryptOrgText(supabase, orgId, encryptedToken)
    : legacyToken;

  if (!refreshToken) {
    console.log("No refresh token available for user");
    return null;
  }

  const refreshResult = await refreshGoogleToken(refreshToken);
  if (!refreshResult) {
    console.log("Token refresh failed");
    return null;
  }

  await supabase
    .from("profiles")
    .update({ google_token_refreshed_at: new Date().toISOString() } as Record<string, unknown>)
    .eq("id", userId);

  return refreshResult.accessToken;
}

// Get valid access token - either from header or by refreshing
async function getValidAccessToken(
  providerToken: string | null,
  userId: string,
  supabase: any
): Promise<{ token: string | null; needsReauth: boolean }> {
  if (providerToken) {
    console.log("Using provided access token");
    return { token: providerToken, needsReauth: false };
  }

  console.log("No provider token provided, attempting refresh token flow");
  const refreshed = await refreshUserAccessToken(supabase, userId);
  if (!refreshed) {
    return { token: null, needsReauth: true };
  }

  return { token: refreshed, needsReauth: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header", needsReauth: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.log("User session not valid, returning soft error:", userError?.message);
      return new Response(
        JSON.stringify({ 
          error: "Session expired", 
          needsReauth: true,
          message: "Please sign in again to continue" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    console.log("Request body:", JSON.stringify(body));

    // RBAC Permission Check
    const operation = getOperationForAction(body.action);
    const resolvedProjectId = await resolveProjectIdFromBody(supabase, body);
    // Keep a `projectId` variable for downstream logging/backwards-compat usage
    const projectId = resolvedProjectId;

    const permCheck = await checkDrivePermission(supabase, user.id, resolvedProjectId, operation);
    if (!permCheck.allowed) {
      console.log("RBAC denied:", body.action, "for user:", user.id, "project:", resolvedProjectId);
      return new Response(
        JSON.stringify({
          error: "Insufficient permissions",
          message: `You don't have permission to ${operation} in this project`,
          code: "PERMISSION_DENIED",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const providerTokenFromHeader = req.headers.get("x-google-token");

    // IMPORTANT: For project-scoped Drive actions we always use the org owner's Drive connection.
    // This ensures non-owners can still create/move/delete pages without having Drive scopes.
    const fallbackFolderId =
      body.action === "list_folder"
        ? body.folderId
        : body.action === "create_folder" || body.action === "create_doc"
          ? body.parentFolderId
          : body.action === "move_file"
            ? body.targetFolderId
            : null;

    const orgOwnerId = fallbackFolderId
      ? await getDriveTokenOwnerIdForOrgFolder(supabase, fallbackFolderId)
      : null;

    const driveTokenUserId = resolvedProjectId
      ? await getDriveTokenOwnerIdForProject(supabase, resolvedProjectId)
      : (orgOwnerId ?? user.id);

    if (!driveTokenUserId) {
      return new Response(
        JSON.stringify({
          error: "Workspace owner Drive connection not configured",
          needsReauth: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only use the caller-provided token when it belongs to the Drive owner.
    const providerTokenForUse =
      providerTokenFromHeader && driveTokenUserId === user.id ? providerTokenFromHeader : null;

    const { token: initialGoogleToken, needsReauth } = await getValidAccessToken(
      providerTokenForUse,
      driveTokenUserId,
      supabase
    );

    if (!initialGoogleToken || needsReauth) {
      console.error("No valid Google token available");
      return new Response(
        JSON.stringify({
          error: "Google access token not available. Please re-authenticate with Google.",
          needsReauth: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenRef = { token: initialGoogleToken };

    const fetchWithRefresh = async (url: string, init: RequestInit = {}) => {
      const doFetch = (t: string) =>
        fetch(url, {
          ...init,
          headers: {
            ...(init.headers || {}),
            Authorization: `Bearer ${t}`,
          },
        });

      let res = await doFetch(tokenRef.token);

      if (res.status === 401 || res.status === 403) {
        console.log("Google token rejected, attempting refresh...");
        const refreshed = await refreshUserAccessToken(supabase, driveTokenUserId);
        if (refreshed) {
          tokenRef.token = refreshed;
          res = await doFetch(refreshed);
        }
      }

      return res;
    };

    // List folder contents
    if (body.action === "list_folder") {
      console.log("Listing folder:", body.folderId);
      
      const query = encodeURIComponent(`'${body.folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,createdTime)");
      
      const response = await fetchWithRefresh(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);

        if (response.status === 404 && isDriveNotFound(errorText)) {
          return new Response(
            JSON.stringify({
              error: driveFolderAccessHint,
              errorCode: "FOLDER_NOT_ACCESSIBLE",
              details: errorText,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (errorText.includes("SCOPE_INSUFFICIENT") || errorText.includes("insufficientPermissions")) {
          return new Response(
            JSON.stringify({ error: "Insufficient scopes", needsDriveAccess: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (response.status === 401 || response.status === 403) {
          return new Response(
            JSON.stringify({ 
              error: "Google authentication expired", 
              needsReauth: true,
              details: errorText 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to list folder", details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      console.log("Folder contents:", data.files?.length, "items");

      return new Response(
        JSON.stringify({ success: true, files: data.files || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get document content
    if (body.action === "get_doc_content") {
      console.log("Getting doc content via Drive export:", body.docId);
      
      const response = await fetchWithRefresh(
        `https://www.googleapis.com/drive/v3/files/${body.docId}/export?mimeType=text/html&supportsAllDrives=true`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive export error:", errorText);
        
        // Handle file too large error
        if (errorText.includes("exportSizeLimitExceeded") || errorText.includes("too large to be exported")) {
          return new Response(
            JSON.stringify({ 
              error: "Document too large", 
              fileTooLarge: true,
              message: "This document is too large to export. Please split it into smaller documents or edit directly in Google Docs."
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Handle auth errors
        if (response.status === 401 || (response.status === 403 && !errorText.includes("exportSizeLimitExceeded"))) {
          return new Response(
            JSON.stringify({ 
              error: "Google authentication expired", 
              needsReauth: true,
              details: errorText 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to get document", details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const htmlContent = await response.text();
      console.log("Document exported as HTML, length:", htmlContent.length);

      return new Response(
        JSON.stringify({ success: true, html: htmlContent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync document content
    if (body.action === "sync_doc_content") {
      console.log("Syncing doc content:", body.googleDocId, "to document:", body.documentId);
      
      const metadataResponse = await fetchWithRefresh(
        `https://www.googleapis.com/drive/v3/files/${body.googleDocId}?fields=modifiedTime,name&supportsAllDrives=true`
      );

      let googleModifiedAt: string | null = null;
      if (metadataResponse.ok) {
        const metadata = await metadataResponse.json();
        googleModifiedAt = metadata.modifiedTime;
        console.log("Document modifiedTime:", googleModifiedAt);
      } else {
        console.warn("Failed to fetch file metadata, continuing without modifiedTime");
      }
      
      const response = await fetchWithRefresh(
        `https://www.googleapis.com/drive/v3/files/${body.googleDocId}/export?mimeType=text/html&supportsAllDrives=true`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive export error:", errorText);
        
        // Handle file too large error
        if (errorText.includes("exportSizeLimitExceeded") || errorText.includes("too large to be exported")) {
          return new Response(
            JSON.stringify({ 
              error: "Document too large", 
              fileTooLarge: true,
              message: "This document is too large to sync. Please split it into smaller documents."
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Handle auth errors
        if (response.status === 401 || (response.status === 403 && !errorText.includes("exportSizeLimitExceeded"))) {
          return new Response(
            JSON.stringify({ 
              error: "Google authentication expired", 
              needsReauth: true,
              details: errorText 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to get document", details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const htmlContent = await response.text();
      console.log("Document exported as HTML, length:", htmlContent.length);

      const updateData: Record<string, unknown> = {
        content_html: htmlContent,
        last_synced_at: new Date().toISOString(),
        is_published: false
      };
      if (googleModifiedAt) {
        updateData.google_modified_at = googleModifiedAt;
      }

      const { error: updateError } = await supabase
        .from("documents")
        .update(updateData)
        .eq("id", body.documentId);

      if (updateError) {
        console.error("Database update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to save content", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (projectId) {
        const { data: projectRow } = await supabase
          .from("projects")
          .select("organization_id")
          .eq("id", projectId)
          .maybeSingle();

        const orgId = projectRow?.organization_id as string | undefined;
        if (orgId) {
          const encryptedHtml = await encryptOrgText(supabase, orgId, htmlContent);
          if (encryptedHtml) {
            await supabase
              .from("document_cache")
              .upsert(
                {
                  document_id: body.documentId,
                  organization_id: orgId,
                  content_html_encrypted: encryptedHtml,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "document_id" }
              );
          }
        }
      }

      // Log successful sync
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'sync_content',
        entity_type: 'document',
        entity_id: body.documentId,
        project_id: projectId,
        metadata: { googleDocId: body.googleDocId },
        success: true,
      });

      console.log("Content synced successfully with modifiedTime:", googleModifiedAt);
      return new Response(
        JSON.stringify({ success: true, html: htmlContent, modifiedAt: googleModifiedAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update document content
    if (body.action === "update_doc_content") {
      console.log("Updating doc content:", body.googleDocId, "from document:", body.documentId);

      const docResponse = await fetchWithRefresh(
        `https://docs.googleapis.com/v1/documents/${body.googleDocId}`
      );

      if (!docResponse.ok) {
        const errorText = await docResponse.text();
        console.error("Google Docs API error:", errorText);
        if (docResponse.status === 401 || docResponse.status === 403) {
          return new Response(
            JSON.stringify({
              error: "Google authentication expired",
              needsReauth: true,
              details: errorText,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "Failed to read document", details: errorText }),
          { status: docResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const docJson = await docResponse.json();
      const contentBlocks = docJson?.body?.content || [];
      let maxEndIndex = 1;
      for (const block of contentBlocks) {
        const endIndex = Number(block?.endIndex || 0);
        if (endIndex > maxEndIndex) maxEndIndex = endIndex;
      }

      const plainText = htmlToPlainText(body.html);
      const requests: Array<Record<string, unknown>> = [];

      if (maxEndIndex > 1) {
        requests.push({
          deleteContentRange: {
            range: { startIndex: 1, endIndex: maxEndIndex - 1 },
          },
        });
      }

      requests.push({
        insertText: {
          location: { index: 1 },
          text: plainText,
        },
      });

      const updateResponse = await fetchWithRefresh(
        `https://docs.googleapis.com/v1/documents/${body.googleDocId}:batchUpdate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests }),
        }
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error("Google Docs update error:", errorText);
        if (updateResponse.status === 401 || updateResponse.status === 403) {
          return new Response(
            JSON.stringify({
              error: "Google authentication expired",
              needsReauth: true,
              details: errorText,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "Failed to update document", details: errorText }),
          { status: updateResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("documents")
        .update({
          content_html: body.html,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", body.documentId);

      if (projectId) {
        const { data: projectRow } = await supabase
          .from("projects")
          .select("organization_id")
          .eq("id", projectId)
          .maybeSingle();

        const orgId = projectRow?.organization_id as string | undefined;
        if (orgId) {
          const encryptedHtml = await encryptOrgText(supabase, orgId, body.html);
          if (encryptedHtml) {
            await supabase
              .from("document_cache")
              .upsert(
                {
                  document_id: body.documentId,
                  organization_id: orgId,
                  content_html_encrypted: encryptedHtml,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "document_id" }
              );
          }
        }
      }

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "update_doc_content",
        entity_type: "document",
        entity_id: body.documentId,
        project_id: projectId,
        metadata: { googleDocId: body.googleDocId },
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create folder
    if (body.action === "create_folder") {
      console.log("Creating folder:", body.name, "in parent:", body.parentFolderId);
      
      const folderMetadata = {
        name: body.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [body.parentFolderId],
      };

      const response = await fetchWithRefresh("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(folderMetadata),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);

        if (response.status === 404 && isDriveNotFound(errorText)) {
          return new Response(
            JSON.stringify({
              error: driveFolderAccessHint,
              errorCode: "FOLDER_NOT_ACCESSIBLE",
              details: errorText,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (isScopeInsufficient(errorText)) {
          return new Response(
            JSON.stringify({ error: "Insufficient scopes", needsDriveAccess: true, details: errorText }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (response.status === 401 || response.status === 403) {
          return new Response(
            JSON.stringify({ 
              error: "Google authentication expired", 
              needsReauth: true,
              details: errorText 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to create folder", details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const folder = await response.json();
      console.log("Folder created:", folder.id);

      // Log successful creation
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'create_folder',
        entity_type: 'folder',
        entity_id: folder.id,
        project_id: projectId,
        metadata: { folderName: body.name },
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, folder }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create doc
    if (body.action === "create_doc") {
      console.log("Creating doc:", body.title, "in parent:", body.parentFolderId);
      
      const docMetadata = {
        name: body.title,
        mimeType: "application/vnd.google-apps.document",
        parents: [body.parentFolderId],
      };

      const response = await fetchWithRefresh("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(docMetadata),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);

        if (response.status === 404 && isDriveNotFound(errorText)) {
          return new Response(
            JSON.stringify({
              error: driveFolderAccessHint,
              errorCode: "FOLDER_NOT_ACCESSIBLE",
              details: errorText,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (isScopeInsufficient(errorText)) {
          return new Response(
            JSON.stringify({ error: "Insufficient scopes", needsDriveAccess: true, details: errorText }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (response.status === 401 || response.status === 403) {
          return new Response(
            JSON.stringify({ 
              error: "Google authentication expired", 
              needsReauth: true,
              details: errorText 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to create document", details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const doc = await response.json();
      console.log("Document created:", doc.id);

      // Log successful creation
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'create_document',
        entity_type: 'document',
        entity_id: doc.id,
        project_id: projectId,
        metadata: { documentTitle: body.title },
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, doc }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Move file to target folder
    if (body.action === "move_file") {
      console.log("Moving file:", body.fileId, "to folder:", body.targetFolderId);

      const getResponse = await fetchWithRefresh(
        `https://www.googleapis.com/drive/v3/files/${body.fileId}?fields=parents&supportsAllDrives=true`
      );

      if (!getResponse.ok) {
        const errorText = await getResponse.text();
        console.error("Google Drive API error:", errorText);
        if (getResponse.status === 401 || getResponse.status === 403) {
          return new Response(
            JSON.stringify({ error: "Google authentication expired", needsReauth: true, details: errorText }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "Failed to fetch file parents", details: errorText }),
          { status: getResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fileMeta = await getResponse.json();
      const currentParents: string[] = fileMeta.parents || [];
      if (currentParents.includes(body.targetFolderId)) {
        return new Response(
          JSON.stringify({ success: true, alreadyInFolder: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const removeParents = currentParents.join(",");
      const updateUrl = `https://www.googleapis.com/drive/v3/files/${body.fileId}?addParents=${body.targetFolderId}&removeParents=${removeParents}&supportsAllDrives=true`;
      const updateResponse = await fetchWithRefresh(updateUrl, { method: "PATCH" });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error("Google Drive API error:", errorText);
        if (updateResponse.status === 401 || updateResponse.status === 403) {
          return new Response(
            JSON.stringify({ error: "Google authentication expired", needsReauth: true, details: errorText }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "Failed to move file", details: errorText }),
          { status: updateResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trash file
    if (body.action === "trash_file") {
      console.log("Trashing file/folder:", body.fileId);
      
      const response = await fetchWithRefresh(`https://www.googleapis.com/drive/v3/files/${body.fileId}?supportsAllDrives=true`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trashed: true }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);
        
        // Parse the error to extract the reason
        let errorReason = "";
        try {
          const errorJson = JSON.parse(errorText);
          errorReason = errorJson?.error?.errors?.[0]?.reason || "";
        } catch {
          // Ignore parse errors
        }
        
        if (response.status === 401 || response.status === 403) {
          // Check specifically for appNotAuthorizedToChild error
          if (errorReason === "appNotAuthorizedToChild") {
            return new Response(
              JSON.stringify({ 
                error: "Cannot delete: folder contains files not created by this app. Delete these files manually in Google Drive first, or use 'Force Delete' to remove only from the app.", 
                errorReason: "appNotAuthorizedToChild",
                needsReauth: false 
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          return new Response(
            JSON.stringify({ 
              error: "Google authentication expired", 
              needsReauth: true,
              errorReason,
              details: errorText 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (response.status === 404) {
          console.log("File not found, treating as already deleted");
          return new Response(
            JSON.stringify({ success: true, alreadyDeleted: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to trash file", errorReason, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log successful trash
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'trash_file',
        entity_type: 'drive_file',
        entity_id: body.fileId,
        project_id: projectId,
        metadata: {},
        success: true,
      });

      console.log("File/folder trashed successfully");
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Edge function error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
