import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks (available in Supabase Edge Functions)
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-google-token",
};

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
}

interface TopicNode {
  name: string;
  fullPath: string;
  files: { path: string; content: string }[];
  children: Map<string, TopicNode>;
}

// Convert Markdown to clean HTML for Google Docs import
function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Remove frontmatter
  html = html.replace(/^---[\s\S]*?---\n*/m, '');
  
  // Code blocks (must be before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre style="background-color:#f4f4f4;padding:12px;border-radius:4px;overflow-x:auto;font-family:monospace;"><code>${escapeHtml(code.trim())}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background-color:#f0f0f0;padding:2px 6px;border-radius:3px;font-family:monospace;">$1</code>');
  
  // Headers (process from h6 to h1 to avoid conflicts)
  html = html.replace(/^###### (.+)$/gm, '<h6 style="font-size:12px;font-weight:bold;margin:16px 0 8px 0;">$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5 style="font-size:14px;font-weight:bold;margin:16px 0 8px 0;">$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:16px;font-weight:bold;margin:16px 0 8px 0;">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:bold;margin:20px 0 10px 0;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:22px;font-weight:bold;margin:24px 0 12px 0;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:28px;font-weight:bold;margin:28px 0 14px 0;">$1</h1>');
  
  // Bold and italic (order matters)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Links and images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#1a73e8;">$1</a>');
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:4px solid #ddd;padding-left:16px;margin:16px 0;color:#666;">$1</blockquote>');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />');
  html = html.replace(/^\*\*\*$/gm, '<hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />');
  
  // Process tables
  html = processMarkdownTables(html);
  
  // Process lists
  html = processLists(html);
  
  // Paragraphs - wrap remaining lines
  const lines = html.split('\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return line;
    return `<p style="margin:12px 0;line-height:1.6;">${line}</p>`;
  }).join('\n');
  
  // Clean up
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');
  html = html.replace(/\n{3,}/g, '\n\n');
  
  return html.trim();
}

function processMarkdownTables(html: string): string {
  const tableRegex = /(\|.+\|\n)+/g;
  
  return html.replace(tableRegex, (match) => {
    const rows = match.trim().split('\n');
    let tableHtml = '<table style="border-collapse:collapse;width:100%;margin:16px 0;">';
    let isHeader = true;
    
    for (const row of rows) {
      const cells = row.split('|').slice(1, -1).map(c => c.trim());
      
      // Skip separator row
      if (cells.every(c => /^[-:]+$/.test(c))) {
        isHeader = false;
        continue;
      }
      
      const cellTag = isHeader ? 'th' : 'td';
      const cellStyle = isHeader 
        ? 'style="border:1px solid #ddd;padding:8px 12px;background:#f5f5f5;font-weight:bold;text-align:left;"'
        : 'style="border:1px solid #ddd;padding:8px 12px;"';
      const rowHtml = cells.map(c => `<${cellTag} ${cellStyle}>${c}</${cellTag}>`).join('');
      tableHtml += `<tr>${rowHtml}</tr>`;
      
      if (isHeader) isHeader = false;
    }
    
    tableHtml += '</table>';
    return tableHtml;
  });
}

function processLists(html: string): string {
  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;
  let listType = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const unorderedMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
    const orderedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    
    if (unorderedMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ul style="margin:12px 0;padding-left:24px;">');
        inList = true;
        listType = 'ul';
      }
      result.push(`<li style="margin:4px 0;">${unorderedMatch[1]}</li>`);
    } else if (orderedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ol style="margin:12px 0;padding-left:24px;">');
        inList = true;
        listType = 'ol';
      }
      result.push(`<li style="margin:4px 0;">${orderedMatch[1]}</li>`);
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

// Parse folder structure into a proper tree with UNLIMITED nesting
function parseNestedStructure(files: { path: string; content: string }[]): {
  topicTree: TopicNode;
  rootFiles: { path: string; content: string }[];
} {
  const topicTree: TopicNode = { name: '', fullPath: '', files: [], children: new Map() };
  const rootFiles: { path: string; content: string }[] = [];
  
  // Find the common root folder
  let rootFolder = '';
  if (files.length > 0) {
    const firstPath = files[0].path;
    const firstParts = firstPath.split('/');
    if (firstParts.length > 1) {
      rootFolder = firstParts[0];
    }
  }
  
  for (const file of files) {
    let pathParts = file.path.split('/');
    
    // Remove the root folder if it matches
    if (rootFolder && pathParts[0] === rootFolder) {
      pathParts = pathParts.slice(1);
    }
    
    // Remove the filename
    const filename = pathParts.pop() || '';
    
    if (pathParts.length === 0) {
      // File directly in project root
      rootFiles.push(file);
    } else {
      // Navigate/create the topic tree
      let currentNode = topicTree;
      let currentPath = '';
      
      for (const part of pathParts) {
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
  
  console.log(`Parsed structure: ${rootFiles.length} root files`);
  logTopicTree(topicTree, 0);
  
  return { topicTree, rootFiles };
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
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&convert=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      if (response.status === 401 && attempt < retries) {
        console.log(`Auth error on attempt ${attempt + 1}, retrying...`);
        await delay(1000);
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
      await delay(1000);
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
      
      const response = await fetch("https://www.googleapis.com/drive/v3/files", {
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

      if (response.status === 401 && attempt < retries) {
        console.log(`Auth error creating folder on attempt ${attempt + 1}, retrying...`);
        await delay(1000);
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
      await delay(1000);
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
    const { files, projectId, organizationId } = body;

    console.log(`Importing ${files.length} markdown files to project ${projectId}`);

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

    // Get Google token
    const googleToken = req.headers.get("x-google-token");
    if (!googleToken) {
      return new Response(
        JSON.stringify({ error: "Google token required", needsReauth: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse nested folder structure
    const { topicTree, rootFiles } = parseNestedStructure(files);
    
    // Count topics recursively
    const countTopics = (node: TopicNode): number => {
      let count = node.children.size;
      for (const child of node.children.values()) {
        count += countTopics(child);
      }
      return count;
    };
    
    const totalTopics = countTopics(topicTree);
    console.log(`Found ${totalTopics} topics and ${rootFiles.length} root files`);

    const totalFiles = files.length;
    
    // Create import job record for progress tracking
    const { data: importJob, error: jobError } = await supabase
      .from("import_jobs")
      .insert({
        project_id: projectId,
        user_id: user.id,
        status: 'processing',
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
    
    const jobId = importJob?.id;
    console.log(`Created import job ${jobId} for ${totalFiles} files`);
    
    // Create token manager for automatic refresh during long imports
    const tokenManager = await createTokenManager(supabase, googleToken, user.id);
    
    // Start background processing
    const backgroundTask = async () => {
      try {
        await processImportWithProgress(
          supabase, 
          project, 
          tokenManager, 
          topicTree, 
          rootFiles, 
          projectId, 
          user.id,
          jobId
        );
      } catch (err) {
        console.error("Import failed:", err);
        if (jobId) {
          await supabase
            .from("import_jobs")
            .update({ 
              status: 'failed', 
              errors: [err instanceof Error ? err.message : 'Unknown error'],
              completed_at: new Date().toISOString()
            })
            .eq("id", jobId);
        }
      }
    };
    
    // @ts-ignore - EdgeRuntime.waitUntil is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(backgroundTask());
    } else {
      backgroundTask().catch(err => console.error("Background import failed:", err));
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId,
        message: `Import started for ${totalFiles} files.`,
        estimatedTopics: totalTopics,
        estimatedPages: totalFiles
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

// Recursively create topics with proper hierarchy
async function createTopicsRecursively(
  supabase: any,
  tokenManager: TokenManager,
  node: TopicNode,
  projectId: string,
  parentFolderId: string,
  parentTopicId: string | null,
  userId: string,
  results: { topicsCreated: number; pagesCreated: number; processedFiles: number; errors: string[] },
  updateProgress: (currentFile?: string) => Promise<void>,
  displayOrder: number = 0
): Promise<void> {
  for (const [name, childNode] of node.children) {
    try {
      await delay(100); // Increased delay for rate limiting
      await updateProgress(`Creating topic: ${name}`);
      
      // Create folder in Google Drive with retry logic
      const folderResult = await createGoogleFolder(tokenManager, name, parentFolderId);

      if (!folderResult.success) {
        console.error(`Failed to create folder for topic ${name}:`, folderResult.error);
        results.errors.push(`Failed to create folder: ${name}`);
        continue;
      }

      // Create topic in database with parent reference
      const { data: topic, error: topicError } = await supabase
        .from("topics")
        .insert({
          name: name,
          slug: generateSlug(name),
          project_id: projectId,
          drive_folder_id: folderResult.id,
          parent_id: parentTopicId,
          display_order: displayOrder++,
        })
        .select()
        .single();

      if (topicError) {
        console.error(`Failed to create topic ${name}:`, topicError);
        results.errors.push(`Failed to create topic: ${name}`);
        continue;
      }

      results.topicsCreated++;
      console.log(`Created topic: ${name} (parent: ${parentTopicId || 'root'})`);

      // Create pages for this topic
      for (const file of childNode.files) {
        try {
          await delay(100); // Increased delay for rate limiting
          
          const filename = file.path.split('/').pop() || 'Untitled';
          const title = extractTitle(file.content, filename);
          
          await updateProgress(`Creating: ${title}`);
          
          const htmlContent = markdownToHtml(file.content);

          const docResult = await createGoogleDocWithHtml(
            tokenManager,
            title,
            htmlContent,
            folderResult.id
          );

          if (!docResult.success) {
            results.errors.push(`Failed to create doc: ${title}`);
            results.processedFiles++;
            await updateProgress();
            continue;
          }

          // Use upsert to handle duplicate documents gracefully
          const { error: docError } = await supabase
            .from("documents")
            .upsert({
              title,
              slug: generateSlug(title),
              google_doc_id: docResult.id,
              project_id: projectId,
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
          console.error(`Error processing file ${file.path}:`, err);
          results.errors.push(`Error: ${file.path}`);
          results.processedFiles++;
          await updateProgress();
        }
      }

      // Recursively create child topics
      await createTopicsRecursively(
        supabase,
        tokenManager,
        childNode,
        projectId,
        folderResult.id,
        topic.id,
        userId,
        results,
        updateProgress,
        0
      );
    } catch (err) {
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
  userId: string,
  jobId: string | null
): Promise<void> {
  const results = {
    topicsCreated: 0,
    pagesCreated: 0,
    processedFiles: 0,
    errors: [] as string[],
  };
  
  // Wrap entire processing in try-catch to mark as failed on any unhandled error
  try {

  // Helper to update job progress
  const updateProgress = async (currentFile?: string) => {
    if (!jobId) return;

    // If user stopped the import, abort the background task ASAP
    try {
      const { data: stopCheck } = await supabase
        .from("import_jobs")
        .select("status")
        .eq("id", jobId)
        .maybeSingle();

      if (stopCheck?.status === "stopped") {
        throw new Error("Import stopped by user");
      }
    } catch (err) {
      // If the stop check fails, continue (don't kill import just because of a transient read error)
      if (err instanceof Error && err.message === "Import stopped by user") {
        throw err;
      }
    }

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
  };

  // Create topics recursively
  await createTopicsRecursively(
    supabase,
    tokenManager,
    topicTree,
    projectId,
    project.drive_folder_id,
    null,
    userId,
    results,
    updateProgress
  );

  // Create root-level pages
  for (const file of rootFiles) {
    try {
      await delay(100); // Increased delay for rate limiting
      
      const filename = file.path.split('/').pop() || 'Untitled';
      const title = extractTitle(file.content, filename);
      
      await updateProgress(`Creating: ${title}`);
      
      const htmlContent = markdownToHtml(file.content);

      const docResult = await createGoogleDocWithHtml(
        tokenManager,
        title,
        htmlContent,
        project.drive_folder_id!
      );

      if (!docResult.success) {
        results.errors.push(`Failed to create doc: ${title}`);
        results.processedFiles++;
        await updateProgress();
        continue;
      }

      // Use upsert to handle duplicate documents gracefully
      const { error: docError } = await supabase
        .from("documents")
        .upsert({
          title,
          slug: generateSlug(title),
          google_doc_id: docResult.id,
          project_id: projectId,
          topic_id: null,
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
        console.log(`Created root page: ${title}`);
      }
      
      results.processedFiles++;
      await updateProgress();
    } catch (err) {
      console.error(`Error processing file ${file.path}:`, err);
      results.errors.push(`Error: ${file.path}`);
      results.processedFiles++;
      await updateProgress();
    }
  }

    // Mark job as complete (unless user stopped it)
    if (jobId) {
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
