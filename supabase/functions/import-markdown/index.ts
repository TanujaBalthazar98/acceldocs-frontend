import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-google-token",
};

interface ImportRequest {
  files: {
    path: string;
    content: string;
  }[];
  projectId: string;
  organizationId: string;
}

interface NestedStructure {
  name: string;
  files: { path: string; content: string }[];
  children: Map<string, NestedStructure>;
}

// Convert Markdown to clean HTML
function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Remove frontmatter
  html = html.replace(/^---[\s\S]*?---\n*/m, '');
  
  // Code blocks (must be before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langAttr = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Headers (process from h6 to h1 to avoid conflicts)
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold and italic (order matters)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Links (before images to avoid conflict)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');
  html = html.replace(/^___$/gm, '<hr>');
  
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
    return `<p>${line}</p>`;
  }).join('\n');
  
  // Clean up
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/\n{3,}/g, '\n\n');
  
  return html.trim();
}

function processMarkdownTables(html: string): string {
  const tableRegex = /(\|.+\|\n)+/g;
  
  return html.replace(tableRegex, (match) => {
    const rows = match.trim().split('\n');
    let tableHtml = '<table>';
    let isHeader = true;
    
    for (const row of rows) {
      const cells = row.split('|').slice(1, -1).map(c => c.trim());
      
      // Skip separator row
      if (cells.every(c => /^[-:]+$/.test(c))) {
        isHeader = false;
        continue;
      }
      
      const cellTag = isHeader ? 'th' : 'td';
      const rowHtml = cells.map(c => `<${cellTag}>${c}</${cellTag}>`).join('');
      tableHtml += `<tr>${rowHtml}</tr>`;
      
      if (isHeader) isHeader = false;
    }
    
    tableHtml += '</table>';
    return tableHtml;
  });
}

function processLists(html: string): string {
  // Process unordered lists
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
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push(`<li>${unorderedMatch[1]}</li>`);
    } else if (orderedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      result.push(`<li>${orderedMatch[1]}</li>`);
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

// Parse folder structure from file paths
// Structure: selected-folder/topic-folder/page.md OR selected-folder/page.md
function parseNestedStructure(files: { path: string; content: string }[]): {
  topics: Map<string, { files: { path: string; content: string }[] }>;
  rootFiles: { path: string; content: string }[];
} {
  const topics = new Map<string, { files: { path: string; content: string }[] }>();
  const rootFiles: { path: string; content: string }[] = [];
  
  // Find the common root folder (the selected folder name)
  let rootFolder = '';
  if (files.length > 0) {
    const firstPath = files[0].path;
    const firstParts = firstPath.split('/');
    if (firstParts.length > 1) {
      rootFolder = firstParts[0];
    }
  }
  
  for (const file of files) {
    // Get path parts and remove the root folder
    let pathParts = file.path.split('/');
    
    // Remove the root folder if it matches
    if (rootFolder && pathParts[0] === rootFolder) {
      pathParts = pathParts.slice(1);
    }
    
    // Remove the filename from parts
    const filename = pathParts.pop() || '';
    
    if (pathParts.length === 0) {
      // File directly in project folder (no topic)
      rootFiles.push(file);
    } else {
      // First folder becomes the topic (or combined path for nested)
      // e.g., "api" or "api/policies" becomes a topic
      const topicName = pathParts.join(' / ');
      if (!topics.has(topicName)) {
        topics.set(topicName, { files: [] });
      }
      topics.get(topicName)!.files.push(file);
    }
  }
  
  console.log(`Parsed structure: ${rootFiles.length} root files, ${topics.size} topics`);
  for (const [name, data] of topics) {
    console.log(`  Topic "${name}": ${data.files.length} files`);
  }
  
  return { topics, rootFiles };
}

// Helper to add delay between API calls
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create Google Doc with content
async function createGoogleDocWithContent(
  googleToken: string,
  title: string,
  htmlContent: string,
  parentFolderId: string
): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    // Step 1: Create the document
    const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: title,
        mimeType: "application/vnd.google-apps.document",
        parents: [parentFolderId],
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`Failed to create doc ${title}:`, errorText);
      return { id: '', success: false, error: `Create failed: ${createResponse.status}` };
    }

    const doc = await createResponse.json();
    
    // Step 2: Update the document with content using Google Docs API
    // Convert HTML to plain text for basic insertion (Google Docs API has limited HTML support)
    const plainText = htmlToPlainText(htmlContent);
    
    if (plainText.trim()) {
      const updateResponse = await fetch(
        `https://docs.googleapis.com/v1/documents/${doc.id}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: plainText,
                },
              },
            ],
          }),
        }
      );

      if (!updateResponse.ok) {
        console.warn(`Content insert failed for ${title}, doc created but empty`);
      }
    }

    return { id: doc.id, success: true };
  } catch (error) {
    console.error(`Error creating doc ${title}:`, error);
    return { id: '', success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Convert HTML to plain text with basic formatting preserved
function htmlToPlainText(html: string): string {
  let text = html;
  
  // Convert headers to plain text with line breaks
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n$1\n\n');
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n$1\n\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n$1\n\n');
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n$1\n\n');
  text = text.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n$1\n');
  text = text.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n$1\n');
  
  // Convert list items
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
  
  // Convert paragraphs
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  
  // Convert line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert blockquotes
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n');
  
  // Convert code blocks
  text = text.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n```\n$1\n```\n');
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  
  // Convert horizontal rules
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  
  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  
  return text;
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
    const { topics, rootFiles } = parseNestedStructure(files);
    
    console.log(`Found ${topics.size} topics and ${rootFiles.length} root files`);

    const results = {
      topicsCreated: 0,
      pagesCreated: 0,
      errors: [] as string[],
    };

    // Create topics and their pages
    for (const [topicName, topicData] of topics) {
      try {
        // Add delay to avoid rate limiting
        await delay(100);
        
        // Create topic folder in Google Drive
        const folderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: topicName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [project.drive_folder_id],
          }),
        });

        if (!folderResponse.ok) {
          const errorText = await folderResponse.text();
          console.error(`Failed to create folder for topic ${topicName}:`, errorText);
          results.errors.push(`Failed to create folder for topic: ${topicName}`);
          continue;
        }

        const folder = await folderResponse.json();
        
        // Create topic in database
        const { data: topic, error: topicError } = await supabase
          .from("topics")
          .insert({
            name: topicName,
            slug: generateSlug(topicName),
            project_id: projectId,
            drive_folder_id: folder.id,
          })
          .select()
          .single();

        if (topicError) {
          console.error(`Failed to create topic ${topicName}:`, topicError);
          results.errors.push(`Failed to create topic: ${topicName}`);
          continue;
        }

        results.topicsCreated++;
        console.log(`Created topic: ${topicName}`);

        // Create pages for this topic
        for (const file of topicData.files) {
          try {
            await delay(200); // Rate limiting delay
            
            const filename = file.path.split('/').pop() || 'Untitled';
            const title = extractTitle(file.content, filename);
            const htmlContent = markdownToHtml(file.content);

            // Create Google Doc with content
            const docResult = await createGoogleDocWithContent(
              googleToken,
              title,
              htmlContent,
              folder.id
            );

            if (!docResult.success) {
              results.errors.push(`Failed to create doc: ${title}`);
              continue;
            }

            // Create document in database with HTML content
            const { error: docError } = await supabase
              .from("documents")
              .insert({
                title,
                slug: generateSlug(title),
                google_doc_id: docResult.id,
                project_id: projectId,
                topic_id: topic.id,
                content_html: htmlContent,
                owner_id: user.id,
                visibility: "internal",
                is_published: false,
              });

            if (docError) {
              console.error(`Failed to save document ${title}:`, docError);
              results.errors.push(`Failed to save document: ${title}`);
              continue;
            }

            results.pagesCreated++;
            console.log(`Created page: ${title}`);
          } catch (err) {
            console.error(`Error processing file ${file.path}:`, err);
            results.errors.push(`Error processing file: ${file.path}`);
          }
        }
      } catch (err) {
        console.error(`Error creating topic ${topicName}:`, err);
        results.errors.push(`Error creating topic: ${topicName}`);
      }
    }

    // Create root-level pages
    for (const file of rootFiles) {
      try {
        await delay(200); // Rate limiting delay
        
        const filename = file.path.split('/').pop() || 'Untitled';
        const title = extractTitle(file.content, filename);
        const htmlContent = markdownToHtml(file.content);

        // Create Google Doc with content
        const docResult = await createGoogleDocWithContent(
          googleToken,
          title,
          htmlContent,
          project.drive_folder_id!
        );

        if (!docResult.success) {
          results.errors.push(`Failed to create doc: ${title}`);
          continue;
        }

        // Create document in database
        const { error: docError } = await supabase
          .from("documents")
          .insert({
            title,
            slug: generateSlug(title),
            google_doc_id: docResult.id,
            project_id: projectId,
            topic_id: null,
            content_html: htmlContent,
            owner_id: user.id,
            visibility: "internal",
            is_published: false,
          });

        if (docError) {
          console.error(`Failed to save document ${title}:`, docError);
          results.errors.push(`Failed to save document: ${title}`);
          continue;
        }

        results.pagesCreated++;
        console.log(`Created root page: ${title}`);
      } catch (err) {
        console.error(`Error processing file ${file.path}:`, err);
        results.errors.push(`Error processing file: ${file.path}`);
      }
    }

    console.log("Import complete:", results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
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
