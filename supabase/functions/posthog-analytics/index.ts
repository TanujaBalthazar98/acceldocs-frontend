import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const POSTHOG_API_KEY = Deno.env.get("POSTHOG_API_KEY");
const POSTHOG_PROJECT_ID = Deno.env.get("POSTHOG_PROJECT_ID");
const POSTHOG_HOST = Deno.env.get("POSTHOG_HOST") || "https://app.posthog.com";
const DOC_VIEW_EVENT = "docs_page_viewed";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const uuidRegex = /^[0-9a-fA-F-]{36}$/;

const fetchPosthog = async (query: string) => {
  const response = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${POSTHOG_API_KEY}`,
    },
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query,
      },
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.detail || "PostHog query failed");
  }
  return json?.results || [];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "posthog_not_configured",
          message: "PostHog is not configured. Add POSTHOG_API_KEY and POSTHOG_PROJECT_ID.",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "missing_auth", message: "Missing authorization header." } }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "invalid_session", message: "Invalid session." } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const projectId = body?.projectId as string | undefined;
    const documentId = body?.documentId as string | undefined;

    if (!projectId || !uuidRegex.test(projectId)) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "invalid_project", message: "Invalid projectId." } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (documentId && !uuidRegex.test(documentId)) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "invalid_document", message: "Invalid documentId." } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: allowed, error: permError } = await supabase.rpc("check_project_permission", {
      _project_id: projectId,
      _user_id: user.id,
      _action: "view",
    });

    if (permError || !allowed) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "forbidden", message: "Not authorized." } }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseFilter = `event = '${DOC_VIEW_EVENT}' and timestamp >= now() - INTERVAL 30 DAY`;
    const projectFilter = `${baseFilter} and properties.project_id = '${projectId}'`;
    const pageFilter = documentId ? `${projectFilter} and properties.document_id = '${documentId}'` : null;

    const [[projectViews = 0, projectUnique = 0] = []] = await fetchPosthog(
      `select count() as views, uniq(distinct_id) as unique_visitors from events where ${projectFilter}`
    );

    const topPagesResults = await fetchPosthog(
      `select properties.document_id as document_id, any(properties.document_title) as title, count() as views
       from events
       where ${projectFilter}
       group by document_id
       order by views desc
       limit 10`
    );

    const topCountriesResults = await fetchPosthog(
      `select properties.$geoip_country_name as country, count() as views
       from events
       where ${projectFilter}
       group by country
       order by views desc
       limit 10`
    );

    const projectSummary = {
      views: Number(projectViews || 0),
      unique_visitors: Number(projectUnique || 0),
      top_pages: topPagesResults.map((row: any[]) => ({
        document_id: row[0],
        title: row[1] || "Untitled",
        views: Number(row[2] || 0),
      })),
      top_countries: topCountriesResults.map((row: any[]) => ({
        country: row[0] || "Unknown",
        views: Number(row[1] || 0),
      })),
    };

    let pageSummary = null;
    if (pageFilter) {
      const [[pageViews = 0, pageUnique = 0] = []] = await fetchPosthog(
        `select count() as views, uniq(distinct_id) as unique_visitors from events where ${pageFilter}`
      );

      const topReferrersResults = await fetchPosthog(
        `select coalesce(properties.$referrer_domain, properties.$referrer, 'Direct') as referrer, count() as views
         from events
         where ${pageFilter}
         group by referrer
         order by views desc
         limit 8`
      );

      pageSummary = {
        views: Number(pageViews || 0),
        unique_visitors: Number(pageUnique || 0),
        top_referrers: topReferrersResults.map((row: any[]) => ({
          referrer: row[0] || "Direct",
          views: Number(row[1] || 0),
        })),
      };
    }

    return new Response(
      JSON.stringify({ ok: true, project: projectSummary, page: pageSummary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("PostHog analytics error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: { code: "analytics_error", message: error?.message || "Unexpected error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
