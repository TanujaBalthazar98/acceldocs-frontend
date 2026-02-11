import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConvertRequest {
    markdownContent: string;
    title: string;
    folderId: string;
    accessToken: string;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { markdownContent, title, folderId, accessToken }: ConvertRequest = await req.json();

        if (!markdownContent || !title || !folderId || !accessToken) {
            throw new Error("Missing required parameters");
        }

        // Convert Markdown to HTML using marked
        const { marked } = await import("https://esm.sh/marked@11.1.1");
        const htmlContent = marked(markdownContent);

        // Create a new Google Doc
        const createResponse = await fetch("https://docs.googleapis.com/v1/documents", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title: title,
            }),
        });

        if (!createResponse.ok) {
            const error = await createResponse.text();
            throw new Error(`Failed to create Google Doc: ${error}`);
        }

        const doc = await createResponse.json();
        const documentId = doc.documentId;

        // Insert HTML content into the document
        // Note: Google Docs API doesn't directly support HTML insertion
        // We need to convert HTML to Google Docs requests
        const requests = convertHtmlToDocsRequests(htmlContent);

        if (requests.length > 0) {
            const batchUpdateResponse = await fetch(
                `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ requests }),
                }
            );

            if (!batchUpdateResponse.ok) {
                const error = await batchUpdateResponse.text();
                console.error("Failed to update document content:", error);
            }
        }

        // Move the document to the specified folder
        const moveResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${folderId}&removeParents=root`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (!moveResponse.ok) {
            const error = await moveResponse.text();
            console.error("Failed to move document to folder:", error);
        }

        return new Response(
            JSON.stringify({
                success: true,
                documentId,
                title,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
            }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});

// Helper function to convert HTML to Google Docs API requests
function convertHtmlToDocsRequests(html: string): any[] {
    const requests: any[] = [];

    // Simple conversion: strip HTML tags and insert as plain text
    // For a more sophisticated conversion, you'd parse the HTML and create
    // formatted text with proper styling
    const plainText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');

    if (plainText.trim()) {
        requests.push({
            insertText: {
                location: { index: 1 },
                text: plainText,
            },
        });
    }

    return requests;
}
