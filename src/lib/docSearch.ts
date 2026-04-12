export interface SearchDocument {
  id: string;
  title: string;
  project_id: string;
  topic_id?: string | null;
  content_html?: string | null;
}

export interface SearchTopic {
  id: string;
  name: string;
  project_id: string;
}

export interface SearchProject {
  id: string;
  name: string;
}

export interface SearchResult {
  id: string;
  title: string;
  type: "page" | "topic" | "project";
  projectName?: string;
  topicName?: string;
  snippet?: string;
}

interface RankedResult {
  result: SearchResult;
  score: number;
}

const MAX_RESULTS = 15;

const normalizeSearchText = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const sanitizeQuery = (value: string): string =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const stripHtml = (value?: string | null): string =>
  (value || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|li|h[1-6]|div|tr|blockquote|pre)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractSnippet = (text: string, query: string): string | undefined => {
  if (!text) return undefined;
  const hay = normalizeSearchText(text);
  const needle = normalizeSearchText(query);
  if (!needle) return undefined;
  const index = hay.indexOf(needle);
  if (index < 0) return undefined;
  const raw = text.replace(/\s+/g, " ").trim();
  const start = Math.max(0, index - 60);
  const end = Math.min(raw.length, index + needle.length + 90);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < raw.length ? "..." : "";
  return `${prefix}${raw.slice(start, end).trim()}${suffix}`;
};

const scoreText = (text: string, phrase: string, tokens: string[]): number => {
  if (!text) return 0;
  const normalized = normalizeSearchText(text);
  if (!normalized) return 0;
  const words = normalized.split(" ").filter(Boolean);

  let score = 0;
  let tokenMatches = 0;

  if (normalized === phrase) score += 120;
  else if (normalized.startsWith(phrase)) score += 80;
  else if (normalized.includes(phrase)) score += 45;

  for (const token of tokens) {
    if (!token) continue;
    if (normalized === token) {
      score += 24;
      tokenMatches += 1;
      continue;
    }

    if (normalized.startsWith(token)) {
      score += 14;
      tokenMatches += 1;
      continue;
    }

    if (normalized.includes(token)) {
      score += 8;
      tokenMatches += 1;
      continue;
    }

    // Soft fuzzy matching for near-prefix tokens in compound words.
    if (token.length >= 3 && words.some((word) => word.startsWith(token.slice(0, token.length - 1)))) {
      score += 4;
      tokenMatches += 1;
    }
  }

  if (tokens.length > 0) {
    if (tokenMatches === tokens.length) {
      score += 18;
    } else if (tokenMatches > 0) {
      score += tokenMatches * 4;
    }

    // Reward phrases where tokens appear in-order within the text.
    if (tokens.length > 1) {
      let cursor = -1;
      let inOrder = true;
      for (const token of tokens) {
        const index = normalized.indexOf(token, cursor + 1);
        if (index < 0) {
          inOrder = false;
          break;
        }
        cursor = index;
      }
      if (inOrder) score += 16;
    }
  }

  return score;
};

export function searchDocs({
  query,
  documents,
  topics,
  projects,
  limit = MAX_RESULTS,
}: {
  query: string;
  documents: SearchDocument[];
  topics: SearchTopic[];
  projects: SearchProject[];
  limit?: number;
}): SearchResult[] {
  const sanitized = sanitizeQuery(query);
  if (!sanitized || sanitized.length < 2) return [];

  const phrase = normalizeSearchText(sanitized);
  const tokens = phrase.split(" ").filter((token) => token.length > 1);

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const results: RankedResult[] = [];

  for (const project of projects) {
    const score = scoreText(project.name, phrase, tokens);
    if (!score) continue;
    results.push({
      score: score + 20,
      result: {
        id: project.id,
        title: project.name,
        type: "project",
      },
    });
  }

  for (const topic of topics) {
    const project = projectById.get(topic.project_id);
    const score =
      scoreText(topic.name, phrase, tokens) +
      scoreText(project?.name || "", phrase, tokens) * 0.25;
    if (!score) continue;
    results.push({
      score: score + 12,
      result: {
        id: topic.id,
        title: topic.name,
        type: "topic",
        projectName: project?.name,
      },
    });
  }

  for (const document of documents) {
    const project = projectById.get(document.project_id);
    const topic = document.topic_id ? topicById.get(document.topic_id) : undefined;
    const contentText = stripHtml(document.content_html);

    const titleScore = scoreText(document.title, phrase, tokens) * 1.4;
    const topicScore = scoreText(topic?.name || "", phrase, tokens) * 0.7;
    const projectScore = scoreText(project?.name || "", phrase, tokens) * 0.4;
    const contentScore = scoreText(contentText, phrase, tokens) * 0.45;
    const score = titleScore + topicScore + projectScore + contentScore;
    if (!score) continue;

    results.push({
      score: score + 35,
      result: {
        id: document.id,
        title: document.title,
        type: "page",
        projectName: project?.name,
        topicName: topic?.name,
        snippet: extractSnippet(contentText, sanitized),
      },
    });
  }

  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const typeRank = (value: SearchResult["type"]) => (value === "page" ? 0 : value === "topic" ? 1 : 2);
      const rankDiff = typeRank(a.result.type) - typeRank(b.result.type);
      if (rankDiff !== 0) return rankDiff;
      return a.result.title.localeCompare(b.result.title);
    })
    .slice(0, limit)
    .map((entry) => entry.result);
}
