import { describe, expect, it } from "vitest";
import { normalizeHtml } from "@/lib/htmlNormalizer";

describe("normalizeHtml", () => {
  it("converts fenced code paragraphs into semantic pre/code blocks", () => {
    const input = `
      <p>\`\`\`js</p>
      <p>const answer = 42;</p>
      <p>\`\`\`</p>
    `;

    const output = normalizeHtml(input);

    expect(output).toContain("<pre");
    expect(output).toContain('data-language="js"');
    expect(output).toContain('class="language-js"');
    expect(output).toContain("const answer = 42;");
  });

  it("preserves semantic language classes on code blocks", () => {
    const input = `<pre><code class="language-ts">const ok: boolean = true;</code></pre>`;
    const output = normalizeHtml(input);

    expect(output).toContain('class="language-ts"');
  });

  it("converts markdown-like list paragraphs into unordered lists", () => {
    const input = `<p>- One</p><p>- Two</p><p>- Three</p>`;
    const output = normalizeHtml(input);

    expect(output).toContain("<ul>");
    expect(output).toContain("<li>One</li>");
    expect(output).toContain("<li>Two</li>");
    expect(output).toContain("<li>Three</li>");
  });

  it("wraps tables in responsive table-wrapper containers", () => {
    const input = `
      <table>
        <tr><th>Name</th><th>Value</th></tr>
        <tr><td>Foo</td><td>Bar</td></tr>
      </table>
    `;
    const output = normalizeHtml(input);

    expect(output).toContain('class="table-wrapper"');
    expect(output).toContain("<table>");
  });
});
