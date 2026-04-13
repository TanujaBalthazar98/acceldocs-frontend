import yaml from "js-yaml";

type JsonLike = Record<string, unknown>;

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
]);

export interface OpenApiSpecMeta {
  title: string;
  version: string;
  operationCount: number;
  pathCount: number;
  warnings: string[];
  format: "json" | "yaml";
}

export interface ParsedOpenApiSpec {
  spec: JsonLike;
  meta: OpenApiSpecMeta;
}

const isPlainObject = (value: unknown): value is JsonLike =>
  !!value && typeof value === "object" && !Array.isArray(value);

// Remove problematic control characters before serialization.
const sanitizeForJson = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForJson);
  }
  if (isPlainObject(value)) {
    const sanitized: JsonLike = {};
    for (const [key, nested] of Object.entries(value)) {
      sanitized[key] = sanitizeForJson(nested);
    }
    return sanitized;
  }
  return value;
};

const parseRawSpec = (rawText: string): { data: unknown; format: "json" | "yaml" } => {
  try {
    return { data: JSON.parse(rawText), format: "json" };
  } catch {
    try {
      return { data: yaml.load(rawText), format: "yaml" };
    } catch {
      throw new Error("Could not parse specification. Provide valid JSON or YAML.");
    }
  }
};

const parseVersion = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const buildMeta = (spec: JsonLike, format: "json" | "yaml"): OpenApiSpecMeta => {
  const info = isPlainObject(spec.info) ? spec.info : {};
  const title = typeof info.title === "string" ? info.title : "API";
  const version = typeof info.version === "string" ? info.version : "1.0.0";
  const paths = isPlainObject(spec.paths) ? spec.paths : {};

  let operationCount = 0;
  const warnings: string[] = [];

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!isPlainObject(pathItem)) {
      warnings.push(`Path "${pathKey}" is not a valid object.`);
      continue;
    }
    for (const method of Object.keys(pathItem)) {
      if (HTTP_METHODS.has(method.toLowerCase())) {
        operationCount += 1;
      }
    }
  }

  return {
    title,
    version,
    operationCount,
    pathCount: Object.keys(paths).length,
    warnings,
    format,
  };
};

export const parseOpenApiSpec = (rawText: string): ParsedOpenApiSpec => {
  const { data, format } = parseRawSpec(rawText);
  const sanitized = sanitizeForJson(data);

  if (!isPlainObject(sanitized)) {
    throw new Error("OpenAPI specification must be a JSON/YAML object.");
  }

  const version = parseVersion(sanitized.openapi ?? sanitized.swagger);
  if (!version) {
    throw new Error("Missing OpenAPI version. Expected `openapi` (or `swagger`).");
  }

  if (!isPlainObject(sanitized.info)) {
    throw new Error("Missing required `info` object.");
  }
  const infoTitle = typeof sanitized.info.title === "string" ? sanitized.info.title.trim() : "";
  const infoVersion = typeof sanitized.info.version === "string" ? sanitized.info.version.trim() : "";
  if (!infoTitle) {
    throw new Error("Missing required `info.title`.");
  }
  if (!infoVersion) {
    throw new Error("Missing required `info.version`.");
  }

  if (!isPlainObject(sanitized.paths)) {
    throw new Error("Missing required `paths` object.");
  }
  const pathKeys = Object.keys(sanitized.paths);
  if (pathKeys.length === 0) {
    throw new Error("OpenAPI specification contains no paths.");
  }

  const normalizedSpec: JsonLike = {
    ...sanitized,
    openapi: version,
    info: {
      ...sanitized.info,
      title: infoTitle,
      version: infoVersion,
    },
  };

  const meta = buildMeta(normalizedSpec, format);

  if (meta.operationCount === 0) {
    throw new Error("OpenAPI specification has no HTTP operations under `paths`.");
  }

  return {
    spec: normalizedSpec,
    meta,
  };
};

export const readOpenApiMeta = (spec: unknown): OpenApiSpecMeta | null => {
  try {
    if (!isPlainObject(spec)) return null;
    const withText = JSON.stringify(spec);
    return parseOpenApiSpec(withText).meta;
  } catch {
    return null;
  }
};
