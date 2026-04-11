#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    backendUrl: "https://acceldocs-backend.vercel.app",
    sourceUrl: "",
    product: "",
    version: "",
    tab: "",
    apiToken: process.env.ACCELDOCS_API_TOKEN || "",
    orgId: process.env.ACCELDOCS_ORG_ID ? Number(process.env.ACCELDOCS_ORG_ID) : null,
    productId: process.env.ACCELDOCS_PRODUCT_ID ? Number(process.env.ACCELDOCS_PRODUCT_ID) : null,
    usePlaywright: false,
    createDriveDocs: false,
    maxPages: 0,
    pollMs: 3000,
    timeoutMin: 90,
    runDir: "",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    const readValue = () => {
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${a}`);
      }
      i += 1;
      return next;
    };

    switch (a) {
      case "--backend-url":
        args.backendUrl = readValue();
        break;
      case "--source-url":
        args.sourceUrl = readValue();
        break;
      case "--product":
        args.product = readValue();
        break;
      case "--version":
        args.version = readValue();
        break;
      case "--tab":
        args.tab = readValue();
        break;
      case "--token":
        args.apiToken = readValue();
        break;
      case "--org-id":
        args.orgId = Number(readValue());
        break;
      case "--product-id":
        args.productId = Number(readValue());
        break;
      case "--use-playwright":
        args.usePlaywright = true;
        break;
      case "--create-drive-docs":
        args.createDriveDocs = true;
        break;
      case "--max-pages":
        args.maxPages = Number(readValue());
        break;
      case "--poll-ms":
        args.pollMs = Number(readValue());
        break;
      case "--timeout-min":
        args.timeoutMin = Number(readValue());
        break;
      case "--run-dir":
        args.runDir = readValue();
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${a}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/migration-runbook.mjs [options]\n\nOptions:\n  --backend-url <url>      Backend base URL (default: https://acceldocs-backend.vercel.app)\n  --source-url <url>       Source URL to migrate (required)\n  --product <slug>         Product slug used by migration discovery/start (required)\n  --version <name>         Version section name to verify under product (required)\n  --tab <name>             Optional tab name to verify under version\n  --token <jwt>            API bearer token (or ACCELDOCS_API_TOKEN env)\n  --org-id <id>            Org ID (optional; auto-detected if omitted)\n  --product-id <id>        Product section ID (optional; auto-detected if omitted)\n  --use-playwright         Enable playwright discovery/fetch\n  --create-drive-docs      Enable Drive doc creation\n  --max-pages <n>          Max pages safety limit (default: 0=no limit)\n  --poll-ms <ms>           Poll interval for status (default: 3000)\n  --timeout-min <n>        Overall timeout in minutes (default: 90)\n  --run-dir <path>         Output run directory\n  --dry-run                Do discovery + snapshots + parity only (no start)\n`);
}

function ensureRequired(args) {
  const missing = [];
  if (!args.sourceUrl) missing.push("--source-url");
  if (!args.product) missing.push("--product");
  if (!args.version) missing.push("--version");
  if (!args.apiToken) missing.push("--token or ACCELDOCS_API_TOKEN");
  if (missing.length > 0) {
    throw new Error(`Missing required inputs: ${missing.join(", ")}`);
  }
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function safeName(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "run";
}

async function apiCall({ backendUrl, token, orgId, method = "GET", pathName, body }) {
  const url = `${backendUrl.replace(/\/$/, "")}${pathName}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (orgId !== null && orgId !== undefined) {
    headers["X-Org-Id"] = String(orgId);
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    throw new Error(`${method} ${pathName} failed (${response.status}): ${detail}`);
  }

  return parsed;
}

function toTitleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function discoverOrgAndSections({ backendUrl, token, orgId }) {
  if (Number.isFinite(orgId) && orgId > 0) {
    const sections = await apiCall({ backendUrl, token, orgId, pathName: "/api/sections" });
    return { resolvedOrgId: orgId, sections };
  }

  const candidates = Array.from({ length: 50 }, (_, i) => i + 1);
  for (const candidate of candidates) {
    try {
      const sections = await apiCall({ backendUrl, token, orgId: candidate, pathName: "/api/sections" });
      return { resolvedOrgId: candidate, sections };
    } catch (err) {
      const message = String(err?.message || "");
      if (!message.includes("(401)") && !message.includes("(403)")) {
        throw err;
      }
    }
  }

  throw new Error(
    "Unable to auto-detect org id (token may be invalid or has no access to any org in tested range). Pass --org-id explicitly.",
  );
}

function resolveProductId({ sectionsPayload, productId, productSlug }) {
  const sectionList = Array.isArray(sectionsPayload?.sections) ? sectionsPayload.sections : [];

  if (Number.isFinite(productId) && productId > 0) {
    const exists = sectionList.some((s) => s.id === productId);
    if (!exists) {
      throw new Error(`Provided product_id=${productId} is not present in /api/sections response.`);
    }
    return productId;
  }

  const roots = sectionList.filter((s) => s.parent_id === null);
  const candidates = new Set([normalizeTitle(productSlug), normalizeTitle(toTitleCase(productSlug))]);
  const match = roots.find((s) => candidates.has(normalizeTitle(s.name)));

  if (!match) {
    const names = roots.map((s) => `${s.id}:${s.name}`).join(", ");
    throw new Error(
      `Unable to auto-detect product_id for "${productSlug}". Root sections: ${names || "(none)"}. Pass --product-id.`,
    );
  }
  return match.id;
}

function buildRunDir(args) {
  if (args.runDir) return args.runDir;
  const root = path.resolve("migration-runs");
  const folder = `${nowStamp()}-${safeName(args.product)}-${safeName(args.version)}${args.tab ? `-${safeName(args.tab)}` : ""}`;
  return path.join(root, folder);
}

function writeJson(dir, fileName, value) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(value, null, 2));
}

function normalizeTitle(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function pickNodeByTitle(nodes, title) {
  const target = normalizeTitle(title);
  const stack = [...(nodes || [])];
  while (stack.length > 0) {
    const n = stack.shift();
    if (normalizeTitle(n?.title) === target) return n;
    if (Array.isArray(n?.children) && n.children.length > 0) {
      stack.push(...n.children);
    }
  }
  return null;
}

function flattenExpectedSections(root) {
  const out = [];
  const walk = (node, parentPath) => {
    const name = String(node?.title || "").trim();
    if (!name) return;
    const pathHere = [...parentPath, name];
    out.push(pathHere.join(" > "));
    for (const child of node?.children || []) {
      if (Array.isArray(child?.children) && child.children.length > 0) {
        walk(child, pathHere);
      }
    }
  };
  walk(root, []);
  return out;
}

function flattenExpectedPages(root) {
  const out = [];
  const walk = (node, parentPath) => {
    const name = String(node?.title || "").trim();
    if (!name) return;
    const pathHere = [...parentPath, name];

    const kids = Array.isArray(node?.children) ? node.children : [];
    if (kids.length === 0 && node?.url) {
      out.push(pathHere.join(" > "));
      return;
    }

    for (const child of kids) {
      walk(child, pathHere);
    }
  };
  walk(root, []);
  return out;
}

function buildSectionChildren(sections) {
  const byParent = new Map();
  const byId = new Map();

  for (const s of sections) {
    byId.set(s.id, s);
    const p = s.parent_id === null ? "root" : String(s.parent_id);
    const arr = byParent.get(p) || [];
    arr.push(s);
    byParent.set(p, arr);
  }

  for (const arr of byParent.values()) {
    arr.sort((a, b) => {
      const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  return { byParent, byId };
}

function flattenActualSectionsFromRoot(rootSection, helpers) {
  const out = [];
  const walk = (sec, parentPath) => {
    const name = String(sec?.name || "").trim();
    if (!name) return;
    const pathHere = [...parentPath, name];
    out.push(pathHere.join(" > "));
    const children = helpers.byParent.get(String(sec.id)) || [];
    for (const child of children) {
      walk(child, pathHere);
    }
  };
  walk(rootSection, []);
  return out;
}

function flattenActualPagesFromRoot(rootSection, helpers, pages) {
  const bySectionId = new Map();
  for (const p of pages) {
    if (p.section_id == null) continue;
    const key = String(p.section_id);
    const arr = bySectionId.get(key) || [];
    arr.push(p);
    bySectionId.set(key, arr);
  }

  for (const arr of bySectionId.values()) {
    arr.sort((a, b) => {
      const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }

  const out = [];
  const walk = (sec, parentPath) => {
    const secName = String(sec?.name || "").trim();
    const pathHere = [...parentPath, secName];

    const pagesHere = bySectionId.get(String(sec.id)) || [];
    for (const p of pagesHere) {
      out.push([...pathHere, String(p.title || "").trim()].join(" > "));
    }

    const children = helpers.byParent.get(String(sec.id)) || [];
    for (const child of children) {
      walk(child, pathHere);
    }
  };

  walk(rootSection, []);
  return out;
}

function diffOrdered(expected, actual) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extras = actual.filter((item) => !expected.includes(item));

  const orderingMismatches = [];
  const inBoth = expected.filter((x) => actual.includes(x));
  for (let i = 0; i < inBoth.length; i += 1) {
    const item = inBoth[i];
    const expectedIndex = expected.indexOf(item);
    const actualIndex = actual.indexOf(item);
    if (expectedIndex !== actualIndex) {
      orderingMismatches.push({ item, expectedIndex, actualIndex });
    }
  }

  return { missing, extras, orderingMismatches };
}

async function waitForMigration({ backendUrl, token, orgId, migrationId, pollMs, timeoutMin, runDir }) {
  const started = Date.now();
  const timeoutMs = timeoutMin * 60 * 1000;

  while (Date.now() - started < timeoutMs) {
    const status = await apiCall({
      backendUrl,
      token,
      orgId,
      pathName: `/api/migration/status/${migrationId}`,
      method: "GET",
    });

    writeJson(runDir, "status-latest.json", status);

    const phase = status?.progress?.phase || "unknown";
    const message = status?.progress?.message || "";
    const fetched = Number(status?.progress?.fetched || 0);
    const total = Number(status?.progress?.total || 0);
    const imported = Number(status?.progress?.imported || 0);
    console.log(`[status] ${status.status} | phase=${phase} | fetched=${fetched}/${total} | imported=${imported} | ${message}`);

    if (["completed", "failed", "cancelled"].includes(status.status)) {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Timed out waiting for migration ${migrationId}`);
}

function resolveActualRoot({ sections, productId, versionTitle, tabTitle }) {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const productRoot = byId.get(productId);
  if (!productRoot) {
    throw new Error(`Product section id=${productId} not found in destination sections`);
  }

  const versionNode = sections.find(
    (s) => s.parent_id === productRoot.id && normalizeTitle(s.name) === normalizeTitle(versionTitle),
  );
  if (!versionNode) {
    throw new Error(`Version section \"${versionTitle}\" not found under product id=${productId}`);
  }

  if (!tabTitle) {
    return versionNode;
  }

  const tabNode = sections.find(
    (s) => s.parent_id === versionNode.id && normalizeTitle(s.name) === normalizeTitle(tabTitle),
  );
  if (!tabNode) {
    throw new Error(`Tab section \"${tabTitle}\" not found under version \"${versionTitle}\"`);
  }
  return tabNode;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureRequired(args);

  const runDir = buildRunDir(args);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`[1/7] Resolving organization and product in destination workspace`);
  const orgAndSections = await discoverOrgAndSections({
    backendUrl: args.backendUrl,
    token: args.apiToken,
    orgId: args.orgId,
  });
  const resolvedOrgId = orgAndSections.resolvedOrgId;
  const resolvedProductId = resolveProductId({
    sectionsPayload: orgAndSections.sections,
    productId: args.productId,
    productSlug: args.product,
  });

  const runMeta = {
    started_at: new Date().toISOString(),
    backend_url: args.backendUrl,
    source_url: args.sourceUrl,
    product: args.product,
    version: args.version,
    tab: args.tab || null,
    org_id: resolvedOrgId,
    product_id: resolvedProductId,
    use_playwright: args.usePlaywright,
    create_drive_docs: args.createDriveDocs,
    max_pages: args.maxPages,
    dry_run: args.dryRun,
  };
  writeJson(runDir, "run-meta.json", runMeta);

  console.log(`[2/7] Taking destination snapshot (before) into ${runDir}`);
  const sectionsBefore = orgAndSections.sections;
  const pagesBefore = await apiCall({
    backendUrl: args.backendUrl,
    token: args.apiToken,
    orgId: resolvedOrgId,
    pathName: "/api/pages",
  });
  writeJson(runDir, "sections-before.json", sectionsBefore);
  writeJson(runDir, "pages-before.json", pagesBefore);

  console.log("[3/7] Discovering source hierarchy");
  const discovered = await apiCall({
    backendUrl: args.backendUrl,
    token: args.apiToken,
    orgId: resolvedOrgId,
    pathName: "/api/migration/discover",
    method: "POST",
    body: {
      source_url: args.sourceUrl,
      product: args.product,
      use_playwright: args.usePlaywright,
    },
  });
  writeJson(runDir, "discover.json", discovered);

  const versionNode = pickNodeByTitle(discovered?.hierarchy || [], args.version);
  if (!versionNode) {
    throw new Error(`Could not find version \"${args.version}\" in discovered hierarchy`);
  }

  const targetNode = args.tab ? pickNodeByTitle(versionNode.children || [], args.tab) : versionNode;
  if (!targetNode) {
    throw new Error(`Could not find tab \"${args.tab}\" under version \"${args.version}\"`);
  }
  writeJson(runDir, "target-node.json", targetNode);

  if (!args.dryRun) {
    console.log("[4/7] Starting migration");
    const started = await apiCall({
      backendUrl: args.backendUrl,
      token: args.apiToken,
      orgId: resolvedOrgId,
      pathName: "/api/migration/start",
      method: "POST",
      body: {
        source_url: args.sourceUrl,
        product: args.product,
        backend_url: args.backendUrl,
        api_token: args.apiToken,
        org_id: resolvedOrgId,
        product_id: resolvedProductId,
        use_playwright: args.usePlaywright,
        create_drive_docs: args.createDriveDocs,
        max_pages: args.maxPages,
      },
    });
    writeJson(runDir, "start-response.json", started);

    console.log("[5/7] Polling migration status until terminal state");
    const finalStatus = await waitForMigration({
      backendUrl: args.backendUrl,
      token: args.apiToken,
      orgId: resolvedOrgId,
      migrationId: started.migration_id,
      pollMs: args.pollMs,
      timeoutMin: args.timeoutMin,
      runDir,
    });
    writeJson(runDir, "status-final.json", finalStatus);

    if (finalStatus.status !== "completed") {
      throw new Error(`Migration ended in non-completed state: ${finalStatus.status}`);
    }
  } else {
    console.log("[4/7] Dry run enabled: skipping migration start");
  }

  console.log("[6/7] Taking destination snapshot (after)");
  const sectionsAfter = await apiCall({
    backendUrl: args.backendUrl,
    token: args.apiToken,
    orgId: resolvedOrgId,
    pathName: "/api/sections",
  });
  const pagesAfter = await apiCall({
    backendUrl: args.backendUrl,
    token: args.apiToken,
    orgId: resolvedOrgId,
    pathName: "/api/pages",
  });
  writeJson(runDir, "sections-after.json", sectionsAfter);
  writeJson(runDir, "pages-after.json", pagesAfter);

  console.log("[7/7] Running hierarchy and page-order parity checks");
  const sectionList = Array.isArray(sectionsAfter?.sections) ? sectionsAfter.sections : [];
  const pageList = Array.isArray(pagesAfter?.pages) ? pagesAfter.pages : [];

  const rootActual = resolveActualRoot({
    sections: sectionList,
    productId: resolvedProductId,
    versionTitle: args.version,
    tabTitle: args.tab,
  });

  const helpers = buildSectionChildren(sectionList);

  const expectedSectionPaths = flattenExpectedSections(targetNode);
  const actualSectionPathsAbsolute = flattenActualSectionsFromRoot(rootActual, helpers);
  const actualSectionPaths = actualSectionPathsAbsolute.map((p) => {
    const parts = p.split(" > ");
    return parts.slice(1).join(" > ");
  });

  const expectedPagePaths = flattenExpectedPages(targetNode);
  const actualPagePathsAbsolute = flattenActualPagesFromRoot(rootActual, helpers, pageList);
  const actualPagePaths = actualPagePathsAbsolute.map((p) => {
    const parts = p.split(" > ");
    return parts.slice(1).join(" > ");
  });

  const sectionDiff = diffOrdered(expectedSectionPaths, actualSectionPaths);
  const pageDiff = diffOrdered(expectedPagePaths, actualPagePaths);

  const summary = {
    expected: {
      sections: expectedSectionPaths.length,
      pages: expectedPagePaths.length,
    },
    actual: {
      sections: actualSectionPaths.length,
      pages: actualPagePaths.length,
    },
    section_diff: sectionDiff,
    page_diff: pageDiff,
    passed:
      sectionDiff.missing.length === 0 &&
      sectionDiff.extras.length === 0 &&
      sectionDiff.orderingMismatches.length === 0 &&
      pageDiff.missing.length === 0 &&
      pageDiff.extras.length === 0 &&
      pageDiff.orderingMismatches.length === 0,
  };

  writeJson(runDir, "parity-summary.json", summary);

  if (!summary.passed) {
    console.error("❌ Parity failed. Review parity-summary.json and stop further migration batches.");
    process.exit(2);
  }

  console.log("✅ Parity passed. Safe to proceed to next batch.");
}

main().catch((err) => {
  console.error(`\nMigration runbook failed: ${err.message}`);
  process.exit(1);
});
