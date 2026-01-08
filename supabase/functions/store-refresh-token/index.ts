import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.log("User session not valid, skipping token storage:", userError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          skipped: true,
          reason: "session_invalid",
          message: "Session not valid, please re-authenticate if needed" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the refresh token from the request body
    let refreshToken: string | null = null;
    try {
      const body = await req.json();
      refreshToken = body.refreshToken;
    } catch {
      // No body or invalid JSON - try to extract from identity data (fallback)
    }

    console.log("Processing refresh token for user:", user.id);

    if (refreshToken) {
      // Store the provided refresh token directly
      console.log("Storing provided refresh token...");
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          google_refresh_token: refreshToken,
          google_token_refreshed_at: new Date().toISOString()
        } as Record<string, unknown>)
        .eq("id", user.id);

      if (updateError) {
        console.error("Failed to store refresh token:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to store refresh token", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Refresh token stored successfully");
      return new Response(
        JSON.stringify({ success: true, message: "Refresh token stored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: Try to get from identity data (unlikely to have it, but worth trying)
    console.log("No refresh token in body, attempting to retrieve from identity data...");
    
    const { data: userData, error: adminError } = await supabase.auth.admin.getUserById(user.id);
    
    if (adminError) {
      console.error("Admin API error:", adminError);
      return new Response(
        JSON.stringify({ 
          error: "No refresh token provided and could not retrieve from identity", 
          needsReauth: true,
          message: "Please reconnect Google Drive to grant offline access"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const googleIdentity = userData.user?.identities?.find(i => i.provider === "google");
    
    if (!googleIdentity) {
      console.log("No Google identity found");
      return new Response(
        JSON.stringify({ error: "No Google identity found for user", needsReauth: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const identityRefreshToken = (googleIdentity.identity_data as Record<string, unknown>)?.refresh_token as string | undefined;
    
    if (!identityRefreshToken) {
      console.log("No refresh token in identity data - keys:", Object.keys(googleIdentity.identity_data || {}));
      return new Response(
        JSON.stringify({ 
          error: "No refresh token available", 
          message: "Please reconnect Google Drive to grant offline access",
          needsReauth: true 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store the refresh token
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ 
        google_refresh_token: identityRefreshToken,
        google_token_refreshed_at: new Date().toISOString()
      } as Record<string, unknown>)
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to store refresh token:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to store refresh token", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Refresh token stored successfully from identity");
    return new Response(
      JSON.stringify({ success: true, message: "Refresh token stored from identity" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
