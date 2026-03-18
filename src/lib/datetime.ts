const TZ_SUFFIX_RE = /(z|[+-]\d{2}:\d{2})$/i;

function normalizeApiTimestamp(value: string): string {
  let normalized = value.trim();
  if (!normalized) return normalized;

  // Common SQLite shape is "YYYY-MM-DD HH:mm:ss(.sss)" (naive UTC).
  if (normalized.includes(" ") && !normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }

  // Treat timezone-less API timestamps as UTC to avoid local-time skew.
  if (!TZ_SUFFIX_RE.test(normalized)) {
    normalized = `${normalized}Z`;
  }

  return normalized;
}

export function parseApiDate(value: string | null | undefined, fallbackToNow = true): Date | null {
  if (!value || typeof value !== "string") {
    return fallbackToNow ? new Date() : null;
  }

  const normalized = normalizeApiTimestamp(value);
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  return fallbackToNow ? new Date() : null;
}
