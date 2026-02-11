import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiscoverRequest {
    folderId: string;
    accessToken: string;
}

interface DiscoveredItem {
    id: string;
    name: string;
    mimeType: string;
    parents: string[];
    children?: DiscoveredItem[];
}

interface DiscoveryResult {
    subprojects: { id: string; name: string; docCount: number }[];
    documents: { id: string; name: string; folderId: string }[];
    topics: { id: string; name: string; parentId: string; docCount: number }[];
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { folderId, accessToken }: DiscoverRequest = await req.json();

        if (!folderId || !accessToken) {
            throw new Error("Missing required parameters");
        }

        // Recursive function to fetch all items
        async function fetchAllItems(folderId: string, depth = 0): Promise<DiscoveredItem[]> {
            const items: DiscoveredItem[] = [];
            let pageToken = undefined;

            do {
                const query = `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/vnd.google-apps.document')`;
                const url = new URL("https://www.googleapis.com/drive/v3/files");
                url.searchParams.append("q", query);
                url.searchParams.append("fields", "nextPageToken, files(id, name, mimeType, parents)");
                url.searchParams.append("pageSize", "1000"); // Fetch max allowed
                if (pageToken) {
                    url.searchParams.append("pageToken", pageToken);
                }

                const res = await fetch(url.toString(), {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (!res.ok) {
                    throw new Error(`Drive API error: ${await res.text()}`);
                }

                const data = await res.json();
                const files = data.files || [];
                pageToken = data.nextPageToken;

                for (const file of files) {
                    const item: DiscoveredItem = {
                        id: file.id,
                        name: file.name,
                        mimeType: file.mimeType,
                        parents: file.parents,
                    };

                    if (file.mimeType === "application/vnd.google-apps.folder" && depth < 5) { // Limit depth
                        item.children = await fetchAllItems(file.id, depth + 1);
                    }

                    items.push(item);
                }
            } while (pageToken);

            return items;
        }

        // Fetch entire structure
        console.log(`Scanning folder: ${folderId}`);
        const structure = await fetchAllItems(folderId);

        // Process structure into AccelDocs concepts
        const result: DiscoveryResult = {
            subprojects: [],
            documents: [],
            topics: [],
        };

        // 1. Identify Sub-projects (Folders at root level)
        for (const item of structure) {
            if (item.mimeType === "application/vnd.google-apps.folder") {
                const docCount = countDocs(item);
                if (docCount > 0) {
                    result.subprojects.push({
                        id: item.id,
                        name: item.name,
                        docCount,
                    });

                    // Identify Nested Topics within this sub-project
                    processTopics(item, item.id, result.topics);
                }
            } else if (item.mimeType === "application/vnd.google-apps.document") {
                // Root level documents
                result.documents.push({
                    id: item.id,
                    name: item.name,
                    folderId: folderId, // Belongs to root folder
                });
            }
        }

        return new Response(
            JSON.stringify(result),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});

// Helper to count docs recursively
function countDocs(folder: DiscoveredItem): number {
    if (!folder.children) return 0;
    return folder.children.reduce((acc, child) => {
        if (child.mimeType === "application/vnd.google-apps.document") return acc + 1;
        if (child.mimeType === "application/vnd.google-apps.folder") return acc + countDocs(child);
        return acc;
    }, 0);
}

// Helper to extract topics (nested folders)
function processTopics(parentFolder: DiscoveredItem, rootSubProjectId: string, topicsList: any[]) {
    if (!parentFolder.children) return;

    for (const child of parentFolder.children) {
        if (child.mimeType === "application/vnd.google-apps.folder") {
            const docCount = countDocs(child);
            if (docCount > 0) {
                topicsList.push({
                    id: child.id,
                    name: child.name,
                    parentId: parentFolder.id === rootSubProjectId ? null : parentFolder.id, // Only set parent if not directly under subproject? 
                    // Actually AccelDocs topics are flat or hierarchical? They are hierarchical.
                    // But here we need to map them. 
                    // For simplicity, we'll just list them and let the UI/Frontend reconstruct hierarchy or flatten it.
                    // Wait, 'parentId' here refers to the Drive folder ID of the parent folder? 
                    // No, needs to be mapped to Topic IDs later.
                    // Let's just return the flat list of folders that should be topics, with their Drive Parent ID.
                    driveParentId: child.parents && child.parents[0],
                    docCount
                });
                processTopics(child, rootSubProjectId, topicsList);
            }
        }
    }
}
