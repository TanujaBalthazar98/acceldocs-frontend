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

type RequestBody = CreateFolderRequest | CreateDocRequest | ListFolderRequest | GetDocContentRequest;

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

    const body: RequestBody = await req.json();
    console.log("Request body:", JSON.stringify(body));

    // Get the provider token from header
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

    // List folder contents
    if (body.action === "list_folder") {
      console.log("Listing folder:", body.folderId);
      
      const query = encodeURIComponent(`'${body.folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,createdTime)");
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name`,
        {
          headers: {
            Authorization: `Bearer ${providerToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Drive API error:", errorText);
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
      console.log("Getting doc content:", body.docId);
      
      const response = await fetch(
        `https://docs.googleapis.com/v1/documents/${body.docId}`,
        {
          headers: {
            Authorization: `Bearer ${providerToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Docs API error:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to get document", details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const doc = await response.json();
      console.log("Document retrieved:", doc.title);

      return new Response(
        JSON.stringify({ success: true, doc }),
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
