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

// Convert Markdown to simple HTML (for Google Docs compatibility)
function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Code blocks (must be before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');
  
  // Tables
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').filter(c => c.trim());
    if (cells.some(c => /^[\-:]+$/.test(c.trim()))) {
      return ''; // Skip separator row
    }
    const cellHtml = cells.map(c => `<td>${c.trim()}</td>`).join('');
    return `<tr>${cellHtml}</tr>`;
  });
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');
  
  // Paragraphs (lines that aren't already wrapped)
  const lines = html.split('\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return line;
    return `<p>${line}</p>`;
  }).join('\n');
  
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  return html;
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
    .trim();
}

// Parse folder structure from file paths
function parseStructure(files: { path: string; content: string }[]): {
  topics: Map<string, string[]>; // topic name -> file indices
  rootFiles: number[]; // indices of files in root
} {
  const topics = new Map<string, string[]>();
  const rootFiles: number[] = [];
  
  files.forEach((file, index) => {
    const parts = file.path.split('/').filter(p => p);
    
    if (parts.length === 1) {
      // Root level file
      rootFiles.push(index);
    } else if (parts.length >= 2) {
      // File in a folder (folder becomes topic)
      const topicName = parts[0];
      if (!topics.has(topicName)) {
        topics.set(topicName, []);
      }
      topics.get(topicName)!.push(file.path);
    }
  });
  
  return { topics, rootFiles };
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

    // Parse folder structure
    const { topics, rootFiles } = parseStructure(files);
    
    const results = {
      topicsCreated: 0,
      pagesCreated: 0,
      errors: [] as string[],
    };

    // Create topics and their pages
    for (const [topicName, filePaths] of topics) {
      try {
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
          results.errors.push(`Failed to create topic: ${topicName}`);
          continue;
        }

        results.topicsCreated++;

        // Create pages for this topic
        for (const filePath of filePaths) {
          const file = files.find(f => f.path === filePath);
          if (!file) continue;

          try {
            const filename = filePath.split('/').pop() || 'Untitled';
            const title = extractTitle(file.content, filename);
            const htmlContent = markdownToHtml(file.content);

            // Create Google Doc
            const docResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${googleToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: title,
                mimeType: "application/vnd.google-apps.document",
                parents: [folder.id],
              }),
            });

            if (!docResponse.ok) {
              results.errors.push(`Failed to create doc: ${title}`);
              continue;
            }

            const doc = await docResponse.json();

            // Create document in database
            const { error: docError } = await supabase
              .from("documents")
              .insert({
                title,
                slug: generateSlug(title),
                google_doc_id: doc.id,
                project_id: projectId,
                topic_id: topic.id,
                content_html: htmlContent,
                owner_id: user.id,
                visibility: "internal",
                is_published: false,
              });

            if (docError) {
              results.errors.push(`Failed to save document: ${title}`);
              continue;
            }

            results.pagesCreated++;
          } catch (err) {
            results.errors.push(`Error processing file: ${filePath}`);
          }
        }
      } catch (err) {
        results.errors.push(`Error creating topic: ${topicName}`);
      }
    }

    // Create root-level pages
    for (const index of rootFiles) {
      const file = files[index];
      try {
        const filename = file.path.split('/').pop() || 'Untitled';
        const title = extractTitle(file.content, filename);
        const htmlContent = markdownToHtml(file.content);

        // Create Google Doc
        const docResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: title,
            mimeType: "application/vnd.google-apps.document",
            parents: [project.drive_folder_id],
          }),
        });

        if (!docResponse.ok) {
          results.errors.push(`Failed to create doc: ${title}`);
          continue;
        }

        const doc = await docResponse.json();

        // Create document in database
        const { error: docError } = await supabase
          .from("documents")
          .insert({
            title,
            slug: generateSlug(title),
            google_doc_id: doc.id,
            project_id: projectId,
            topic_id: null,
            content_html: htmlContent,
            owner_id: user.id,
            visibility: "internal",
            is_published: false,
          });

        if (docError) {
          results.errors.push(`Failed to save document: ${title}`);
          continue;
        }

        results.pagesCreated++;
      } catch (err) {
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
