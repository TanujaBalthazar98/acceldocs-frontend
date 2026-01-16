import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-1.5-pro";

type ImportSampleFile = {
  path: string;
  title?: string;
  heading?: string;
  snippet?: string;
};

type AnalyzeRequest = {
  projectName?: string;
  files: ImportSampleFile[];
  totalFiles: number;
  topLevelFolders: { name: string; count: number }[];
  commonRoot?: string | null;
};

type PlanGroup = {
  type: "subproject" | "topic";
  name: string;
  prefixes: string[];
  order?: string[];
};

type StructurePlan = {
  version: number;
  groups: PlanGroup[];
  notes?: string[];
};

function normalizePrefix(prefix: string): string {
  return prefix
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("No JSON object found in response");
}

function sanitizePlan(plan: unknown): StructurePlan {
  const raw = (plan ?? {}) as Partial<StructurePlan>;
  const rawGroups = Array.isArray(raw.groups) ? raw.groups : [];
  const groups: PlanGroup[] = [];

  for (const group of rawGroups) {
    if (!group || typeof group !== "object") continue;
    const record = group as Partial<PlanGroup>;
    const type = record.type === "subproject" ? "subproject" : "topic";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const prefixes = Array.isArray(record.prefixes)
      ? record.prefixes
          .filter((p) => typeof p === "string")
          .map((p) => normalizePrefix(p))
          .filter((p) => p.length > 0)
      : [];

    if (prefixes.length === 0) continue;

    const order = Array.isArray(record.order)
      ? record.order.filter((o) => typeof o === "string")
      : undefined;

    groups.push({ type, name, prefixes, order });
  }

  const hasFallback = groups.some((group) => group.prefixes.includes(""));
  if (!hasFallback) {
    groups.push({
      type: "topic",
      name: "Project Root",
      prefixes: [""],
    });
  }

  const notes = Array.isArray(raw.notes)
    ? raw.notes.filter((note) => typeof note === "string").slice(0, 8)
    : undefined;

  return { version: 1, groups, notes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as AnalyzeRequest;
    if (!body || !Array.isArray(body.files) || body.files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured. Set GEMINI_API_KEY." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert information architect. Propose a structure plan for importing documentation into a CMS.

Return ONLY valid JSON using this schema:
{
  "version": 1,
  "groups": [
    {
      "type": "subproject" | "topic",
      "name": "string",
      "prefixes": ["string"],
      "order": ["string"]
    }
  ],
  "notes": ["string"]
}

Rules:
- Use prefixes that appear in the provided file paths (forward slashes, no leading slash).
- Prefer grouping by top-level folders, but you may merge or split if titles indicate it.
- Keep groups <= 12.
- ALWAYS include a fallback group with type "topic", name "Project Root", prefixes [""] for unmatched files.
- If commonRoot is provided, you may treat it as a container and use prefixes that start with it.
- "order" is optional and should list relative file paths (without extensions) in the preferred order.
`;

    const userPrompt = {
      projectName: body.projectName ?? "",
      totalFiles: body.totalFiles,
      commonRoot: body.commonRoot ?? null,
      topLevelFolders: body.topLevelFolders,
      sampleFiles: body.files,
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(userPrompt) }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let plan: StructurePlan;

    try {
      const parsed = extractJson(content);
      plan = sanitizePlan(parsed);
    } catch (error) {
      console.error("Failed to parse AI plan:", error);
      plan = sanitizePlan(null);
    }

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("analyze-import-structure error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
