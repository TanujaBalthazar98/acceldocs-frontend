import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-goog-channel-token, x-goog-resource-id, x-goog-resource-state, x-goog-changed",
};

interface WebhookHeaders {
    channelToken: string | null;
    resourceState: string | null;
    resourceId: string | null;
    changed: string | null;
    channelId: string | null;
}

// ==========================================
// Helper Functions (Duplicated from google-drive)
// ==========================================

async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
        console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
        return null;
    }

    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Token refresh failed:", errorText);
            return null;
        }

        const data = await response.json();
        return {
            accessToken: data.access_token,
            expiresIn: data.expires_in,
        };
    } catch (error) {
        console.error("Error refreshing token:", error);
        return null;
    }
}

async function decryptOrgText(
    supabase: any,
    organizationId: string,
    ciphertext: string | null
): Promise<string | null> {
    if (!ciphertext) return null;
    const { data, error } = await supabase.rpc("decrypt_org_text", {
        org_id: organizationId,
        ciphertext,
    });
    if (error || !data) {
        console.error("Failed to decrypt org token:", error?.message);
        return null;
    }
    return data as string;
}

async function encryptOrgText(
    supabase: any,
    organizationId: string,
    plaintext: string | null
): Promise<string | null> {
    if (!plaintext) return null;
    const { data, error } = await supabase.rpc("encrypt_org_text", {
        org_id: organizationId,
        plaintext,
    });
    if (error || !data) {
        console.error("Failed to encrypt org content:", error?.message);
        return null;
    }
    return data as string;
}

async function getDriveTokenOwnerIdForProject(
    supabase: any,
    projectId: string
): Promise<string | null> {
    const { data: project } = await supabase
        .from("projects")
        .select("organization_id")
        .eq("id", projectId)
        .maybeSingle();

    if (!project?.organization_id) return null;

    const { data: org } = await supabase
        .from("organizations")
        .select("owner_id")
        .eq("id", project.organization_id)
        .maybeSingle();

    return (org?.owner_id as string | null) ?? null;
}

async function refreshUserAccessToken(supabase: any, userId: string): Promise<string | null> {
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id, google_refresh_token_encrypted, google_refresh_token")
        .eq("id", userId)
        .single();

    const orgId = (profile as { organization_id: string | null } | null)?.organization_id ?? null;
    const encryptedToken = (profile as { google_refresh_token_encrypted: string | null } | null)
        ?.google_refresh_token_encrypted ?? null;
    const legacyToken = (profile as { google_refresh_token: string | null } | null)
        ?.google_refresh_token ?? null;

    if (profileError || !orgId) {
        console.log("No organization available for user", userId);
        return null;
    }

    const refreshToken = encryptedToken
        ? await decryptOrgText(supabase, orgId, encryptedToken)
        : legacyToken;

    if (!refreshToken) {
        console.log("No refresh token available for user", userId);
        return null;
    }

    const refreshResult = await refreshGoogleToken(refreshToken);
    if (!refreshResult) {
        console.log("Token refresh failed for user", userId);
        return null;
    }

    await supabase
        .from("profiles")
        .update({ google_token_refreshed_at: new Date().toISOString() } as Record<string, unknown>)
        .eq("id", userId);

    return refreshResult.accessToken;
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'");
}

function htmlToPlainText(html: string): string {
    const stripped = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
        .replace(/<[^>]+>/g, "");

    const decoded = decodeHtmlEntities(stripped);
    const normalized = decoded.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return normalized ? `${normalized}\n` : "\n";
}

async function listFolder(accessToken: string, folderId: string) {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`);
    const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,createdTime)");
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

async function fetchDocContent(accessToken: string, fileId: string) {
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/html&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(await res.text());
    return await res.text();
}

function extractHeadingsFromHtml(html: string): Array<{ level: number; text: string }> {
    if (!html) return [];
    const headings: Array<{ level: number; text: string }> = [];
    const matches = html.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi);
    for (const match of matches) {
        const level = Number(match[1]);
        const inner = match[2] || "";
        const stripped = inner.replace(/<[^>]+>/g, "");
        const text = decodeHtmlEntities(stripped).trim();
        if (text) headings.push({ level, text });
    }
    return headings;
}

// ==========================================
// Main Handler
// ==========================================

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const channelToken = req.headers.get("x-goog-channel-token");
        const resourceState = req.headers.get("x-goog-resource-state");
        const resourceId = req.headers.get("x-goog-resource-id");
        const changed = req.headers.get("x-goog-changed"); // e.g. "content", "properties"
        const channelId = req.headers.get("x-goog-channel-id");

        console.log("Webhook received:", {
            resourceState,
            resourceId,
            channelId,
            changed
        });

        const secret = Deno.env.get("GOOGLE_WEBHOOK_SECRET");

        // If no secret is set in environment, we might skip verification or log warning
        // Ideally it SHOULD be set.
        if (secret && channelToken !== secret) {
            console.warn("Invalid channel token received");
            // Return 200 to stop delivery retries, but don't process
            return new Response(JSON.stringify({ error: "Invalid token" }), {
                status: 200, // Return 200 to acknowledge and stop retries
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Sync ping - just acknowledge
        if (resourceState === "sync") {
            console.log("Sync ping received. Channel active.");
            return new Response(JSON.stringify({ message: "Sync acknowledged" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        if (!resourceId) {
            console.warn("No resource ID in headers");
            return new Response(JSON.stringify({ message: "No resource ID" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Try to find if this resource ID corresponds to a specific Document
        const { data: doc } = await supabase
            .from("documents")
            .select("id, project_id, google_doc_id, title")
            .eq("google_doc_id", resourceId)
            .maybeSingle();

        if (doc) {
            console.log(`Found matching document: ${doc.title} (${doc.id}). Processing sync...`);

            // Get Project Owner to access Drive
            const ownerId = await getDriveTokenOwnerIdForProject(supabase, doc.project_id);
            if (!ownerId) {
                console.error("Could not find owner for project:", doc.project_id);
                return new Response(JSON.stringify({ error: "Owner not found" }), { status: 200, headers: corsHeaders });
            }

            // Get Access Token
            const accessToken = await refreshUserAccessToken(supabase, ownerId);
            if (!accessToken) {
                console.error("Could not refresh token for owner:", ownerId);
                return new Response(JSON.stringify({ error: "Token refresh failed" }), { status: 200, headers: corsHeaders });
            }

            // Fetch Metadata & Content from Drive
            // Need metadata for modifiedTime
            const metadataRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${resourceId}?fields=modifiedTime,name&supportsAllDrives=true`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            let googleModifiedAt = null;
            if (metadataRes.ok) {
                const meta = await metadataRes.json();
                googleModifiedAt = meta.modifiedTime;
            }

            const contentRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${resourceId}/export?mimeType=text/html&supportsAllDrives=true`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (!contentRes.ok) {
                console.error("Failed to fetch content from Drive:", await contentRes.text());
                return new Response(JSON.stringify({ error: "Drive fetch failed" }), { status: 200, headers: corsHeaders });
            }

            const htmlContent = await contentRes.text();

            // Update Database
            const updateData: any = {
                content_html: htmlContent,
                last_synced_at: new Date().toISOString(),
            };
            if (googleModifiedAt) updateData.google_modified_at = googleModifiedAt;

            const { error: updateError } = await supabase
                .from("documents")
                .update(updateData)
                .eq("id", doc.id);

            if (updateError) {
                console.error("DB Update failed:", updateError);
                return new Response(JSON.stringify({ error: "DB update failed" }), { status: 200, headers: corsHeaders });
            }

            // Encrypt & Cache (Enterprise feature)
            // Check org ID
            const { data: project } = await supabase
                .from("projects")
                .select("organization_id")
                .eq("id", doc.project_id)
                .single();

            if (project?.organization_id) {
                const orgId = project.organization_id;
                const encryptedHtml = await encryptOrgText(supabase, orgId, htmlContent);
                const contentText = htmlToPlainText(htmlContent);
                const headings = extractHeadingsFromHtml(htmlContent);
                const encryptedText = await encryptOrgText(supabase, orgId, contentText);
                const encryptedHeadings = await encryptOrgText(supabase, orgId, JSON.stringify(headings));

                if (encryptedHtml) {
                    await supabase.from("document_cache").upsert({
                        document_id: doc.id,
                        organization_id: orgId,
                        content_html_encrypted: encryptedHtml,
                        content_text_encrypted: encryptedText,
                        headings_encrypted: encryptedHeadings,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: "document_id" });
                }
            }

            console.log("Successfully synced document:", doc.id);
            return new Response(JSON.stringify({ success: true, id: doc.id }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 2. If not a document, check if it's a Project/Topic Folder
        // We can query projects where drive_folder_id = resourceId
        const { data: project } = await supabase
            .from("projects")
            .select("id, name, organization_id")
            .eq("drive_folder_id", resourceId)
            .maybeSingle();

        if (project) {
            console.log(`Found matching project folder: ${project.name}. Triggering folder scan...`);
            // Since we can't easily sync the WHOLE folder in one go here without timeouts,
            // we might just log it or trigger a background job if we had one.
            // For now, simpler implementation: Just acknowledge.
            // Implementing full folder sync requires listing children and reconciling.
            // That is best left to the 'Repair' tools or a separate async job.
            // However, we CAN list the folder and see if we can identify immediate changes.

            // OPTIONAL IMPROVEMENT: Call the google-drive function with "list_folder" if we could...
            console.log("Folder sync not yet fully implemented in webhook. Please use 'Sync' button in UI.");
            return new Response(JSON.stringify({ message: "Folder change detected. Sync manual." }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        console.log("Resource ID not found in system. Ignoring.");
        return new Response(JSON.stringify({ message: "Resource not matched" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("Webhook processing error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
