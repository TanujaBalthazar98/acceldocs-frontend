import { useState } from "react";
import { Code, Copy, Check, ChevronDown, ChevronRight, Server, Key, Zap, Shield, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface MCPDocsProps {
  projectName?: string;
  orgName?: string;
}

const mcpSections = [
  {
    id: "overview",
    title: "Overview",
    icon: Server,
    content: `
# Model Context Protocol (MCP)

MCP is an open protocol that standardizes how applications provide context to LLMs. 
This documentation describes how to integrate with our MCP server to access project resources.

## Key Concepts

- **Resources**: Expose data like documents, topics, and project metadata
- **Tools**: Enable LLM-powered actions like search and document retrieval
- **Prompts**: Pre-defined prompt templates for common tasks
    `,
  },
  {
    id: "authentication",
    title: "Authentication",
    icon: Key,
    content: `
# Authentication

All MCP requests require authentication via Bearer token.

\`\`\`typescript
const client = new MCPClient({
  serverUrl: "https://api.example.com/mcp",
  auth: {
    type: "bearer",
    token: "your-api-token"
  }
});
\`\`\`

## Obtaining an API Token

1. Go to Project Settings → API Access
2. Click "Generate API Token"
3. Copy the token and store it securely
    `,
  },
  {
    id: "resources",
    title: "Resources",
    icon: FileJson,
    content: `
# Available Resources

## Documents
Access published documentation pages.

\`\`\`typescript
// List all documents
const docs = await client.listResources("documents");

// Get specific document
const doc = await client.readResource("documents/page-slug");
\`\`\`

## Topics
Navigate the documentation structure.

\`\`\`typescript
// List all topics
const topics = await client.listResources("topics");

// Get topic with children
const topic = await client.readResource("topics/topic-slug");
\`\`\`
    `,
  },
  {
    id: "tools",
    title: "Tools",
    icon: Zap,
    content: `
# Available Tools

## search_docs
Search across all published documentation.

\`\`\`typescript
const results = await client.callTool("search_docs", {
  query: "authentication setup",
  limit: 10
});
\`\`\`

## get_document
Retrieve a specific document by ID or slug.

\`\`\`typescript
const doc = await client.callTool("get_document", {
  slug: "getting-started"
});
\`\`\`

## list_topics
Get the documentation structure.

\`\`\`typescript
const structure = await client.callTool("list_topics", {
  includeDocuments: true
});
\`\`\`
    `,
  },
  {
    id: "security",
    title: "Security",
    icon: Shield,
    content: `
# Security Considerations

## Rate Limiting
- 100 requests per minute per API key
- 1000 requests per hour per API key

## Access Control
- Only published documents are accessible
- Respect visibility settings (public/internal/external)
- Tokens can be scoped to specific projects

## Best Practices
- Never expose API tokens in client-side code
- Rotate tokens regularly
- Use the minimum required permissions
    `,
  },
];

export const MCPDocs = ({ projectName, orgName }: MCPDocsProps) => {
  const [expandedSections, setExpandedSections] = useState<string[]>(["overview"]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const renderContent = (content: string) => {
    // Simple markdown-like rendering
    const lines = content.trim().split("\n");
    const elements: JSX.Element[] = [];
    let codeBlock = false;
    let codeContent = "";
    let codeId = "";

    lines.forEach((line, i) => {
      if (line.startsWith("```")) {
        if (codeBlock) {
          // End code block
          codeId = `code-${i}`;
          elements.push(
            <div key={i} className="relative group my-4">
              <pre className="bg-secondary border border-border rounded-lg p-4 overflow-x-auto">
                <code className="text-sm text-foreground font-mono">{codeContent.trim()}</code>
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={() => copyToClipboard(codeContent.trim(), codeId)}
              >
                {copiedCode === codeId ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          );
          codeContent = "";
          codeBlock = false;
        } else {
          // Start code block
          codeBlock = true;
        }
      } else if (codeBlock) {
        codeContent += line + "\n";
      } else if (line.startsWith("# ")) {
        elements.push(
          <h1 key={i} className="text-2xl font-bold text-foreground mt-6 mb-4">
            {line.slice(2)}
          </h1>
        );
      } else if (line.startsWith("## ")) {
        elements.push(
          <h2 key={i} className="text-xl font-semibold text-foreground mt-6 mb-3">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith("- ")) {
        elements.push(
          <li key={i} className="text-muted-foreground ml-4 my-1">
            {line.slice(2)}
          </li>
        );
      } else if (line.trim()) {
        elements.push(
          <p key={i} className="text-muted-foreground my-2">
            {line}
          </p>
        );
      }
    });

    return elements;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Code className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">MCP Integration</h1>
            <p className="text-muted-foreground">
              Model Context Protocol for {projectName || "this project"}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          Protocol Version: 1.0
        </Badge>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {mcpSections.map((section) => (
          <Collapsible
            key={section.id}
            open={expandedSections.includes(section.id)}
            onOpenChange={() => toggleSection(section.id)}
          >
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors",
                  expandedSections.includes(section.id) && "border-primary/50 bg-accent/30"
                )}
              >
                <section.icon className="h-5 w-5 text-primary shrink-0" />
                <span className="font-medium text-foreground flex-1 text-left">
                  {section.title}
                </span>
                {expandedSections.includes(section.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-6 border-x border-b border-border rounded-b-lg bg-card/50">
                {renderContent(section.content)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
};
