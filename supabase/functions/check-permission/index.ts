import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckPermissionRequest {
  action: string;
  projectId: string;
  entityType?: string;
  entityId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header", allowed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid session", allowed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CheckPermissionRequest = await req.json();
    const { action, projectId, entityType, entityId } = body;

    // Check permission using the database function
    const { data: allowed, error: permError } = await supabase.rpc('check_project_permission', {
      _project_id: projectId,
      _user_id: user.id,
      _action: action,
    });

    if (permError) {
      console.error("Permission check error:", permError);
      return new Response(
        JSON.stringify({ error: "Permission check failed", allowed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the permission check attempt if denied
    if (!allowed) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: `unauthorized_${action}`,
        entity_type: entityType || 'unknown',
        entity_id: entityId || null,
        project_id: projectId,
        metadata: { attempted_action: action },
        success: false,
        error_message: `Permission denied for action: ${action}`,
      });
    }

    // Get user's role for additional context
    const { data: role } = await supabase.rpc('get_project_role', {
      _project_id: projectId,
      _user_id: user.id,
    });

    return new Response(
      JSON.stringify({ 
        allowed: !!allowed,
        role,
        action,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", allowed: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
