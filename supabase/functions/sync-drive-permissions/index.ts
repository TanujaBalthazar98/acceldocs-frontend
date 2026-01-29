import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  projectId?: string;
  userId?: string;
  syncId?: string;
  direction?: "push" | "pull";
  enforceNoDownload?: boolean;
}

// Map application roles to Google Drive permission roles
function getDriveRoleForAppRole(role: string): string {
  switch (role) {
    case 'admin':
    case 'editor':
      return 'writer';
    case 'reviewer':
      return 'commenter';
    case 'viewer':
    default:
      return 'reader';
  }
}

// Map Drive permission roles to project roles
function getProjectRoleForDriveRole(role: string): string {
  switch (role) {
    case 'owner':
    case 'organizer':
    case 'fileOrganizer':
      return 'admin';
    case 'writer':
      return 'editor';
    case 'commenter':
      return 'reviewer';
    case 'reader':
    default:
      return 'viewer';
  }
}

// Get user email from profile
async function getUserEmail(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();
  
  return profile?.email || null;
}

// Refresh Google token using stored refresh token
async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  
  if (!clientId || !clientSecret) {
    console.error("Missing Google OAuth credentials");
    return null;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

// Get access token for an org owner to manage Drive permissions
async function getOrgOwnerToken(supabase: any, projectId: string): Promise<string | null> {
  // Get the org owner for this project
  const { data: project } = await supabase
    .from('projects')
    .select(`
      organization_id,
      organizations!projects_organization_id_fkey(owner_id)
    `)
    .eq('id', projectId)
    .single();

  if (!project?.organizations?.owner_id) {
    console.error("Could not find org owner for project");
    return null;
  }

  const ownerId = project.organizations.owner_id;

  // Get the owner's refresh token
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_refresh_token')
    .eq('id', ownerId)
    .single();

  if (!profile?.google_refresh_token) {
    console.error("Org owner has no refresh token");
    return null;
  }

  return await refreshGoogleToken(profile.google_refresh_token);
}

async function listDrivePermissions(accessToken: string, fileId: string): Promise<any[]> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true&fields=permissions(id,emailAddress,role,type,deleted)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list permissions: ${errorText}`);
  }

  const data = await response.json();
  return data?.permissions || [];
}

async function setNoDownloadRestriction(
  accessToken: string,
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          copyRequiresWriterPermission: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function enforceNoDownloadForProject(
  supabase: any,
  accessToken: string,
  projectId: string,
  driveFolderId: string
) {
  // Apply restriction to the project folder
  await setNoDownloadRestriction(accessToken, driveFolderId);

  // Apply restriction to all Google Docs tracked in the project
  const { data: docs } = await supabase
    .from("documents")
    .select("google_doc_id")
    .eq("project_id", projectId);

  if (!docs) return;

  for (const doc of docs) {
    if (!doc?.google_doc_id) continue;
    await setNoDownloadRestriction(accessToken, doc.google_doc_id);
  }
}

// Create or update a Drive permission
async function syncDrivePermission(
  accessToken: string,
  fileId: string,
  userEmail: string,
  role: string,
  existingPermissionId?: string
): Promise<{ permissionId: string | null; error: string | null }> {
  const driveRole = getDriveRoleForAppRole(role);

  try {
    if (existingPermissionId) {
      // Update existing permission
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${existingPermissionId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: driveRole }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to update permission:", errorText);
        return { permissionId: null, error: `Update failed: ${errorText}` };
      }

      return { permissionId: existingPermissionId, error: null };
    } else {
      // Create new permission
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=false`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "user",
            role: driveRole,
            emailAddress: userEmail,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        // Check if permission already exists
        if (errorText.includes("Permission already exists")) {
          console.log("Permission already exists, treating as success");
          return { permissionId: "existing", error: null };
        }
        console.error("Failed to create permission:", errorText);
        return { permissionId: null, error: `Create failed: ${errorText}` };
      }

      const data = await response.json();
      return { permissionId: data.id, error: null };
    }
  } catch (error) {
    console.error("Drive API error:", error);
    return { permissionId: null, error: String(error) };
  }
}

// Remove a Drive permission
async function removeDrivePermission(
  accessToken: string,
  fileId: string,
  permissionId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${permissionId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      console.error("Failed to remove permission:", errorText);
      return { success: false, error: errorText };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("Error removing permission:", error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SyncRequest = await req.json();
    console.log("Sync request:", body);

    const { projectId, direction = "push", enforceNoDownload = true } = body;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "projectId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller has permission to sync this project
    const { data: canManage } = await supabase.rpc('can_manage_project_members', {
      _project_id: projectId,
      _user_id: user.id,
    });

    if (!canManage) {
      console.log(`User ${user.id} cannot manage project ${projectId}`);
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get project with org and drive folder info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        drive_folder_id,
        organization_id,
        organizations!projects_organization_id_fkey(owner_id)
      `)
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!project.drive_folder_id) {
      console.log("Project has no drive folder, skipping sync");
      return new Response(
        JSON.stringify({ message: "Project has no Drive folder", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = project.organization_id;
    const driveFileId = project.drive_folder_id;

    // Get access token for org owner
    const accessToken = await getOrgOwnerToken(supabase, projectId);
    if (!accessToken) {
      console.error("No access token available for project");
      return new Response(
        JSON.stringify({ error: "No valid Google access token. Org owner must reconnect Google Drive." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (direction === "pull") {
      const permissions = await listDrivePermissions(accessToken, driveFileId);
      const userPerms = permissions.filter((p) => p?.type === "user" && p?.emailAddress && !p?.deleted);

      const emails = userPerms.map((p) => p.emailAddress);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,email")
        .in("email", emails);

      const emailToUserId = new Map<string, string>();
      for (const profile of profiles || []) {
        if (profile.email) {
          emailToUserId.set(profile.email, profile.id);
        }
      }

      const membersToUpsert = userPerms
        .map((perm) => {
          const userId = emailToUserId.get(perm.emailAddress);
          if (!userId) return null;
          return {
            project_id: projectId,
            user_id: userId,
            role: getProjectRoleForDriveRole(perm.role),
          };
        })
        .filter(Boolean);

      if (membersToUpsert.length > 0) {
        await supabase.from("project_members").upsert(membersToUpsert, {
          onConflict: "project_id,user_id",
        });
      }

      if (enforceNoDownload) {
        await enforceNoDownloadForProject(supabase, accessToken, projectId, driveFileId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          synced: membersToUpsert.length,
          direction: "pull",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Push mode (default): sync Docspeare roles to Drive
    // Collect all users who need Drive access for this project
    // This includes: org-level admins/editors/viewers from user_roles + explicit project_members
    const usersToSync: Array<{ userId: string; email: string; role: string; source: string }> = [];

    // 1. Get org-level role users (user_roles table)
    const { data: orgRoleUsers, error: orgRoleError } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        role,
        profiles!user_roles_user_id_fkey(email)
      `)
      .eq('organization_id', orgId);

    if (!orgRoleError && orgRoleUsers) {
      for (const ur of orgRoleUsers) {
        const email = (ur.profiles as any)?.email;
        if (email) {
          // Map app_role to project_role equivalent
          let mappedRole = 'viewer';
          if (ur.role === 'owner' || ur.role === 'admin') {
            mappedRole = 'admin';
          } else if (ur.role === 'editor') {
            mappedRole = 'editor';
          }
          usersToSync.push({
            userId: ur.user_id,
            email,
            role: mappedRole,
            source: 'user_roles',
          });
        }
      }
    }

    // 2. Get explicit project members
    const { data: projectMembers, error: pmError } = await supabase
      .from('project_members')
      .select(`
        user_id,
        role,
        profiles!project_members_user_id_fkey(email)
      `)
      .eq('project_id', projectId);

    if (!pmError && projectMembers) {
      for (const pm of projectMembers) {
        const email = (pm.profiles as any)?.email;
        if (email) {
          // Check if user already added from org roles - project role takes precedence
          const existingIdx = usersToSync.findIndex(u => u.userId === pm.user_id);
          if (existingIdx >= 0) {
            // Replace with project-level role (more specific)
            usersToSync[existingIdx] = {
              userId: pm.user_id,
              email,
              role: pm.role,
              source: 'project_members',
            };
          } else {
            usersToSync.push({
              userId: pm.user_id,
              email,
              role: pm.role,
              source: 'project_members',
            });
          }
        }
      }
    }

    console.log(`Syncing ${usersToSync.length} users for project ${projectId}`);

    let successCount = 0;
    let failCount = 0;
    const results: any[] = [];

    for (const userSync of usersToSync) {
      const { permissionId, error } = await syncDrivePermission(
        accessToken,
        driveFileId,
        userSync.email,
        userSync.role
      );

      if (permissionId) {
        successCount++;
        results.push({ 
          email: userSync.email, 
          role: userSync.role, 
          driveRole: getDriveRoleForAppRole(userSync.role),
          status: 'synced' 
        });

        // Log successful sync
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'sync_drive_permission',
          entity_type: 'user',
          entity_id: userSync.userId,
          project_id: projectId,
          metadata: { 
            targetEmail: userSync.email, 
            role: userSync.role, 
            driveRole: getDriveRoleForAppRole(userSync.role),
            source: userSync.source
          },
          success: true,
        });
      } else {
        failCount++;
        results.push({ 
          email: userSync.email, 
          role: userSync.role, 
          status: 'failed', 
          error 
        });
      }
    }

    if (enforceNoDownload) {
      await enforceNoDownloadForProject(supabase, accessToken, projectId, driveFileId);
    }

    console.log(`Sync complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
