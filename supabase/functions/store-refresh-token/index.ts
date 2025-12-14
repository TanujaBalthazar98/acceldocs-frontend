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
      console.error("User authentication failed:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Looking up provider refresh token for user:", user.id);

    // Query the auth.identities table to get the provider refresh token
    // This requires service role key
    const { data: identities, error: identitiesError } = await supabase
      .from("identities")
      .select("provider, identity_data")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .single();

    // If we can't query identities directly, try the auth admin API
    if (identitiesError) {
      console.log("Could not query identities table, trying admin API");
      
      // Use the admin API to get user details including identities
      const { data: userData, error: adminError } = await supabase.auth.admin.getUserById(user.id);
      
      if (adminError) {
        console.error("Admin API error:", adminError);
        return new Response(
          JSON.stringify({ error: "Could not retrieve user identities", details: adminError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find Google identity
      const googleIdentity = userData.user?.identities?.find(i => i.provider === "google");
      
      if (!googleIdentity) {
        console.log("No Google identity found");
        return new Response(
          JSON.stringify({ error: "No Google identity found for user" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // The refresh token might be in identity_data
      const refreshToken = (googleIdentity.identity_data as Record<string, unknown>)?.refresh_token as string | undefined;
      
      if (!refreshToken) {
        console.log("No refresh token in Google identity data");
        console.log("Identity data keys:", Object.keys(googleIdentity.identity_data || {}));
        return new Response(
          JSON.stringify({ 
            error: "No refresh token available", 
            message: "Please sign in again with Google to grant offline access",
            needsReauth: true 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store the refresh token in the profiles table
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

    console.log("Found identity data");
    return new Response(
      JSON.stringify({ success: true, hasIdentity: true }),
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
