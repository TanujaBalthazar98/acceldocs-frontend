import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Must be a verified sender on Resend, e.g. "DocLayer <no-reply@acceldata.io>"
const RESEND_FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") || "DocLayer <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  email: string;
  organizationName: string;
  role: string;
  inviterName: string;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "missing_resend_api_key",
            message:
              "Email service is not configured. Please add RESEND_API_KEY.",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const {
      email,
      organizationName,
      role,
      inviterName,
      token,
    }: InvitationEmailRequest = await req.json();

    const origin = req.headers.get("origin");
    const appUrl = Deno.env.get("APP_URL") || origin || "";
    const inviteLink = appUrl ? `${appUrl}/auth?invite=${token}` : "";

    const roleDescriptions: Record<string, string> = {
      viewer: "view all projects and documentation",
      editor: "view and edit projects and documentation",
      admin: "manage settings, members, and all content",
    };

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: `You're invited to join ${organizationName} on DocLayer`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
              <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #18181b; font-size: 24px; font-weight: 600; margin: 0 0 8px 0;">
                    You're invited! 🎉
                  </h1>
                  <p style="color: #71717a; font-size: 16px; margin: 0;">
                    ${inviterName} has invited you to join <strong>${organizationName}</strong>
                  </p>
                </div>

                <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                  <p style="color: #3f3f46; font-size: 14px; margin: 0;">
                    <strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}<br>
                    <span style="color: #71717a;">You'll be able to ${roleDescriptions[role] || "access the workspace"}.</span>
                  </p>
                </div>

                <div style="text-align: center;">
                  <a href="${inviteLink}" style="display: inline-block; background-color: #18181b; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 500; font-size: 16px;">
                    Accept Invitation
                  </a>
                </div>

                <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 32px;">
                  This invitation will expire in 7 days.<br>
                  If you didn't expect this email, you can safely ignore it.
                </p>
              </div>
            </body>
          </html>
        `,
      }),
    });

    const resultText = await emailResponse.text();
    let resultJson: any = null;
    try {
      resultJson = JSON.parse(resultText);
    } catch {
      resultJson = { raw: resultText };
    }

    if (!emailResponse.ok) {
      console.log("Invitation email failed:", {
        status: emailResponse.status,
        body: resultJson,
      });

      // Return 200 so the client can show a helpful message (instead of a generic invoke error)
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: resultJson?.name || "email_send_failed",
            message:
              resultJson?.message ||
              `Email sending failed with status ${emailResponse.status}.`,
            status: emailResponse.status,
            hint:
              "If you see a testing restriction, verify a sending domain and set RESEND_FROM_EMAIL to an address on that domain.",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Invitation email sent:", resultJson);

    return new Response(JSON.stringify({ ok: true, data: resultJson }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invitation email:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "unexpected_error",
          message: error?.message || "Unexpected error",
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
