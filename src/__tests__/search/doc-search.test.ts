import { describe, expect, it } from "vitest";
import { searchDocs } from "@/lib/docSearch";

describe("docSearch", () => {
  const projects = [
    { id: "p1", name: "Resume" },
    { id: "p2", name: "Product" },
  ];

  const topics = [
    { id: "t1", name: "Getting Started", project_id: "p1" },
    { id: "t2", name: "API", project_id: "p2" },
  ];

  const documents = [
    {
      id: "d1",
      title: "Quickstart",
      project_id: "p1",
      topic_id: "t1",
      content_html: "<p>Install the CLI and run your first command.</p>",
    },
    {
      id: "d2",
      title: "API Authentication",
      project_id: "p2",
      topic_id: "t2",
      content_html: "<p>Use bearer tokens for auth.</p>",
    },
  ];

  it("finds pages by content text, not only title", () => {
    const results = searchDocs({ query: "first command", documents, topics, projects });
    expect(results.some((result) => result.type === "page" && result.id === "d1")).toBe(true);
  });

  it("ranks title matches above content-only matches", () => {
    const results = searchDocs({ query: "api", documents, topics, projects });
    const pageResults = results.filter((result) => result.type === "page");
    expect(pageResults[0]?.id).toBe("d2");
  });

  it("returns topic and project hits as well", () => {
    const results = searchDocs({ query: "resume", documents, topics, projects });
    expect(results.some((result) => result.type === "project" && result.id === "p1")).toBe(true);
  });

  it("sanitizes html in query before searching", () => {
    const results = searchDocs({ query: "<script>api</script>", documents, topics, projects });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.id === "d2")).toBe(true);
  });
});
