import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") || "Docspeare <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface JoinRequestEmailRequest {
  adminEmails: string[];
  requesterName: string;
  requesterEmail: string;
  organizationName: string;
}

const handler = async (req: Request): Promise<Response> => {
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
            message: "Email service is not configured. Please add RESEND_API_KEY.",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const {
      adminEmails,
      requesterName,
      requesterEmail,
      organizationName,
    }: JoinRequestEmailRequest = await req.json();

    if (!adminEmails || adminEmails.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "no_admin_emails",
            message: "No admin emails provided.",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const origin = req.headers.get("origin");
    const appUrl = Deno.env.get("APP_URL") || origin || "";
    const dashboardLink = appUrl ? `${appUrl}/dashboard` : "";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: adminEmails,
        subject: `New join request for ${organizationName}`,
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
                    New Join Request 👋
                  </h1>
                  <p style="color: #71717a; font-size: 16px; margin: 0;">
                    Someone wants to join your workspace
                  </p>
                </div>

                <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                  <p style="color: #3f3f46; font-size: 14px; margin: 0 0 8px 0;">
                    <strong>Name:</strong> ${requesterName || "Not provided"}
                  </p>
                  <p style="color: #3f3f46; font-size: 14px; margin: 0 0 8px 0;">
                    <strong>Email:</strong> ${requesterEmail}
                  </p>
                  <p style="color: #3f3f46; font-size: 14px; margin: 0;">
                    <strong>Workspace:</strong> ${organizationName}
                  </p>
                </div>

                <div style="text-align: center;">
                  <a href="${dashboardLink}" style="display: inline-block; background-color: #18181b; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 500; font-size: 16px;">
                    Review Request
                  </a>
                </div>

                <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 32px;">
                  Go to Settings → General → Join Requests to approve or reject this request.
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
      console.log("Join request email failed:", {
        status: emailResponse.status,
        body: resultJson,
      });

      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: resultJson?.name || "email_send_failed",
            message:
              resultJson?.message ||
              `Email sending failed with status ${emailResponse.status}.`,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Join request email sent:", resultJson);

    return new Response(JSON.stringify({ ok: true, data: resultJson }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending join request email:", error);
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
