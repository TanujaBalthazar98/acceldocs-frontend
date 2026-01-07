import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  projectId?: string;
  userId?: string;
  syncId?: string;
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

    // Get pending sync items
    let query = supabase
      .from('drive_permission_sync')
      .select(`
        *,
        project:projects!drive_permission_sync_project_id_fkey(
          id,
          drive_folder_id,
          organization_id
        )
      `)
      .in('sync_status', ['pending', 'pending_removal'])
      .order('created_at', { ascending: true })
      .limit(50);

    if (body.syncId) {
      query = query.eq('id', body.syncId);
    } else if (body.projectId) {
      query = query.eq('project_id', body.projectId);
    }

    const { data: pendingItems, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching pending syncs:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch pending syncs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending syncs", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${pendingItems.length} pending syncs`);

    // Group by project to minimize token refreshes
    const projectGroups = new Map<string, any[]>();
    for (const item of pendingItems) {
      const projectId = item.project_id;
      if (!projectGroups.has(projectId)) {
        projectGroups.set(projectId, []);
      }
      projectGroups.get(projectId)!.push(item);
    }

    let successCount = 0;
    let failCount = 0;
    const results: any[] = [];

    for (const [projectId, items] of projectGroups) {
      // Verify caller has permission to sync this project
      const { data: canManage } = await supabase.rpc('can_manage_project_members', {
        _project_id: projectId,
        _user_id: user.id,
      });

      if (!canManage) {
        console.log(`User ${user.id} cannot manage project ${projectId}, skipping`);
        continue;
      }

      // Get access token for this project's org owner
      const accessToken = await getOrgOwnerToken(supabase, projectId);
      if (!accessToken) {
        console.error(`No access token available for project ${projectId}`);
        for (const item of items) {
          await supabase
            .from('drive_permission_sync')
            .update({
              sync_status: 'failed',
              error_message: 'No valid Google access token available. Org owner must reconnect Google Drive.',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          failCount++;
        }
        continue;
      }

      // Process each sync item
      for (const item of items) {
        const driveFileId = item.drive_file_id;
        
        if (item.sync_status === 'pending_removal') {
          // Remove permission
          if (item.drive_permission_id) {
            const { success, error } = await removeDrivePermission(
              accessToken,
              driveFileId,
              item.drive_permission_id
            );

            if (success) {
              await supabase
                .from('drive_permission_sync')
                .delete()
                .eq('id', item.id);
              successCount++;
              results.push({ id: item.id, status: 'removed' });
            } else {
              await supabase
                .from('drive_permission_sync')
                .update({
                  sync_status: 'failed',
                  error_message: error,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', item.id);
              failCount++;
              results.push({ id: item.id, status: 'failed', error });
            }
          } else {
            // No permission ID, just delete the record
            await supabase
              .from('drive_permission_sync')
              .delete()
              .eq('id', item.id);
            successCount++;
          }
        } else {
          // Create or update permission
          const userEmail = await getUserEmail(supabase, item.user_id);
          if (!userEmail) {
            await supabase
              .from('drive_permission_sync')
              .update({
                sync_status: 'failed',
                error_message: 'User email not found',
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);
            failCount++;
            continue;
          }

          const { permissionId, error } = await syncDrivePermission(
            accessToken,
            driveFileId,
            userEmail,
            item.role,
            item.drive_permission_id || undefined
          );

          if (permissionId) {
            await supabase
              .from('drive_permission_sync')
              .update({
                sync_status: 'synced',
                drive_permission_id: permissionId !== 'existing' ? permissionId : item.drive_permission_id,
                last_synced_at: new Date().toISOString(),
                error_message: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);
            successCount++;
            results.push({ id: item.id, status: 'synced', permissionId });

            // Log successful sync
            await supabase.from('audit_logs').insert({
              user_id: user.id,
              action: 'sync_drive_permission',
              entity_type: 'project_member',
              entity_id: item.project_member_id,
              project_id: projectId,
              metadata: { targetUserId: item.user_id, role: item.role, driveRole: getDriveRoleForAppRole(item.role) },
              success: true,
            });
          } else {
            await supabase
              .from('drive_permission_sync')
              .update({
                sync_status: 'failed',
                error_message: error,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);
            failCount++;
            results.push({ id: item.id, status: 'failed', error });
          }
        }
      }
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
