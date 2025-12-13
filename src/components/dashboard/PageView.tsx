import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Share2,
  MoreHorizontal,
  Clock,
  User,
  Circle,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Trash2,
  Archive,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SharePanel } from "./SharePanel";

interface PageViewProps {
  onBack: () => void;
}

const mockPageData = {
  title: "API Authentication Guide",
  state: "active" as const,
  owner: "Sarah Kim",
  backupOwner: "Mike Rodriguez",
  lastVerified: "December 11, 2025",
  lastModified: "December 10, 2025",
  visibility: "public" as const,
  googleDocUrl: "https://docs.google.com/document/d/example",
};

const mockDocContent = `
# API Authentication Guide

This guide covers the authentication mechanisms available in our API, including OAuth 2.0, API keys, and JWT tokens.

## Overview

Our API supports multiple authentication methods to accommodate different use cases:

- **OAuth 2.0** - Recommended for user-facing applications
- **API Keys** - Suitable for server-to-server communication
- **JWT Tokens** - For stateless authentication

## OAuth 2.0 Authentication

OAuth 2.0 is our recommended authentication method for applications that act on behalf of users.

### Getting Started

1. Register your application in the Developer Portal
2. Obtain your client ID and client secret
3. Implement the authorization flow

### Authorization Code Flow

\`\`\`typescript
const authUrl = \`https://api.example.com/oauth/authorize?
  client_id=\${CLIENT_ID}&
  redirect_uri=\${REDIRECT_URI}&
  response_type=code&
  scope=read write\`;

// Redirect user to authUrl
window.location.href = authUrl;
\`\`\`

### Token Exchange

After the user authorizes your application, exchange the authorization code for tokens:

\`\`\`typescript
const response = await fetch('https://api.example.com/oauth/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
  }),
});

const { access_token, refresh_token } = await response.json();
\`\`\`

## API Key Authentication

For server-to-server communication, API keys provide a simpler authentication mechanism.

### Generating API Keys

1. Navigate to Settings → API Keys
2. Click "Generate New Key"
3. Store the key securely - it won't be shown again

### Using API Keys

Include your API key in the \`Authorization\` header:

\`\`\`bash
curl -X GET "https://api.example.com/v1/resources" \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

> **Security Note**: Never expose API keys in client-side code or public repositories.

## Rate Limiting

All authentication methods are subject to rate limiting:

| Plan       | Requests/minute | Requests/day |
|------------|-----------------|--------------|
| Free       | 60              | 1,000        |
| Pro        | 600             | 50,000       |
| Enterprise | 6,000           | Unlimited    |

## Error Handling

Common authentication errors:

- **401 Unauthorized** - Invalid or missing credentials
- **403 Forbidden** - Valid credentials but insufficient permissions
- **429 Too Many Requests** - Rate limit exceeded

## Need Help?

- Check our [FAQ](/docs/faq)
- Join our [Developer Community](https://community.example.com)
- Contact support at api-support@example.com
`;

const stateConfig = {
  active: { color: "bg-state-active", label: "Active" },
  draft: { color: "bg-state-draft", label: "Draft" },
  deprecated: { color: "bg-state-deprecated", label: "Deprecated" },
  archived: { color: "bg-state-archived", label: "Archived" },
};

export const PageView = ({ onBack }: PageViewProps) => {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Circle
                className={`w-2 h-2 ${stateConfig[mockPageData.state].color} rounded-full`}
              />
              <span className="text-sm text-muted-foreground">
                {stateConfig[mockPageData.state].label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => window.open(mockPageData.googleDocUrl, "_blank")}
            >
              <ExternalLink className="w-4 h-4" />
              Open in Drive
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Verified
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Edit3 className="w-4 h-4" />
                  Change State
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <User className="w-4 h-4" />
                  Change Owner
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2">
                  <Archive className="w-4 h-4" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" />
                  Remove from Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Page Meta */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-4">
                {mockPageData.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Owner: {mockPageData.owner}</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Verified: {mockPageData.lastVerified}</span>
                </div>
                {mockPageData.visibility === "public" && (
                  <>
                    <div className="h-4 w-px bg-border" />
                    <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      Public
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Document Content */}
            <article className="prose prose-invert prose-headings:text-foreground prose-p:text-secondary-foreground prose-strong:text-foreground prose-code:text-primary prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-a:text-primary prose-blockquote:border-primary prose-blockquote:text-muted-foreground prose-th:text-foreground prose-td:text-secondary-foreground max-w-none">
              <div className="rounded-xl border border-border bg-card/50 p-8">
                {/* Simulated rendered markdown */}
                <h1 className="text-2xl font-bold mb-4">API Authentication Guide</h1>
                
                <p className="text-secondary-foreground leading-relaxed mb-6">
                  This guide covers the authentication mechanisms available in our API, including OAuth 2.0, API keys, and JWT tokens.
                </p>

                <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">Overview</h2>
                <p className="text-secondary-foreground leading-relaxed mb-4">
                  Our API supports multiple authentication methods to accommodate different use cases:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-secondary-foreground mb-6">
                  <li><strong className="text-foreground">OAuth 2.0</strong> - Recommended for user-facing applications</li>
                  <li><strong className="text-foreground">API Keys</strong> - Suitable for server-to-server communication</li>
                  <li><strong className="text-foreground">JWT Tokens</strong> - For stateless authentication</li>
                </ul>

                <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">OAuth 2.0 Authentication</h2>
                <p className="text-secondary-foreground leading-relaxed mb-4">
                  OAuth 2.0 is our recommended authentication method for applications that act on behalf of users.
                </p>

                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Getting Started</h3>
                <ol className="list-decimal pl-6 space-y-2 text-secondary-foreground mb-6">
                  <li>Register your application in the Developer Portal</li>
                  <li>Obtain your client ID and client secret</li>
                  <li>Implement the authorization flow</li>
                </ol>

                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Authorization Code Flow</h3>
                <pre className="bg-secondary border border-border rounded-lg p-4 overflow-x-auto mb-6">
                  <code className="text-sm text-primary font-mono">{`const authUrl = \`https://api.example.com/oauth/authorize?
  client_id=\${CLIENT_ID}&
  redirect_uri=\${REDIRECT_URI}&
  response_type=code&
  scope=read write\`;

// Redirect user to authUrl
window.location.href = authUrl;`}</code>
                </pre>

                <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">API Key Authentication</h2>
                <p className="text-secondary-foreground leading-relaxed mb-4">
                  For server-to-server communication, API keys provide a simpler authentication mechanism.
                </p>

                <div className="bg-state-draft/10 border border-state-draft/30 rounded-lg p-4 my-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-state-draft shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-state-draft">Security Note</p>
                      <p className="text-sm text-secondary-foreground mt-1">
                        Never expose API keys in client-side code or public repositories.
                      </p>
                    </div>
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">Rate Limiting</h2>
                <p className="text-secondary-foreground leading-relaxed mb-4">
                  All authentication methods are subject to rate limiting:
                </p>

                <div className="overflow-x-auto mb-6">
                  <table className="w-full border border-border rounded-lg overflow-hidden">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Plan</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Requests/minute</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Requests/day</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="px-4 py-3 text-sm text-secondary-foreground">Free</td>
                        <td className="px-4 py-3 text-sm text-secondary-foreground">60</td>
                        <td className="px-4 py-3 text-sm text-secondary-foreground">1,000</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-secondary-foreground">Pro</td>
                        <td className="px-4 py-3 text-sm text-secondary-foreground">600</td>
                        <td className="px-4 py-3 text-sm text-secondary-foreground">50,000</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-secondary-foreground">Enterprise</td>
                        <td className="px-4 py-3 text-sm text-secondary-foreground">6,000</td>
                        <td className="px-4 py-3 text-sm text-secondary-foreground">Unlimited</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">Need Help?</h2>
                <ul className="list-disc pl-6 space-y-2 text-secondary-foreground">
                  <li>Check our <a href="#" className="text-primary hover:underline">FAQ</a></li>
                  <li>Join our <a href="#" className="text-primary hover:underline">Developer Community</a></li>
                  <li>Contact support at <a href="mailto:api-support@example.com" className="text-primary hover:underline">api-support@example.com</a></li>
                </ul>
              </div>
            </article>
          </div>
        </div>
      </div>

      <SharePanel
        open={shareOpen}
        onOpenChange={setShareOpen}
        pageTitle={mockPageData.title}
      />
    </>
  );
};
