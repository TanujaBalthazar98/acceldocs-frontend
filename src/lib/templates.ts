/**
 * Built-in documentation templates.
 *
 * Each template provides a ready-to-use markdown document structure
 * that the user can customise after creation.
 */

export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji for quick visual identification
  category: "getting-started" | "reference" | "guides" | "release" | "support";
  content: string;
}

export const DOC_TEMPLATES: DocTemplate[] = [
  // ── Getting started ─────────────────────────────────────────────────
  {
    id: "getting-started",
    name: "Getting Started",
    description: "Introductory guide for new users",
    icon: "🚀",
    category: "getting-started",
    content: `# Getting Started with [Product Name]

Welcome to [Product Name]! This guide will walk you through everything you need to get up and running in minutes.

## Prerequisites

Before you begin, make sure you have:

- [Requirement 1] installed (version X or higher)
- A [Product Name] account — [sign up here](https://example.com/signup)
- [Any other requirement]

## Step 1: Installation

\`\`\`bash
# Install via package manager
npm install @your-org/product-name

# Or with yarn
yarn add @your-org/product-name
\`\`\`

## Step 2: Configuration

Create a configuration file in the root of your project:

\`\`\`yaml
# config.yaml
api_key: YOUR_API_KEY
environment: production
\`\`\`

> **Tip:** Never commit your API key to version control. Use environment variables instead.

## Step 3: Your First [Action]

Here's a minimal example to verify your setup is working:

\`\`\`javascript
const client = new ProductClient({ apiKey: process.env.API_KEY });

const result = await client.doSomething({
  param: 'value',
});

console.log(result);
\`\`\`

## Next Steps

Once you're set up, explore:

- [Core Concepts](./core-concepts) — understand the key ideas
- [API Reference](./api-reference) — full API documentation
- [Tutorials](./tutorials) — step-by-step walkthroughs
- [Examples](./examples) — real-world code samples

## Need Help?

- Browse our [FAQ](./faq)
- Join our [community](https://community.example.com)
- [Contact support](mailto:support@example.com)
`,
  },

  // ── API Reference ───────────────────────────────────────────────────
  {
    id: "api-reference",
    name: "API Reference",
    description: "Document an API endpoint or method",
    icon: "⚙️",
    category: "reference",
    content: `# [Endpoint Name] API

## Overview

Brief description of what this endpoint does and when to use it.

**Base URL:** \`https://api.example.com/v1\`

**Authentication:** Bearer token required in the \`Authorization\` header.

---

## Endpoints

### \`GET /resource\`

Returns a list of resources.

**Request**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`limit\` | integer | No | Max items to return (default: 20, max: 100) |
| \`offset\` | integer | No | Number of items to skip (for pagination) |
| \`filter\` | string | No | Filter expression |

**Example Request**

\`\`\`bash
curl -X GET "https://api.example.com/v1/resource?limit=10" \\
  -H "Authorization: Bearer YOUR_TOKEN"
\`\`\`

**Response**

\`\`\`json
{
  "data": [
    {
      "id": "res_123",
      "name": "Example resource",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 42,
    "limit": 10,
    "offset": 0
  }
}
\`\`\`

**Response Codes**

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad request — check your parameters |
| 401 | Unauthorized — invalid or missing token |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

### \`POST /resource\`

Creates a new resource.

**Request Body**

\`\`\`json
{
  "name": "string (required)",
  "description": "string (optional)",
  "settings": {
    "key": "value"
  }
}
\`\`\`

**Example**

\`\`\`bash
curl -X POST "https://api.example.com/v1/resource" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My resource"}'
\`\`\`

---

## Rate Limits

| Plan | Requests per minute |
|------|-------------------|
| Free | 60 |
| Pro | 600 |
| Enterprise | Unlimited |

---

## SDKs

- [JavaScript/TypeScript SDK](./sdk-js)
- [Python SDK](./sdk-python)
- [Go SDK](./sdk-go)
`,
  },

  // ── How-to guide ────────────────────────────────────────────────────
  {
    id: "how-to-guide",
    name: "How-To Guide",
    description: "Step-by-step guide for a specific task",
    icon: "📋",
    category: "guides",
    content: `# How to [Accomplish a Task]

**Time to complete:** ~X minutes
**Difficulty:** Beginner / Intermediate / Advanced
**Prerequisites:** [List any prerequisites]

## Overview

A brief paragraph explaining what this guide covers and what the reader will achieve by the end.

## Before You Begin

Make sure you have:

- [ ] [Prerequisite 1]
- [ ] [Prerequisite 2]
- [ ] Access to [some service/tool]

## Step 1: [First Action]

Describe what to do in this step. Be specific and clear.

\`\`\`bash
command --flag value
\`\`\`

You should see output similar to:

\`\`\`
Expected output here
\`\`\`

> **Note:** If you see an error, [troubleshooting tip].

## Step 2: [Second Action]

Continue with the next logical step. Include screenshots or diagrams if helpful.

## Step 3: [Verify It Worked]

After completing the steps above, verify your setup by running:

\`\`\`bash
verification-command
\`\`\`

Expected result: [What success looks like]

## Common Issues

### Issue: [Error message or problem]

**Cause:** Why this happens.

**Solution:** How to fix it.

---

### Issue: [Another common problem]

**Cause:** Why this happens.

**Solution:** How to fix it.

## Related Guides

- [Related topic 1](./related-1)
- [Related topic 2](./related-2)
`,
  },

  // ── Changelog ───────────────────────────────────────────────────────
  {
    id: "changelog",
    name: "Changelog",
    description: "Release notes / changelog entry",
    icon: "📝",
    category: "release",
    content: `# Changelog

All notable changes to this project are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
-

### Changed
-

### Fixed
-

---

## [2.1.0] — 2024-01-15

### Added

- **New feature**: Brief description of the feature and its benefit (#123)
- Support for [thing] — users can now [action] ([documentation](./feature-doc))
- Added \`new_field\` to the [Resource] API response

### Changed

- Improved performance of [operation] by ~40%
- Updated [dependency] from v1.x to v2.x (see [migration guide](./migration))
- Renamed \`old_name\` to \`new_name\` in the configuration file

### Deprecated

- \`old_endpoint\` will be removed in v3.0. Use \`new_endpoint\` instead.

### Fixed

- Fixed crash when [condition] (#456)
- Resolved issue where [thing] would [incorrect behavior] (#789)
- Corrected typo in error message for [scenario]

---

## [2.0.0] — 2023-11-01

### Breaking Changes

- Removed \`legacy_param\` from [API endpoint] — use \`new_param\` instead
- Changed authentication method from API keys to OAuth 2.0 tokens

### Added

- Complete rewrite of the [component] for better performance
- New [feature set]

### Migration Guide

See the [v2.0 migration guide](./v2-migration) for step-by-step instructions.

---

## [1.5.0] — 2023-08-20

### Added

- Initial release of [feature]
`,
  },

  // ── Troubleshooting ─────────────────────────────────────────────────
  {
    id: "troubleshooting",
    name: "Troubleshooting",
    description: "Common errors and how to fix them",
    icon: "🔧",
    category: "support",
    content: `# Troubleshooting Guide

This page covers the most common issues users encounter and how to resolve them.

If your issue isn't listed here, please [contact support](mailto:support@example.com) or [open a GitHub issue](https://github.com/your-org/repo/issues).

---

## Installation Issues

### Error: "Cannot find module" or "Module not found"

**Symptoms:** You see an error like \`Cannot find module '@your-org/package'\` when running your application.

**Causes:**
- Package not installed
- Wrong version installed
- Corrupted \`node_modules\`

**Solution:**

1. Delete \`node_modules\` and reinstall:
   \`\`\`bash
   rm -rf node_modules package-lock.json
   npm install
   \`\`\`

2. Verify the package is listed in \`package.json\`:
   \`\`\`bash
   npm list @your-org/package
   \`\`\`

---

## Authentication Errors

### Error: 401 Unauthorized

**Symptoms:** API calls return \`401 Unauthorized\`.

**Causes:**
- Missing or expired API token
- Token passed in wrong header format

**Solution:**

Ensure you're passing the token correctly:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.example.com/v1/endpoint
\`\`\`

Make sure your token hasn't expired. Generate a new one in your [account settings](https://app.example.com/settings/tokens).

---

### Error: 403 Forbidden

**Symptoms:** API calls return \`403 Forbidden\`.

**Cause:** Your account doesn't have permission to perform the action.

**Solution:** Contact your workspace admin to request the appropriate role.

---

## Performance Issues

### Slow response times

**Symptoms:** API calls taking longer than expected.

**Common causes:**
1. Large payload size — paginate your requests
2. Inefficient queries — use filters to narrow results
3. Rate limiting — check your current usage against plan limits

**Solution:**

\`\`\`javascript
// Instead of fetching everything:
const all = await client.list();

// Fetch in pages:
const page1 = await client.list({ limit: 100, offset: 0 });
const page2 = await client.list({ limit: 100, offset: 100 });
\`\`\`

---

## Still Need Help?

1. Check our [FAQ](./faq)
2. Search our [community forum](https://community.example.com)
3. [Open a support ticket](mailto:support@example.com)
4. For critical issues, use our [emergency contact](./support#emergency)
`,
  },

  // ── Concept / Explanation ───────────────────────────────────────────
  {
    id: "concept",
    name: "Concept / Explanation",
    description: "Explain a concept, architecture, or how something works",
    icon: "💡",
    category: "reference",
    content: `# [Concept Name]

## What Is [Concept]?

A clear, jargon-free explanation of the concept in 1–3 sentences. Assume the reader knows the basics of the domain but not this specific concept.

## Why Does It Matter?

Explain the problem this concept solves, or why understanding it is important for using the product effectively.

## How It Works

Use a diagram or analogy to make it concrete. Then go deeper.

### Key Components

| Component | Role |
|-----------|------|
| [Component A] | [What it does] |
| [Component B] | [What it does] |
| [Component C] | [What it does] |

### The Lifecycle

1. **Initialization** — [What happens first]
2. **Processing** — [What happens next]
3. **Output** — [What the result is]
4. **Cleanup** — [What happens at the end]

## Examples

### Basic Example

\`\`\`javascript
// Minimal example demonstrating the concept
const example = new ConceptClass({
  option: 'value',
});

const result = await example.run();
\`\`\`

### Real-World Use Case

Describe a realistic scenario where this concept is applied.

## Common Misconceptions

### Misconception 1: "[Common wrong belief]"

**Reality:** [The correct understanding]

### Misconception 2: "[Another wrong belief]"

**Reality:** [The correct understanding]

## Further Reading

- [Related concept](./related)
- [Technical deep-dive](./deep-dive)
- [External resource](https://external.com)
`,
  },
];

export function getTemplateById(id: string): DocTemplate | undefined {
  return DOC_TEMPLATES.find((t) => t.id === id);
}

export const TEMPLATE_CATEGORIES: Record<DocTemplate["category"], string> = {
  "getting-started": "Getting Started",
  reference: "Reference",
  guides: "Guides",
  release: "Release Notes",
  support: "Support",
};
