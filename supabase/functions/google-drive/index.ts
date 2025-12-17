import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-google-token",
};

interface CreateFolderRequest {
  action: "create_folder";
  name: string;
  parentFolderId: string;
}

interface CreateDocRequest {
  action: "create_doc";
  title: string;
  parentFolderId: string;
}

interface ListFolderRequest {
  action: "list_folder";
  folderId: string;
}

interface GetDocContentRequest {
  action: "get_doc_content";
  docId: string;
}

interface SyncDocContentRequest {
  action: "sync_doc_content";
  documentId: string;  // Our database document ID
  googleDocId: string;
}

interface TrashFileRequest {
  action: "trash_file";
  fileId: string;
}

type RequestBody = CreateFolderRequest | CreateDocRequest | ListFolderRequest | GetDocContentRequest | SyncDocContentRequest | TrashFileRequest;

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

// Get valid access token - either from header or by refreshing
// Get access token - use provided token directly, only refresh if we have a stored refresh token
async function getValidAccessToken(
  providerToken: string | null,
  userId: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ token: string | null; needsReauth: boolean }> {
  // If we have a provider token, just use it directly
  // Don't pre-validate - let the actual API call fail if the token is bad
  if (providerToken) {
    console.log("Using provided access token");
    return { token: providerToken, needsReauth: false };
  }

  console.log("No provider token provided, checking for stored refresh token");
  
  // No token provided - try to refresh using stored refresh token
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("google_refresh_token")
    .eq("id", userId)
    .single();

  const profileData = profile as { google_refresh_token: string | null } | null;

  if (profileError || !profileData?.google_refresh_token) {
    console.log("No refresh token available for user");
    return { token: null, needsReauth: true };
  }

  const refreshResult = await refreshGoogleToken(profileData.google_refresh_token);
  if (!refreshResult) {
    console.log("Token refresh failed");
    return { token: null, needsReauth: true };
  }

  // Update the last refresh timestamp
  await supabase
    .from("profiles")
    .update({ google_token_refreshed_at: new Date().toISOString() } as Record<string, unknown>)
    .eq("id", userId);

  return { token: refreshResult.accessToken, needsReauth: false };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to extract user's session
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header", needsReauth: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from the JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      // Return 200 with needsReauth flag instead of 401 to prevent app crashes
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

    // Get the provider token from header
    const providerTokenFromHeader = req.headers.get("x-google-token");
    
    // Get valid access token (with automatic refresh if needed)
    const { token: googleToken, needsReauth } = await getValidAccessToken(
      providerTokenFromHeader,
      user.id,
      supabaseUrl,
      supabaseKey
    );

    if (!googleToken || needsReauth) {
      console.error("No valid Google token available");
      return new Response(
        JSON.stringify({ 
          error: "Google access token not available. Please re-authenticate with Google.",
          needsReauth: true 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List folder contents
    if (body.action === "list_folder") {
      console.log("Listing folder:", body.folderId);
      
      const query = encodeURIComponent(`'${body.folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,createdTime)");
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name`,
        {
          headers: {
            Authorization: `Bearer ${googleToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);
        
        // Check if it's a scope/permission error
        if (errorText.includes("SCOPE_INSUFFICIENT") || errorText.includes("insufficientPermissions")) {
          return new Response(
            JSON.stringify({ error: "Insufficient scopes", needsDriveAccess: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Check if it's an auth error - return 200 with needsReauth flag for client handling
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

    // Get document content using Drive API export (works with drive.file scope)
    if (body.action === "get_doc_content") {
      console.log("Getting doc content via Drive export:", body.docId);
      
      // Use Drive API to export as HTML - this works with drive.file scope
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${body.docId}/export?mimeType=text/html`,
        {
          headers: {
            Authorization: `Bearer ${googleToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive export error:", errorText);
        
        // Check if it's an auth error
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

    // Sync document content - fetches from Google and saves to database
    if (body.action === "sync_doc_content") {
      console.log("Syncing doc content:", body.googleDocId, "to document:", body.documentId);
      
      // First, get the file metadata to retrieve the modifiedTime
      const metadataResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${body.googleDocId}?fields=modifiedTime,name`,
        {
          headers: {
            Authorization: `Bearer ${googleToken}`,
          },
        }
      );

      let googleModifiedAt: string | null = null;
      if (metadataResponse.ok) {
        const metadata = await metadataResponse.json();
        googleModifiedAt = metadata.modifiedTime;
        console.log("Document modifiedTime:", googleModifiedAt);
      } else {
        console.warn("Failed to fetch file metadata, continuing without modifiedTime");
      }
      
      // Use Drive API to export as HTML
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${body.googleDocId}/export?mimeType=text/html`,
        {
          headers: {
            Authorization: `Bearer ${googleToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive export error:", errorText);
        
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
          JSON.stringify({ error: "Failed to get document", details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const htmlContent = await response.text();
      console.log("Document exported as HTML, length:", htmlContent.length);

      // Build update object - only include google_modified_at if we got it
      // When content changes, revert to draft (is_published = false)
      // The published_content_html remains unchanged, preserving the last published version
      const updateData: Record<string, unknown> = {
        content_html: htmlContent,
        last_synced_at: new Date().toISOString(),
        is_published: false  // Revert to draft when content is synced
      };
      if (googleModifiedAt) {
        updateData.google_modified_at = googleModifiedAt;
      }

      // Save to database - NOTE: Do NOT update is_published here!
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

      console.log("Content synced successfully with modifiedTime:", googleModifiedAt);
      return new Response(
        JSON.stringify({ success: true, html: htmlContent, modifiedAt: googleModifiedAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "create_folder") {
      console.log("Creating folder:", body.name, "in parent:", body.parentFolderId);
      
      const folderMetadata = {
        name: body.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [body.parentFolderId],
      };

      const response = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(folderMetadata),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);
        
        // Check if it's an auth error
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

      return new Response(
        JSON.stringify({ success: true, folder }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "create_doc") {
      console.log("Creating doc:", body.title, "in parent:", body.parentFolderId);
      
      const docMetadata = {
        name: body.title,
        mimeType: "application/vnd.google-apps.document",
        parents: [body.parentFolderId],
      };

      const response = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(docMetadata),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);
        
        // Check if it's an auth error
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

      return new Response(
        JSON.stringify({ success: true, doc }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trash a file or folder (move to Drive trash)
    if (body.action === "trash_file") {
      console.log("Trashing file/folder:", body.fileId);
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${body.fileId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trashed: true }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);
        
        // Check if it's an auth error
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
        
        // If file not found (already deleted), consider it successful
        if (response.status === 404) {
          console.log("File not found, treating as already deleted");
          return new Response(
            JSON.stringify({ success: true, alreadyDeleted: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to trash file", details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
