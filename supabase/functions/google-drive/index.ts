import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

type RequestBody = CreateFolderRequest | CreateDocRequest;

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
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      console.error("User authentication failed:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user's Google provider token from their identities
    const googleIdentity = user.identities?.find(i => i.provider === "google");
    if (!googleIdentity) {
      console.error("No Google identity found for user:", user.id);
      return new Response(
        JSON.stringify({ error: "No Google account linked" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get fresh session to access provider token
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.getUserById(user.id);
    
    // The provider_token is only available during the auth callback
    // We need to get it from the session passed by the client
    const body: RequestBody = await req.json();
    console.log("Request body:", JSON.stringify(body));

    // For now, we'll need the client to pass the provider token
    // This is a limitation - we need to store the token during OAuth callback
    const providerToken = req.headers.get("x-google-token");
    
    if (!providerToken) {
      console.error("No Google provider token available");
      return new Response(
        JSON.stringify({ 
          error: "Google access token not available. Please re-authenticate with Google.",
          needsReauth: true 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(folderMetadata),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);
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
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(docMetadata),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);
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
