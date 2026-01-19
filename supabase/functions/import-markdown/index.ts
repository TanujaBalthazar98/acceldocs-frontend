import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { marked } from "https://esm.sh/marked@13.0.0";

// Declare EdgeRuntime for background tasks (available in Supabase Edge Functions)
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-google-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const PROGRESS_UPDATE_INTERVAL_MS = 3000;
const STOP_CHECK_INTERVAL_MS = 3000;
const STOP_CHECK_EVERY_FILES = 10;
const DRIVE_API_DELAY_MS = 10;
const DRIVE_API_RETRY_BASE_DELAY_MS = 500;
const FILE_IMPORT_CONCURRENCY = 3;

// Token management for long-running imports
interface TokenManager {
  getToken: () => Promise<string>;
  userId: string;
}

async function createTokenManager(
  supabase: any,
  initialToken: string,
  userId: string
): Promise<TokenManager> {
  let currentToken = initialToken;
  let tokenExpiresAt = Date.now() + 50 * 60 * 1000; // Assume 50 min validity (conservative)

  return {
    userId,
    getToken: async () => {
      // If token is about to expire (within 5 minutes), try to refresh
      if (Date.now() > tokenExpiresAt - 5 * 60 * 1000) {
        console.log("Token expiring soon, attempting refresh...");
        try {
          // Get refresh token from profiles
          const { data: profile } = await supabase
            .from("profiles")
            .select("google_refresh_token")
            .eq("id", userId)
            .single();

          if (profile?.google_refresh_token) {
            const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
            const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

            if (clientId && clientSecret) {
              const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  client_id: clientId,
                  client_secret: clientSecret,
                  refresh_token: profile.google_refresh_token,
                  grant_type: "refresh_token",
                }),
              });

              if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                currentToken = tokenData.access_token;
                tokenExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
                console.log("Token refreshed successfully");
              }
            }
          }
        } catch (err) {
          console.error("Failed to refresh token:", err);
        }
      }
      return currentToken;
    },
  };
}

interface ImportRequest {
  files: {
    path: string;
    content: string;
  }[];
  projectId: string;
  organizationId: string;
  projectVersionId?: string | null;
  jobId?: string | null;
  batchStart?: number;
  batchSize?: number;
  totalFiles?: number;
  filesAreBatch?: boolean;
  /**
   * If provided, imported folders become subtopics under this topic, and root-level files become pages in it.
   * Used for both "import pages" (within a topic) and "import subtopics".
   */
  parentTopicId?: string | null;
}

async function resolveProjectVersionId(
  supabase: any,
  projectId: string,
  requestedVersionId?: string | null
): Promise<string | null> {
  if (requestedVersionId) {
    const { data: version, error } = await supabase
      .from("project_versions")
      .select("id")
      .eq("id", requestedVersionId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) {
      console.error("Error resolving requested project version:", error);
      return null;
    }

    return version?.id ?? null;
  }

  const { data: defaultVersion, error: defaultError } = await supabase
    .from("project_versions")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_default", true)
    .maybeSingle();

  if (defaultError) {
    console.error("Error fetching default project version:", defaultError);
  }

  if (defaultVersion?.id) {
    return defaultVersion.id;
  }

  const { data: publishedVersion, error: publishedError } = await supabase
    .from("project_versions")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_published", true)
    .order("semver_major", { ascending: false })
    .order("semver_minor", { ascending: false })
    .order("semver_patch", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (publishedError) {
    console.error("Error fetching published project version:", publishedError);
  }

  if (publishedVersion?.id) {
    return publishedVersion.id;
  }

  const { data: latestVersion, error: latestError } = await supabase
    .from("project_versions")
    .select("id")
    .eq("project_id", projectId)
    .order("semver_major", { ascending: false })
    .order("semver_minor", { ascending: false })
    .order("semver_patch", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    console.error("Error fetching latest project version:", latestError);
  }

  return latestVersion?.id ?? null;
}

interface TopicNode {
  name: string;
  fullPath: string;
  files: { path: string; content: string }[];
  children: Map<string, TopicNode>;
}

marked.setOptions({
  gfm: true,
  breaks: false,
  mangle: false,
  headerIds: false,
});

const markedRenderer = new marked.Renderer();
markedRenderer.code = (code, infostring) => {
  const lang = (infostring || "").trim();
  const langAttr = lang ? ` data-language="${lang}"` : "";
  return `<pre${langAttr}><code>${escapeHtml(code)}</code></pre>`;
};
marked.use({ renderer: markedRenderer });

// Convert Markdown to clean semantic HTML using a proper GFM parser.
function markdownToHtml(markdown: string): string {
  let content = markdown;

  // Remove frontmatter
  content = content.replace(/^---[\s\S]*?---\n*/m, "");

  // Handle callouts before parsing markdown to preserve structure.
  content = processCallouts(content);

  return marked.parse(content).trim();
}

// Process callouts/admonitions like > [!NOTE], > [!WARNING], etc.
function processCallouts(html: string): string {
  // GitHub-style callouts: > [!NOTE], > [!TIP], > [!WARNING], > [!CAUTION], > [!IMPORTANT]
  const calloutRegex = /^> \[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT|INFO|DANGER)\]\n((?:^>.*\n?)*)/gim;
  
  html = html.replace(calloutRegex, (_, type, content) => {
    const cleanContent = content.replace(/^> ?/gm, "").trim();
    const calloutType = type.toLowerCase();
    const inner = marked.parse(cleanContent).trim();
    return `<div class="callout callout-${calloutType}" data-callout="${calloutType}">${inner}</div>\n`;
  });
  
  return html;
}

// Process multi-line blockquotes
function processBlockquotes(html: string): string {
  const lines = html.split('\n');
  const result: string[] = [];
  let inBlockquote = false;
  let blockquoteContent: string[] = [];
  
  for (const line of lines) {
    const isQuoteLine = /^>\s?(.*)$/.test(line);
    
    if (isQuoteLine) {
      if (!inBlockquote) {
        inBlockquote = true;
        blockquoteContent = [];
      }
      const content = line.replace(/^>\s?/, '');
      blockquoteContent.push(content);
    } else {
      if (inBlockquote) {
        result.push(`<blockquote><p>${blockquoteContent.join(' ')}</p></blockquote>`);
        inBlockquote = false;
        blockquoteContent = [];
      }
      result.push(line);
    }
  }
  
  if (inBlockquote) {
    result.push(`<blockquote><p>${blockquoteContent.join(' ')}</p></blockquote>`);
  }
  
  return result.join('\n');
}

function processMarkdownTables(html: string): string {
  const tableRegex = /(\|.+\|\n)+/g;
  
  return html.replace(tableRegex, (match) => {
    const rows = match.trim().split('\n');
    let tableHtml = '<table>';
    let isHeader = true;
    let inThead = false;
    let inTbody = false;
    
    for (const row of rows) {
      const cells = row.split('|').slice(1, -1).map(c => c.trim());
      
      // Skip separator row
      if (cells.every(c => /^[-:]+$/.test(c))) {
        isHeader = false;
        continue;
      }
      
      if (isHeader && !inThead) {
        tableHtml += '<thead>';
        inThead = true;
      } else if (!isHeader && !inTbody) {
        if (inThead) tableHtml += '</thead>';
        tableHtml += '<tbody>';
        inTbody = true;
      }
      
      const cellTag = isHeader ? 'th' : 'td';
      const rowHtml = cells.map(c => `<${cellTag}>${c}</${cellTag}>`).join('');
      tableHtml += `<tr>${rowHtml}</tr>`;
      
      if (isHeader) isHeader = false;
    }
    
    if (inThead && !inTbody) tableHtml += '</thead>';
    if (inTbody) tableHtml += '</tbody>';
    tableHtml += '</table>';
    return tableHtml;
  });
}

function processLists(html: string): string {
  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;
  let listType = '';
  let listDepth = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    
    if (unorderedMatch) {
      const indent = unorderedMatch[1].length;
      const content = unorderedMatch[2];
      
      if (!inList || listType !== 'ul') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push(`<li>${content}</li>`);
    } else if (orderedMatch) {
      const content = orderedMatch[2];
      
      if (!inList || listType !== 'ol') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      result.push(`<li>${content}</li>`);
    } else {
      if (inList) {
        result.push(`</${listType}>`);
        inList = false;
        listType = '';
      }
      result.push(line);
    }
  }
  
  if (inList) {
    result.push(`</${listType}>`);
  }
  
  return result.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Extract title from markdown content or filename
function extractTitle(content: string, filename: string): string {
  // Try to find first H1
  const h1Match = content.match(/^# (.+)$/m);
  if (h1Match) return h1Match[1].trim();
  
  // Try frontmatter title
  const frontmatterMatch = content.match(/^---[\s\S]*?title:\s*['"]?([^'"\n]+)['"]?[\s\S]*?---/);
  if (frontmatterMatch) return frontmatterMatch[1].trim();
  
  // Use filename without extension
  return filename.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
}

// Generate slug from text
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

// Normalize path separators and remove leading/trailing slashes
function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/') // Windows to Unix separators
    .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
    .replace(/\/+/g, '/'); // Collapse multiple slashes
}

// Parse folder structure into a proper tree with UNLIMITED nesting
function parseNestedStructure(files: { path: string; content: string }[]): {
  topicTree: TopicNode;
  rootFiles: { path: string; content: string }[];
} {
  const topicTree: TopicNode = { name: '', fullPath: '', files: [], children: new Map() };
  const rootFiles: { path: string; content: string }[] = [];
  
  // First, normalize all paths
  const normalizedFiles = files.map(f => ({
    ...f,
    path: normalizePath(f.path)
  }));
  
  // Find the common root folder prefix (only strip if ALL files share it)
  let commonPrefix = '';
  if (normalizedFiles.length > 0) {
    const firstParts = normalizedFiles[0].path.split('/');
    if (firstParts.length > 1) {
      const potentialRoot = firstParts[0];
      const allShareRoot = normalizedFiles.every(f => f.path.startsWith(potentialRoot + '/'));
      if (allShareRoot) {
        commonPrefix = potentialRoot;
        console.log(`Detected common root folder: "${commonPrefix}" - will preserve as topic`);
      }
    }
  }
  
  for (const file of normalizedFiles) {
    const pathParts = file.path.split('/');
    
    // Remove the filename from path parts
    const filename = pathParts.pop() || '';
    
    // If pathParts is empty after removing filename, this is a root file
    if (pathParts.length === 0) {
      rootFiles.push(file);
    } else {
      // Navigate/create the topic tree - DO NOT strip the root folder
      // The root folder IS a topic that should be created
      let currentNode = topicTree;
      let currentPath = '';
      
      for (const part of pathParts) {
        if (!part) continue; // Skip empty parts
        
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!currentNode.children.has(part)) {
          currentNode.children.set(part, {
            name: part,
            fullPath: currentPath,
            files: [],
            children: new Map()
          });
        }
        currentNode = currentNode.children.get(part)!;
      }
      
      // Add file to the leaf topic
      currentNode.files.push(file);
    }
  }
  
  const topicCount = countTopics(topicTree);
  console.log(`Parsed structure: ${topicCount} topics and ${rootFiles.length} root files`);
  logTopicTree(topicTree, 0);
  
  return { topicTree, rootFiles };
}

// Count total topics in tree
function countTopics(node: TopicNode): number {
  let count = node.children.size;
  for (const child of node.children.values()) {
    count += countTopics(child);
  }
  return count;
}

function logTopicTree(node: TopicNode, depth: number) {
  for (const [name, child] of node.children) {
    console.log(`${'  '.repeat(depth)}Topic "${name}": ${child.files.length} files, ${child.children.size} children`);
    logTopicTree(child, depth + 1);
  }
}

// Helper to add delay between API calls
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  if (limit <= 1) {
    for (const item of items) {
      await handler(item);
    }
    return;
  }

  let index = 0;
  let stopError: Error | null = null;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      if (stopError) return;
      const currentIndex = index++;
      if (currentIndex >= items.length) return;
      try {
        await handler(items[currentIndex]);
      } catch (err) {
        stopError = err instanceof Error ? err : new Error("Import failed");
        return;
      }
    }
  });

  await Promise.all(workers);
  if (stopError) {
    throw stopError;
  }
}

// Create Google Doc by uploading HTML content with retry logic
async function createGoogleDocWithHtml(
  tokenManager: TokenManager,
  title: string,
  htmlContent: string,
  parentFolderId: string,
  retries: number = 2
): Promise<{ id: string; success: boolean; error?: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const googleToken = await tokenManager.getToken();
      
      // Create HTML document with proper structure
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
</head>
<body>
${htmlContent}
</body>
</html>`;

      // Create file metadata
      const metadata = {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
        parents: [parentFolderId],
      };

      // Create form data for multipart upload
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const multipartBody = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: text/html; charset=UTF-8\r\n\r\n' +
        fullHtml +
        closeDelim;

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&convert=true&supportsAllDrives=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      if ((response.status === 401 || response.status === 429 || response.status >= 500) && attempt < retries) {
        const backoff = DRIVE_API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`Retryable error ${response.status} on attempt ${attempt + 1}, retrying in ${backoff}ms...`);
        await delay(backoff);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to create doc ${title}:`, errorText);
        return { id: '', success: false, error: `Create failed: ${response.status}` };
      }

      const doc = await response.json();
      return { id: doc.id, success: true };
    } catch (error) {
      console.error(`Error creating doc ${title} (attempt ${attempt + 1}):`, error);
      if (attempt === retries) {
        return { id: '', success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
      const backoff = DRIVE_API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await delay(backoff);
    }
  }
  return { id: '', success: false, error: 'Max retries exceeded' };
}

// Create folder with retry logic
async function createGoogleFolder(
  tokenManager: TokenManager,
  name: string,
  parentFolderId: string,
  retries: number = 2
): Promise<{ id: string; success: boolean; error?: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const googleToken = await tokenManager.getToken();
      
      const response = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        }),
      });

      if ((response.status === 401 || response.status === 429 || response.status >= 500) && attempt < retries) {
        const backoff = DRIVE_API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`Retryable error ${response.status} creating folder on attempt ${attempt + 1}, retrying in ${backoff}ms...`);
        await delay(backoff);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { id: '', success: false, error: `Create folder failed: ${response.status} - ${errorText}` };
      }

      const folder = await response.json();
      return { id: folder.id, success: true };
    } catch (error) {
      console.error(`Error creating folder ${name} (attempt ${attempt + 1}):`, error);
      if (attempt === retries) {
        return { id: '', success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
      const backoff = DRIVE_API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await delay(backoff);
    }
  }
  return { id: '', success: false, error: 'Max retries exceeded' };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const requestGoogleToken = req.headers.get("x-google-token")?.trim();
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ImportRequest = await req.json();
    const { files, projectId, organizationId, parentTopicId, projectVersionId } = body;

    console.log(`Importing ${files.length} markdown files to project ${projectId}`);

    // Log file paths for debugging
    console.log("File paths received:", files.slice(0, 10).map((f) => f.path));

    // Get project's drive folder
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("drive_folder_id, name")
      .eq("id", projectId)
      .single();

    if (projectError || !project?.drive_folder_id) {
      return new Response(
        JSON.stringify({ error: "Project not found or no Drive folder" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure caller has edit permissions for Drive-backed project changes
    const { data: canEdit, error: permError } = await supabase.rpc("can_access_drive", {
      _project_id: projectId,
      _user_id: user.id,
      _operation: "create",
    });

    if (permError) {
      console.error("Permission check error:", permError);
      return new Response(
        JSON.stringify({ error: "Failed to check permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!canEdit) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions to import into this project" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolvedProjectVersionId = await resolveProjectVersionId(
      supabase,
      projectId,
      projectVersionId
    );

    if (!resolvedProjectVersionId) {
      return new Response(
        JSON.stringify({ error: "Project version not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine base folder/topic (when importing into an existing topic)
    let baseFolderId = project.drive_folder_id;
    let baseTopicId: string | null = null;

    if (parentTopicId) {
      const { data: parentTopic, error: parentTopicError } = await supabase
        .from("topics")
        .select("id, drive_folder_id, project_version_id")
        .eq("id", parentTopicId)
        .eq("project_id", projectId)
        .single();

      if (parentTopicError || !parentTopic?.drive_folder_id) {
        return new Response(
          JSON.stringify({ error: "Parent topic not found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (parentTopic.project_version_id !== resolvedProjectVersionId) {
        return new Response(
          JSON.stringify({ error: "Parent topic is not part of the selected version" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      baseFolderId = parentTopic.drive_folder_id;
      baseTopicId = parentTopic.id;
      console.log(`Import base topic: ${baseTopicId}`);
    }

    // Get org owner's refresh token for Drive operations (owner has full Drive scopes)
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("owner_id")
      .eq("id", organizationId)
      .single();

    if (orgError || !org?.owner_id) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const canUseRequestToken = !!requestGoogleToken && !!canEdit;

    // Get owner's refresh token
    const { data: ownerProfile, error: ownerError } = await supabase
      .from("profiles")
      .select("google_refresh_token")
      .eq("id", org.owner_id)
      .single();

    if (ownerError || !ownerProfile?.google_refresh_token) {
      if (canUseRequestToken) {
        console.warn("Owner refresh token missing. Using request Google token.");
      } else {
      return new Response(
        JSON.stringify({ error: "Organization owner needs to reconnect Google Drive", needsReauth: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
      }
    }

    // Get fresh access token from owner's refresh token
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      if (canUseRequestToken) {
        console.warn("Google OAuth not configured. Using request Google token.");
      } else {
      return new Response(
        JSON.stringify({ error: "Google OAuth not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
      }
    }

    let googleToken: string | null = null;
    let tokenOwnerId = org.owner_id;

    if (clientId && clientSecret && ownerProfile?.google_refresh_token) {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: ownerProfile.google_refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Failed to refresh owner token:", errorText);
        if (!canUseRequestToken) {
          return new Response(
            JSON.stringify({
              error: "Owner's Google Drive access expired. Ask organization owner to reconnect.",
              details: errorText,
              needsReauth: true,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        const tokenData = await tokenResponse.json();
        googleToken = tokenData.access_token;
      }
    }

    if (!googleToken && canUseRequestToken) {
      console.warn("Falling back to request Google token.");
      googleToken = requestGoogleToken!;
      tokenOwnerId = user.id;
    }

    if (!googleToken) {
      return new Response(
        JSON.stringify({ error: "No Google access token available", needsReauth: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const tokenSource = googleToken === requestGoogleToken ? "request token" : "owner refresh token";
    console.log(`Using ${tokenSource} for import (owner: ${org.owner_id}, user: ${user.id})`);

    const totalFiles = typeof body.totalFiles === "number" ? body.totalFiles : files.length;
    const filesAreBatch = body.filesAreBatch === true;
    const requestedBatchSize = typeof body.batchSize === "number" ? body.batchSize : undefined;
    const batchSize = Math.min(Math.max(requestedBatchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const shouldChunk =
      !filesAreBatch &&
      (totalFiles > batchSize ||
        body.jobId !== undefined ||
        body.batchStart !== undefined ||
        body.batchSize !== undefined);

    let jobId = body.jobId ?? null;
    let batchStart = typeof body.batchStart === "number" ? Math.max(body.batchStart, 0) : 0;
    let progressBase = {
      processedFiles: 0,
      topicsCreated: 0,
      pagesCreated: 0,
      errors: [] as string[],
    };

    if (jobId) {
      const { data: existingJob, error: existingJobError } = await supabase
        .from("import_jobs")
        .select("id, status, processed_files, topics_created, pages_created, errors")
        .eq("id", jobId)
        .maybeSingle();

      if (existingJobError || !existingJob) {
        return new Response(
          JSON.stringify({ error: "Import job not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existingJob.status === "stopped" || existingJob.status === "completed") {
        return new Response(
          JSON.stringify({ success: true, jobId, message: "Import already finalized." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      progressBase = {
        processedFiles: existingJob.processed_files ?? 0,
        topicsCreated: existingJob.topics_created ?? 0,
        pagesCreated: existingJob.pages_created ?? 0,
        errors: existingJob.errors ?? [],
      };

      if (!filesAreBatch && body.batchStart === undefined) {
        batchStart = progressBase.processedFiles;
      }
    } else {
      // Create import job record for progress tracking
      const { data: importJob, error: jobError } = await supabase
        .from("import_jobs")
        .insert({
          project_id: projectId,
          user_id: user.id,
          status: "processing",
          total_files: totalFiles,
          processed_files: 0,
          topics_created: 0,
          pages_created: 0,
          errors: [],
        })
        .select()
        .single();

      if (jobError) {
        console.error("Failed to create import job:", jobError);
      }

      jobId = importJob?.id ?? null;
      console.log(`Created import job ${jobId} for ${totalFiles} files`);
    }

    const filesToProcess = filesAreBatch
      ? files
      : shouldChunk
      ? files.slice(batchStart, batchStart + batchSize)
      : files;
    const isFinalBatch = filesAreBatch
      ? batchStart + filesToProcess.length >= totalFiles
      : !shouldChunk || batchStart + filesToProcess.length >= totalFiles;

    if (filesToProcess.length === 0) {
      if (jobId && isFinalBatch) {
        await supabase
          .from("import_jobs")
          .update({
            status: "completed",
            current_file: null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          jobId,
          message: "No files remaining to import.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse nested folder structure for this batch
    const { topicTree, rootFiles } = parseNestedStructure(filesToProcess);

    // Count topics recursively
    const countTopics = (node: TopicNode): number => {
      let count = node.children.size;
      for (const child of node.children.values()) {
        count += countTopics(child);
      }
      return count;
    };

    const totalTopics = countTopics(topicTree);
    console.log(
      `Processing batch ${batchStart}-${batchStart + filesToProcess.length - 1} (${filesToProcess.length} files)`
    );
    console.log(`Found ${totalTopics} topics and ${rootFiles.length} root files in batch`);

    // Create token manager for automatic refresh during long imports (use owner's ID for refresh)
    const tokenManager = await createTokenManager(supabase, googleToken, tokenOwnerId);

    await processImportWithProgress(
      supabase,
      project,
      tokenManager,
      topicTree,
      rootFiles,
      projectId,
      resolvedProjectVersionId,
      user.id,
      jobId,
      baseFolderId,
      baseTopicId,
      progressBase,
      isFinalBatch
    );

    if (!isFinalBatch && jobId && !filesAreBatch) {
      const { data: jobStatus } = await supabase
        .from("import_jobs")
        .select("status, processed_files, errors")
        .eq("id", jobId)
        .maybeSingle();

      if (jobStatus?.status === "processing") {
        const nextStart = jobStatus.processed_files ?? batchStart + filesToProcess.length;
        const scheduleBody = {
          files,
          projectId,
          organizationId,
          projectVersionId: resolvedProjectVersionId,
          parentTopicId,
          jobId,
          batchStart: nextStart,
          batchSize,
        };
        const scheduleHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          authorization: authHeader,
          apikey: supabaseKey,
        };
        if (requestGoogleToken) {
          scheduleHeaders["x-google-token"] = requestGoogleToken;
        }

        const schedulePromise = fetch(`${supabaseUrl}/functions/v1/import-markdown`, {
          method: "POST",
          headers: scheduleHeaders,
          body: JSON.stringify(scheduleBody),
        }).catch(async (err) => {
          console.error("Failed to schedule next import batch:", err);
          await supabase
            .from("import_jobs")
            .update({
              status: "failed",
              errors: [
                ...(jobStatus?.errors ?? []),
                "Failed to schedule next import batch.",
              ],
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);
        });

        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
          EdgeRuntime.waitUntil(schedulePromise);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        message: `Import batch processed (${filesToProcess.length} files).`,
        estimatedTopics: totalTopics,
        estimatedPages: totalFiles,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Import failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Custom error class for import stop
class ImportStoppedError extends Error {
  constructor() {
    super("Import stopped by user");
    this.name = "ImportStoppedError";
  }
}

// Recursively create topics with proper hierarchy
async function createTopicsRecursively(
  supabase: any,
  tokenManager: TokenManager,
  node: TopicNode,
  projectId: string,
  projectVersionId: string,
  parentFolderId: string,
  parentTopicId: string | null,
  userId: string,
  results: { topicsCreated: number; pagesCreated: number; processedFiles: number; errors: string[] },
  updateProgress: (currentFile?: string) => Promise<void>,
  displayOrder: number = 0
): Promise<void> {
  for (const [name, childNode] of node.children) {
    try {
      if (DRIVE_API_DELAY_MS > 0) {
        await delay(DRIVE_API_DELAY_MS);
      }
      await updateProgress(`Creating topic: ${name}`);
      
      // Reuse existing topic/folder when possible
      let topic = null as { id: string; drive_folder_id: string | null } | null;
      let createdTopic = false;

      const { data: existingTopic, error: existingError } = await supabase
        .from("topics")
        .select("id, drive_folder_id")
        .eq("project_id", projectId)
        .eq("project_version_id", projectVersionId)
        .eq("name", name)
        .eq("parent_id", parentTopicId)
        .maybeSingle();

      if (existingError) {
        console.error(`Failed to check existing topic ${name}:`, existingError);
        results.errors.push(`Failed to check topic: ${name}`);
        continue;
      }

      if (existingTopic?.id) {
        topic = existingTopic;
      } else {
        // Create folder in Google Drive with retry logic
        const folderResult = await createGoogleFolder(tokenManager, name, parentFolderId);

        if (!folderResult.success) {
          console.error(`Failed to create folder for topic ${name}:`, folderResult.error);
          results.errors.push(`Failed to create folder: ${name}`);
          continue;
        }

        // Create topic in database with parent reference
        const { data: created, error: topicError } = await supabase
          .from("topics")
          .insert({
            name: name,
            slug: generateSlug(name),
            project_id: projectId,
            project_version_id: projectVersionId,
            drive_folder_id: folderResult.id,
            parent_id: parentTopicId,
            display_order: displayOrder++,
          })
          .select()
          .single();

        if (topicError || !created) {
          console.error(`Failed to create topic ${name}:`, topicError);
          results.errors.push(`Failed to create topic: ${name}`);
          continue;
        }

        topic = created;
        createdTopic = true;
        results.topicsCreated++;
        console.log(`Created topic: ${name} (parent: ${parentTopicId || 'root'})`);
      }

      if (!topic?.drive_folder_id) {
        // Recover missing folder id if topic exists without Drive folder
        const folderResult = await createGoogleFolder(tokenManager, name, parentFolderId);
        if (!folderResult.success) {
          console.error(`Failed to create folder for topic ${name}:`, folderResult.error);
          results.errors.push(`Failed to create folder: ${name}`);
          continue;
        }

        const { error: updateError } = await supabase
          .from("topics")
          .update({ drive_folder_id: folderResult.id })
          .eq("id", topic.id);

        if (updateError) {
          console.error(`Failed to update topic folder ${name}:`, updateError);
          results.errors.push(`Failed to update topic folder: ${name}`);
          continue;
        }

        topic.drive_folder_id = folderResult.id;
        if (!createdTopic) {
          console.log(`Recovered folder for topic: ${name}`);
        }
      }

      // Create pages for this topic
      const processTopicFile = async (file: { path: string; content: string }) => {
        try {
          if (DRIVE_API_DELAY_MS > 0) {
            await delay(DRIVE_API_DELAY_MS);
          }
          
          const filename = file.path.split('/').pop() || 'Untitled';
          const title = extractTitle(file.content, filename);
          
          await updateProgress(`Creating: ${title}`);
          
          const htmlContent = markdownToHtml(file.content);

          const docResult = await createGoogleDocWithHtml(
            tokenManager,
            title,
            htmlContent,
            topic.drive_folder_id
          );

          if (!docResult.success) {
            results.errors.push(`Failed to create doc: ${title}`);
            results.processedFiles++;
            await updateProgress();
            return;
          }

          // Use upsert to handle duplicate documents gracefully
      const { error: docError } = await supabase
            .from("documents")
            .upsert({
              title,
              slug: generateSlug(title),
              google_doc_id: docResult.id,
              project_id: projectId,
              project_version_id: projectVersionId,
              topic_id: topic.id,
              content_html: htmlContent,
              owner_id: userId,
              visibility: "internal",
              is_published: false,
            }, {
              onConflict: 'project_id,google_doc_id',
              ignoreDuplicates: true
            });

          if (docError) {
            console.error(`Failed to save document ${title}:`, docError);
            results.errors.push(`Failed to save: ${title}`);
          } else {
            results.pagesCreated++;
            console.log(`Created page: ${title}`);
          }
          
          results.processedFiles++;
          await updateProgress();
        } catch (err) {
          // Re-throw stop errors to bubble up
          if (err instanceof ImportStoppedError || (err instanceof Error && err.message === "Import stopped by user")) {
            throw err;
          }
          console.error(`Error processing file ${file.path}:`, err);
          results.errors.push(`Error: ${file.path}`);
          results.processedFiles++;
          await updateProgress();
        }
      };

      await runWithConcurrency(childNode.files, FILE_IMPORT_CONCURRENCY, processTopicFile);

      // Recursively create child topics
      await createTopicsRecursively(
        supabase,
        tokenManager,
        childNode,
        projectId,
        projectVersionId,
        topic.drive_folder_id,
        topic.id,
        userId,
        results,
        updateProgress,
        0
      );
    } catch (err) {
      // Re-throw stop errors to bubble up
      if (err instanceof ImportStoppedError || (err instanceof Error && err.message === "Import stopped by user")) {
        throw err;
      }
      console.error(`Error creating topic ${name}:`, err);
      results.errors.push(`Error creating topic: ${name}`);
    }
  }
}

// Import processing function with progress tracking
async function processImportWithProgress(
  supabase: any,
  project: { drive_folder_id: string; name: string },
  tokenManager: TokenManager,
  topicTree: TopicNode,
  rootFiles: { path: string; content: string }[],
  projectId: string,
  projectVersionId: string,
  userId: string,
  jobId: string | null,
  baseFolderId: string,
  baseTopicId: string | null,
  progressBase: {
    processedFiles: number;
    topicsCreated: number;
    pagesCreated: number;
    errors: string[];
  },
  completeOnFinish: boolean
): Promise<void> {
  const results = {
    topicsCreated: progressBase.topicsCreated,
    pagesCreated: progressBase.pagesCreated,
    processedFiles: progressBase.processedFiles,
    errors: progressBase.errors,
  };
  
  // Wrap entire processing in try-catch to mark as failed on any unhandled error
  try {

  // Helper to update job progress and check for stop signal
  let lastProgressAt = 0;
  let lastStopCheckAt = 0;
  const updateProgress = async (currentFile?: string) => {
    if (!jobId) return;
    const now = Date.now();
    const shouldCheckStop =
      now - lastStopCheckAt >= STOP_CHECK_INTERVAL_MS ||
      results.processedFiles % STOP_CHECK_EVERY_FILES === 0;
    const shouldUpdateProgress =
      now - lastProgressAt >= PROGRESS_UPDATE_INTERVAL_MS ||
      results.processedFiles % STOP_CHECK_EVERY_FILES === 0 ||
      (currentFile && results.processedFiles === 0);

    // Check if user stopped the import - avoid excessive polling
    if (shouldCheckStop) {
      lastStopCheckAt = now;
      try {
        const { data: stopCheck } = await supabase
          .from("import_jobs")
          .select("status")
          .eq("id", jobId)
          .maybeSingle();

        if (stopCheck?.status === "stopped") {
          console.log("Import stop detected, aborting...");
          throw new ImportStoppedError();
        }
      } catch (err) {
        // Re-throw stop errors
        if (err instanceof ImportStoppedError) {
          throw err;
        }
        // Continue on transient read errors
        console.warn("Stop check failed:", err);
      }
    }

    if (shouldUpdateProgress) {
      lastProgressAt = now;
      try {
        await supabase
          .from("import_jobs")
          .update({
            processed_files: results.processedFiles,
            topics_created: results.topicsCreated,
            pages_created: results.pagesCreated,
            errors: results.errors,
            current_file: currentFile || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      } catch (err) {
        console.error("Failed to update progress:", err);
      }
    }
  };

  // Create topics recursively
  await createTopicsRecursively(
    supabase,
    tokenManager,
    topicTree,
    projectId,
    projectVersionId,
    baseFolderId,
    baseTopicId,
    userId,
    results,
    updateProgress
  );

  // Create root-level pages
  const processRootFile = async (file: { path: string; content: string }) => {
    try {
      if (DRIVE_API_DELAY_MS > 0) {
        await delay(DRIVE_API_DELAY_MS);
      }
      
      const filename = file.path.split('/').pop() || 'Untitled';
      const title = extractTitle(file.content, filename);
      
      await updateProgress(`Creating: ${title}`);
      
      const htmlContent = markdownToHtml(file.content);

      const docResult = await createGoogleDocWithHtml(
        tokenManager,
        title,
        htmlContent,
        baseFolderId
      );

      if (!docResult.success) {
        results.errors.push(`Failed to create doc: ${title}`);
        results.processedFiles++;
        await updateProgress();
        return;
      }

      // Use upsert to handle duplicate documents gracefully
      const { error: docError } = await supabase
        .from("documents")
        .upsert(
          {
            title,
            slug: generateSlug(title),
            google_doc_id: docResult.id,
            project_id: projectId,
            project_version_id: projectVersionId,
            topic_id: baseTopicId,
            content_html: htmlContent,
            owner_id: userId,
            visibility: "internal",
            is_published: false,
          },
          {
            onConflict: 'project_id,google_doc_id',
            ignoreDuplicates: true,
          }
        );

      if (docError) {
        console.error(`Failed to save document ${title}:`, docError);
        results.errors.push(`Failed to save: ${title}`);
      } else {
        results.pagesCreated++;
        console.log(`Created root page: ${title}`);
      }
      
      results.processedFiles++;
      await updateProgress();
    } catch (err) {
      // Re-throw stop errors to bubble up and exit the loop
      if (err instanceof ImportStoppedError) {
        throw err;
      }
      console.error(`Error processing file ${file.path}:`, err);
      results.errors.push(`Error: ${file.path}`);
      results.processedFiles++;
      try {
        await updateProgress();
      } catch (stopErr) {
        if (stopErr instanceof ImportStoppedError) {
          throw stopErr;
        }
      }
    }
  };

  await runWithConcurrency(rootFiles, FILE_IMPORT_CONCURRENCY, processRootFile);

    // Mark job as complete only when this is the final batch
    if (jobId && completeOnFinish) {
      const { data: finalStatus } = await supabase
        .from("import_jobs")
        .select("status")
        .eq("id", jobId)
        .maybeSingle();

      if (finalStatus?.status !== "stopped") {
        await supabase
          .from("import_jobs")
          .update({
            status: "completed",
            processed_files: results.processedFiles,
            topics_created: results.topicsCreated,
            pages_created: results.pagesCreated,
            errors: results.errors,
            current_file: null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    }

    console.log("Import complete:", results);
  } catch (error) {
    console.error("Import processing failed with error:", error);
    
    // Mark job as failed (but don't overwrite 'stopped')
    if (jobId) {
      const { data: currentStatus } = await supabase
        .from("import_jobs")
        .select("status")
        .eq("id", jobId)
        .maybeSingle();

      if (currentStatus?.status === "stopped") {
        return;
      }

      results.errors.push(
        `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      await supabase
        .from("import_jobs")
        .update({
          status: "failed",
          processed_files: results.processedFiles,
          topics_created: results.topicsCreated,
          pages_created: results.pagesCreated,
          errors: results.errors,
          current_file: null,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }
  }
}
