import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, organizationName, role, inviterName, token }: InvitationEmailRequest =
      await req.json();

    const appUrl = Deno.env.get("APP_URL") || "https://your-app-url.com";
    const inviteLink = `${appUrl}/auth?invite=${token}`;

    const roleDescriptions: Record<string, string> = {
      viewer: "view all projects and documentation",
      editor: "view and edit projects and documentation",
      admin: "manage settings, members, and all content",
    };

    // Use Resend API directly via fetch
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "DocLayer <onboarding@resend.dev>",
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

    const result = await emailResponse.json();
    console.log("Invitation email sent:", result);

    return new Response(JSON.stringify(result), {
      status: emailResponse.ok ? 200 : 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invitation email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
