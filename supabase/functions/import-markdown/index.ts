import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks (available in Supabase Edge Functions)
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void } | undefined;

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

// Helper to add delay between API calls (reduced for large imports)
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Batch size for processing files
const BATCH_SIZE = 5;

// Parse markdown to structured elements for Google Docs API
function parseMarkdownToElements(markdown: string): Array<{
  type: 'heading' | 'paragraph' | 'bullet' | 'numbered' | 'code' | 'blockquote';
  level?: number;
  text: string;
}> {
  const elements: Array<{
    type: 'heading' | 'paragraph' | 'bullet' | 'numbered' | 'code' | 'blockquote';
    level?: number;
    text: string;
  }> = [];
  
  // Remove frontmatter
  let content = markdown.replace(/^---[\s\S]*?---\n*/m, '');
  
  // Split into lines but handle code blocks specially
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockContent = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push({ type: 'code', text: codeBlockContent.trim() });
        codeBlockContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }
    
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Headers
    const h1Match = trimmedLine.match(/^# (.+)$/);
    const h2Match = trimmedLine.match(/^## (.+)$/);
    const h3Match = trimmedLine.match(/^### (.+)$/);
    const h4Match = trimmedLine.match(/^#### (.+)$/);
    
    if (h1Match) {
      elements.push({ type: 'heading', level: 1, text: h1Match[1] });
    } else if (h2Match) {
      elements.push({ type: 'heading', level: 2, text: h2Match[1] });
    } else if (h3Match) {
      elements.push({ type: 'heading', level: 3, text: h3Match[1] });
    } else if (h4Match) {
      elements.push({ type: 'heading', level: 4, text: h4Match[1] });
    }
    // Unordered lists
    else if (trimmedLine.match(/^[-*+]\s+(.+)$/)) {
      const match = trimmedLine.match(/^[-*+]\s+(.+)$/);
      elements.push({ type: 'bullet', text: match![1] });
    }
    // Ordered lists
    else if (trimmedLine.match(/^\d+\.\s+(.+)$/)) {
      const match = trimmedLine.match(/^\d+\.\s+(.+)$/);
      elements.push({ type: 'numbered', text: match![1] });
    }
    // Blockquotes
    else if (trimmedLine.startsWith('> ')) {
      elements.push({ type: 'blockquote', text: trimmedLine.slice(2) });
    }
    // Regular paragraph
    else {
      elements.push({ type: 'paragraph', text: trimmedLine });
    }
  }
  
  return elements;
}

// Clean inline markdown formatting
function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/___(.+?)___/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

// Create Google Doc with simple text content (more reliable for large imports)
async function createGoogleDocWithContent(
  googleToken: string,
  title: string,
  htmlContent: string,
  parentFolderId: string,
  originalMarkdown?: string
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
    
    // Step 2: Add plain text content (simpler, more reliable for large imports)
    if (originalMarkdown && originalMarkdown.trim()) {
      // Clean markdown for readability in Google Docs
      const cleanContent = originalMarkdown
        .replace(/^---[\s\S]*?---\n*/m, '') // Remove frontmatter
        .trim();
      
      if (cleanContent) {
        const updateResponse = await fetch(
          `https://docs.googleapis.com/v1/documents/${doc.id}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${googleToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: [{
                insertText: {
                  location: { index: 1 },
                  text: cleanContent,
                },
              }],
            }),
          }
        );

        if (!updateResponse.ok) {
          console.warn(`Content insert failed for ${title}, doc created empty`);
        }
      }
    }

    return { id: doc.id, success: true };
  } catch (error) {
    console.error(`Error creating doc ${title}:`, error);
    return { id: '', success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
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
      // Continue anyway, just without progress tracking
    }
    
    const jobId = importJob?.id;
    console.log(`Created import job ${jobId} for ${totalFiles} files`);
    
    // Start background processing with progress tracking
    const backgroundTask = async () => {
      try {
        await processImportWithProgress(
          supabase, 
          project, 
          googleToken, 
          topics, 
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
      // Fallback: run inline but don't await
      backgroundTask().catch(err => console.error("Background import failed:", err));
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId,
        message: `Import started for ${totalFiles} files.`,
        estimatedTopics: topics.size,
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

// Import processing function with progress tracking
async function processImportWithProgress(
  supabase: any,
  project: { drive_folder_id: string; name: string },
  googleToken: string,
  topics: Map<string, { files: { path: string; content: string }[] }>,
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

  // Helper to update job progress
  const updateProgress = async (currentFile?: string) => {
    if (!jobId) return;
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

  // Create topics and their pages
  for (const [topicName, topicData] of topics) {
    try {
      await delay(50);
      await updateProgress(`Creating topic: ${topicName}`);
      
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
        results.errors.push(`Failed to create folder: ${topicName}`);
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
          await delay(50);
          
          const filename = file.path.split('/').pop() || 'Untitled';
          const title = extractTitle(file.content, filename);
          
          await updateProgress(`Creating: ${title}`);
          
          const htmlContent = markdownToHtml(file.content);

          const docResult = await createGoogleDocWithContent(
            googleToken,
            title,
            htmlContent,
            folder.id,
            file.content
          );

          if (!docResult.success) {
            results.errors.push(`Failed to create doc: ${title}`);
            results.processedFiles++;
            await updateProgress();
            continue;
          }

          const { error: docError } = await supabase
            .from("documents")
            .insert({
              title,
              slug: generateSlug(title),
              google_doc_id: docResult.id,
              project_id: projectId,
              topic_id: topic.id,
              content_html: htmlContent,
              owner_id: userId,
              visibility: "internal",
              is_published: false,
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
    } catch (err) {
      console.error(`Error creating topic ${topicName}:`, err);
      results.errors.push(`Error creating topic: ${topicName}`);
    }
  }

  // Create root-level pages
  for (const file of rootFiles) {
    try {
      await delay(50);
      
      const filename = file.path.split('/').pop() || 'Untitled';
      const title = extractTitle(file.content, filename);
      
      await updateProgress(`Creating: ${title}`);
      
      const htmlContent = markdownToHtml(file.content);

      const docResult = await createGoogleDocWithContent(
        googleToken,
        title,
        htmlContent,
        project.drive_folder_id!,
        file.content
      );

      if (!docResult.success) {
        results.errors.push(`Failed to create doc: ${title}`);
        results.processedFiles++;
        await updateProgress();
        continue;
      }

      const { error: docError } = await supabase
        .from("documents")
        .insert({
          title,
          slug: generateSlug(title),
          google_doc_id: docResult.id,
          project_id: projectId,
          topic_id: null,
          content_html: htmlContent,
          owner_id: userId,
          visibility: "internal",
          is_published: false,
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

  // Mark job as complete
  if (jobId) {
    await supabase
      .from("import_jobs")
      .update({
        status: 'completed',
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

  console.log("Import complete:", results);
}