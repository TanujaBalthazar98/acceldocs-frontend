import { verifyAddonToken } from "../_lib/addonToken.js";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const send = (res: any, status: number, body: unknown) => {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.status(status).json(body);
};

const getGeminiApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  return apiKey;
};

const buildInstruction = (action: string, instruction: string, title?: string) => {
  const base = instruction ? `Instruction: ${instruction}` : "";
  const docTitle = title ? `Document title: ${title}` : "";
  const actionMap: Record<string, string> = {
    improve: "Improve clarity and flow while keeping meaning intact.",
    rewrite: "Rewrite for clarity and concision while preserving meaning.",
    summarize: "Summarize to the key points.",
    expand: "Expand with helpful details and examples.",
    bullet: "Convert into a clear bullet list.",
    grammar: "Fix grammar, spelling, and punctuation.",
    translate: "Translate to the requested language.",
    custom: "Follow the custom instruction.",
  };
  const actionInstruction = actionMap[action] || actionMap.improve;
  return [actionInstruction, base, docTitle].filter(Boolean).join("\n");
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") {
      Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
      res.status(204).end();
      return;
    }

    if (req.method !== "POST") {
      send(res, 405, { error: "Method not allowed" });
      return;
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      send(res, 401, { error: "Missing add-on token" });
      return;
    }

    try {
      verifyAddonToken(token);
    } catch (error: any) {
      send(res, 401, { error: error?.message || "Invalid token" });
      return;
    }

    const body = req.body || {};
    const action = String(body.action || "improve");
    const instruction = String(body.instruction || "");
    const content = String(body.content || "");
    const title = String(body.title || "");

    if (!content.trim()) {
      send(res, 400, { error: "No content provided" });
      return;
    }

    const prompt = buildInstruction(action, instruction, title);
    const apiKey = getGeminiApiKey();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `You are a writing assistant. ${prompt}\n\n` +
                    "Return only the updated text. Do not wrap in code fences.\n\n" +
                    "CONTENT:\n" +
                    content,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini write assist error:", response.status, errorText);
      send(res, response.status === 429 ? 429 : 500, {
        error: response.status === 429 ? "Rate limit exceeded. Try again." : "AI service unavailable",
      });
      return;
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const output = parts.map((part: { text?: string }) => part?.text || "").join("").trim();

    send(res, 200, { output });
  } catch (err: any) {
    console.error("addon/write-assist error", err);
    send(res, 500, { error: err?.message || "Server error" });
  }
}
