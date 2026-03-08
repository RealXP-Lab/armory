#!/usr/bin/env node
/**
 * cache-notion.js — Cache Notion pages as local markdown.
 *
 * Usage:
 *   node cache-notion.js [--config path/to/config.json] [--output path/to/.distill]
 *
 * NOTION_TOKEN is read from .env in the config directory, or from the environment.
 *
 * Two-pass pipeline:
 *   1. Discover pages (child pages, databases, link_to_page, page mentions),
 *      fetch markdown + metadata, write files with YAML frontmatter (including
 *      database properties like tags, type, shared_by, etc.).
 *   2. Resolve page references and clean HTML artifacts — converts HTML tables
 *      to markdown pipe tables, resolves <mention-page>, <unknown alias>, and
 *      other Notion-specific tags to markdown links, removes <empty-block/>.
 *
 * Output: .distill/authored-docs/notion/<parent-path>/<slug>.md
 * Stats are printed to stderr.
 *
 * Zero dependencies — uses Node.js built-in fetch() (Node 18+).
 */

const fs = require("fs");
const path = require("path");

// Load .env from the directory containing config.json (project root)
function loadEnv(configPath) {
  const dir = path.dirname(path.resolve(configPath));
  const envPath = path.join(dir, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";
const MAX_PARENT_DEPTH = 10;

// --- CLI args ---

function parseArgs() {
  const args = process.argv.slice(2);
  let configPath = "config.json";
  let outputDir = ".distill";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" && args[i + 1]) configPath = args[++i];
    else if (args[i] === "--output" && args[i + 1]) outputDir = args[++i];
  }

  return { configPath, outputDir };
}

// --- Helpers ---

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// --- Notion API helpers ---

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function notionGet(token, endpoint) {
  const res = await fetch(`${NOTION_API}${endpoint}`, {
    method: "GET",
    headers: headers(token),
  });
  if (!res.ok) {
    const err = new Error(`Notion API error: ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.code = res.status === 404 ? "object_not_found" : undefined;
    throw err;
  }
  return res.json();
}

async function notionPost(token, endpoint, body) {
  const res = await fetch(`${NOTION_API}${endpoint}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Notion API error: ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.code = res.status === 404 ? "object_not_found" : undefined;
    throw err;
  }
  return res.json();
}

// --- Page discovery ---

async function discoverPages(token, pageId, seen) {
  if (seen.has(pageId)) return;
  seen.add(pageId);

  let startCursor;
  do {
    const qs = startCursor ? `?start_cursor=${startCursor}` : "";
    let response;
    try {
      response = await notionGet(token, `/blocks/${pageId}/children${qs}`);
    } catch { break; }

    for (const block of response.results) {
      if (block.archived) continue;

      if (block.type === "child_page") {
        await discoverPages(token, block.id, seen);
      } else if (block.type === "child_database") {
        await discoverDatabasePages(token, block.id, seen);
      } else if (block.type === "link_to_page") {
        const ref = block.link_to_page;
        if (ref?.type === "page_id" && ref.page_id) {
          await discoverPages(token, ref.page_id, seen);
        } else if (ref?.type === "database_id" && ref.database_id) {
          await discoverDatabasePages(token, ref.database_id, seen);
        }
      }

      // Blocks that are just page mentions (no other text) act as page links
      const rt = block[block.type]?.rich_text;
      if (rt) {
        const mentions = rt.filter((r) => r.type === "mention" && r.mention?.type === "page");
        const otherText = rt.filter((r) => r.type !== "mention").map((r) => r.plain_text || "").join("").trim();
        if (mentions.length > 0 && otherText === "") {
          for (const m of mentions) {
            await discoverPages(token, m.mention.page.id, seen);
          }
        }
      }
    }

    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);
}

async function discoverDatabasePages(token, databaseId, seen) {
  // API 2025-09-03 uses data_sources instead of databases for queries
  let db;
  try {
    db = await notionGet(token, `/databases/${databaseId}`);
  } catch { return; }

  const dataSources = db.data_sources || [];
  for (const ds of dataSources) {
    let startCursor;
    do {
      const body = {};
      if (startCursor) body.start_cursor = startCursor;

      let response;
      try {
        response = await notionPost(token, `/data_sources/${ds.id}/query`, body);
      } catch { break; }

      for (const page of response.results) {
        if (page.object === "page" && !page.archived) {
          await discoverPages(token, page.id, seen);
        }
      }

      startCursor = response.has_more ? response.next_cursor : undefined;
    } while (startCursor);
  }
}

// --- Content extraction ---

function richTextToPlain(richTextArray) {
  if (!richTextArray) return "";
  return richTextArray.map((rt) => rt.plain_text || "").join("");
}

const SKIP_PROP_TYPES = new Set([
  "title", "files", "relation", "rollup", "formula",
  "unique_id", "verification", "last_edited_time",
]);
const SKIP_PROP_KEYS = new Set(["title", "source", "url"]);

function propKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function extractProperties(properties) {
  if (!properties) return {};
  const result = {};
  for (const [name, prop] of Object.entries(properties)) {
    if (SKIP_PROP_TYPES.has(prop.type)) continue;
    const key = propKey(name);
    if (SKIP_PROP_KEYS.has(key)) continue;

    let val;
    switch (prop.type) {
      case "multi_select": val = prop.multi_select.map((s) => s.name); break;
      case "select": val = prop.select?.name; break;
      case "people": val = prop.people.map((p) => p.name); break;
      case "rich_text": val = richTextToPlain(prop.rich_text); break;
      case "created_time": val = prop.created_time; break;
      case "checkbox": val = prop.checkbox; break;
      case "number": val = prop.number; break;
      case "date": val = prop.date?.start; break;
      case "status": val = prop.status?.name; break;
      case "url": val = prop.url; break;
      default: continue;
    }
    if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) continue;
    result[key] = val;
  }
  return result;
}

// --- Markdown post-processing ---

function extractPageIdFromUrl(url) {
  // Notion URLs end with a 32-char hex ID (with optional query/fragment)
  const m = url.match(/([a-f0-9]{32})(?:[?#]|$)/);
  return m ? m[1] : null;
}

function titleFromUrlSlug(url) {
  // Fallback: extract slug from URL like "Student-Handbook-20cc3744..."
  const m = url.match(/notion\.so\/(?:[^/]+\/)?(.+)-[a-f0-9]{32}/);
  if (!m) return null;
  return m[1].replace(/-/g, " ");
}

function htmlTableToMarkdown(tableHtml) {
  let html = tableHtml.replace(/<colgroup>[\s\S]*?<\/colgroup>/g, "");

  const rows = [];
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  for (const rm of rowMatches) {
    const cells = [];
    const cellMatches = rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g);
    for (const cm of cellMatches) {
      // Replace <br> inside cells with " / " since markdown tables can't have newlines
      const cell = cm[1].replace(/<br\s*\/?>/g, " / ").trim();
      cells.push(cell);
    }
    if (cells.length > 0) rows.push(cells);
  }

  if (rows.length === 0) return "";

  // Normalize column count
  const colCount = Math.max(...rows.map((r) => r.length));
  for (const row of rows) {
    while (row.length < colCount) row.push("");
  }

  const lines = [];
  lines.push("| " + rows[0].join(" | ") + " |");
  lines.push("| " + rows[0].map(() => "---").join(" | ") + " |");
  for (let i = 1; i < rows.length; i++) {
    lines.push("| " + rows[i].join(" | ") + " |");
  }
  return lines.join("\n");
}

function cleanMarkdown(md, titleMap, aliasMap) {
  // 1. <mention-page> with title → markdown link
  md = md.replace(/<mention-page\s+url="([^"]+)"[^>]*>([^<]+)<\/mention-page>/g, "[$2]($1)");

  // 2. Self-closing <mention-page/> → resolve title from titleMap
  md = md.replace(/<mention-page\s+url="([^"]+)"\s*\/>/g, (_, url) => {
    const id = extractPageIdFromUrl(url);
    const title = (id && titleMap.get(id)) || titleFromUrlSlug(url) || "Link";
    return `[${title}](${url})`;
  });

  // 3. <page url="...">Title</page> → markdown link
  md = md.replace(/<page\s+url="([^"]+)"[^>]*>([^<]+)<\/page>/g, "[$2]($1)");

  // 4. <database url="...">Title</database> → markdown link
  md = md.replace(/<database\s+url="([^"]+)"[^>]*>([^<]+)<\/database>/g, "[$2]($1)");

  // 5. <unknown alt="alias"/> → resolve from aliasMap
  md = md.replace(/<unknown\s+url="([^"]+)"\s+alt="alias"\s*\/>/g, (_, url) => {
    const fragment = url.split("#")[1];
    if (fragment && aliasMap.has(fragment)) {
      const { title, linkUrl } = aliasMap.get(fragment);
      return `[${title}](${linkUrl})`;
    }
    return "";
  });

  // 6. <unknown alt="bookmark"/> and other unknown tags → remove
  md = md.replace(/<unknown[^>]*\/>/g, "");

  // 7. HTML tables → markdown pipe tables
  md = md.replace(/<table[^>]*>[\s\S]*?<\/table>/g, (match) => htmlTableToMarkdown(match));

  // 8. <br> → newline
  md = md.replace(/<br\s*\/?>/g, "\n");

  // 9. <empty-block/> → remove
  md = md.replace(/<empty-block\s*\/>/g, "");

  // 10. Clean up excessive blank lines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md;
}

async function fetchPageMarkdown(token, pageId) {
  const res = await fetch(`${NOTION_API}/pages/${pageId}/markdown`, {
    method: "GET",
    headers: headers(token),
  });
  if (!res.ok) {
    const err = new Error(`Notion API error: ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.code = res.status === 404 ? "object_not_found" : undefined;
    throw err;
  }
  const data = await res.json();
  if (data.truncated) {
    process.stderr.write(`Warning: Page ${pageId} content was truncated (>20k blocks)\n`);
  }
  return data.markdown;
}

async function buildPageInfo(token, pageId, parentCache) {
  const pageData = await notionGet(token, `/pages/${pageId}`);

  const titleProp = Object.values(pageData.properties).find(
    (p) => p.type === "title"
  );
  const title = titleProp ? richTextToPlain(titleProp.title) : "Untitled";
  const lastEdited = pageData.last_edited_time;
  const url = pageData.url;

  const bottomUp = [];
  let cachedPrefix = [];
  let current = pageData;
  let depth = 0;

  while (current.parent && depth < MAX_PARENT_DEPTH) {
    depth++;
    const parentType = current.parent.type;

    if (parentType === "workspace") break;

    let nodeId, nodeTitle, nextCurrent;

    if (parentType === "page_id") {
      nodeId = current.parent.page_id;
      if (parentCache.has(nodeId)) { cachedPrefix = parentCache.get(nodeId); break; }
      try {
        const p = await notionGet(token, `/pages/${nodeId}`);
        const prop = Object.values(p.properties).find((pr) => pr.type === "title");
        nodeTitle = prop ? richTextToPlain(prop.title) : "Untitled";
        nextCurrent = p;
      } catch { break; }

    } else if (parentType === "database_id") {
      nodeId = current.parent.database_id;
      if (parentCache.has(nodeId)) { cachedPrefix = parentCache.get(nodeId); break; }
      try {
        const db = await notionGet(token, `/databases/${nodeId}`);
        nodeTitle = richTextToPlain(db.title);
        nextCurrent = db;
      } catch { break; }

    } else if (parentType === "data_source_id") {
      nodeId = current.parent.data_source_id;
      if (parentCache.has(nodeId)) { cachedPrefix = parentCache.get(nodeId); break; }
      try {
        const ds = await notionGet(token, `/data_sources/${nodeId}`);
        nodeTitle = richTextToPlain(ds.title);
        nextCurrent = ds.database_parent ? { parent: ds.database_parent } : ds;
      } catch { break; }

    } else if (parentType === "block_id") {
      // Blocks are transparent — skip them and continue from the block's parent
      try {
        current = await notionGet(token, `/blocks/${current.parent.block_id}`);
        continue;
      } catch { break; }

    } else { break; }

    bottomUp.push({ id: nodeId, title: nodeTitle });
    current = nextCurrent;
  }

  bottomUp.reverse();
  const topDown = [...cachedPrefix, ...bottomUp];

  for (let i = 0; i < topDown.length; i++) {
    parentCache.set(topDown[i].id, topDown.slice(0, i + 1));
  }

  const parentPath = topDown.map((n) => slugify(n.title)).join("/");
  const properties = extractProperties(pageData.properties);
  return { title, parentPath, lastEdited, url, properties };
}

// --- Main ---

async function main() {
  const { configPath, outputDir } = parseArgs();
  loadEnv(configPath);

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error("Error: NOTION_TOKEN environment variable is required. Add it to .env at the project root.");
    process.exit(1);
  }

  // Read config
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }

  const configPages = config.channels?.notion?.pages || [];

  if (configPages.length === 0) {
    process.stderr.write("No pages specified in config. Nothing to cache.\n");
    return;
  }

  const rootIds = [...new Set(configPages)];
  process.stderr.write("Discovering pages...\n");
  const seen = new Set();
  for (const id of rootIds) {
    await discoverPages(token, id, seen);
  }
  const pages = [...seen].map((id) => ({ id }));
  process.stderr.write(`Found ${pages.length} pages (${rootIds.length} root + ${pages.length - rootIds.length} children).\n`);

  const parentCache = new Map();
  const titleMap = new Map(); // pageId (no dashes) → title

  const updated = {};
  const deleted = [];
  let updatedCount = 0;

  // Clean notion output directory for full recache
  const notionDir = path.join(outputDir, "authored-docs", "notion");
  if (fs.existsSync(notionDir)) {
    fs.rmSync(notionDir, { recursive: true });
  }

  // --- Pass 1: fetch pages and write raw markdown ---
  for (const page of pages) {
    const key = `notion:${page.id.replace(/-/g, "")}`;

    process.stderr.write(`[${pages.indexOf(page) + 1}/${pages.length}] Fetching: ${page.id}...\n`);

    try {
      const { title, parentPath, lastEdited, url, properties } = await buildPageInfo(token, page.id, parentCache);
      titleMap.set(page.id.replace(/-/g, ""), title);
      const markdown = await fetchPageMarkdown(token, page.id);

      // Build local path, appending short ID on slug collision
      const baseSlug = slugify(title) || page.id.replace(/-/g, "");
      const relDir = ["notion", parentPath].filter(Boolean).join("/");
      const localDir = path.join(outputDir, "authored-docs", relDir);
      mkdirp(localDir);

      let slug = baseSlug;
      if (fs.existsSync(path.join(localDir, `${slug}.md`))) {
        slug = `${baseSlug}-${page.id.replace(/-/g, "").slice(0, 8)}`;
      }
      const fileName = `${slug}.md`;
      const localPath = path.join(outputDir, "authored-docs", relDir, fileName);
      const relLocalPath = path.join(
        ".distill",
        "authored-docs",
        relDir,
        fileName
      );

      // Write file with frontmatter
      const fmLines = [
        "---",
        `title: "${title.replace(/"/g, '\\"')}"`,
        "source: notion",
        `url: "${url}"`,
      ];
      for (const k of Object.keys(properties).sort()) {
        const v = properties[k];
        if (Array.isArray(v)) {
          fmLines.push(`${k}:`);
          for (const item of v) fmLines.push(`  - "${String(item).replace(/"/g, '\\"')}"`);
        } else if (typeof v === "boolean" || typeof v === "number") {
          fmLines.push(`${k}: ${v}`);
        } else {
          fmLines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`);
        }
      }
      fmLines.push("---");
      const content = [...fmLines, "", markdown, ""].join("\n");

      fs.writeFileSync(localPath, content, "utf-8");

      const entry = {
        url,
        local_path: relLocalPath,
        last_edited: lastEdited,
        last_fetched: new Date().toISOString(),
      };

      updated[key] = entry;
      updatedCount++;
    } catch (err) {
      if (err.code === "object_not_found" || err.status === 404) {
        deleted.push(key);
      } else {
        process.stderr.write(
          `Warning: Failed to fetch ${page.id}: ${err.message}\n`
        );
      }
    }
  }

  // --- Pass 2: resolve references and clean HTML artifacts ---
  process.stderr.write("Cleaning markdown...\n");

  // Collect all <unknown alt="alias"/> block IDs across written files
  const aliasBlockIds = new Set();
  for (const entry of Object.values(updated)) {
    const relFromOutput = entry.local_path.replace(/^\.distill\//, "");
    const absPath = path.join(outputDir, relFromOutput);
    const raw = fs.readFileSync(absPath, "utf-8");
    const matches = raw.matchAll(/<unknown\s+url="([^"]+)"\s+alt="alias"\s*\/>/g);
    for (const m of matches) {
      const fragment = m[1].split("#")[1];
      if (fragment) aliasBlockIds.add(fragment);
    }
  }

  // Resolve alias block IDs via block API
  const aliasMap = new Map();
  for (const blockId of aliasBlockIds) {
    try {
      const block = await notionGet(token, `/blocks/${blockId}`);
      if (block.type === "link_to_page") {
        const ref = block.link_to_page;
        if (ref?.type === "page_id" && ref.page_id) {
          const pid = ref.page_id.replace(/-/g, "");
          const title = titleMap.get(pid) || "Link";
          aliasMap.set(blockId, { title, linkUrl: `https://www.notion.so/${pid}` });
        } else if (ref?.type === "database_id" && ref.database_id) {
          try {
            const db = await notionGet(token, `/databases/${ref.database_id}`);
            const title = richTextToPlain(db.title) || "Database";
            aliasMap.set(blockId, { title, linkUrl: `https://www.notion.so/${ref.database_id.replace(/-/g, "")}` });
          } catch { /* skip */ }
        }
      }
    } catch {
      process.stderr.write(`Warning: Could not resolve alias block ${blockId}\n`);
    }
  }

  if (aliasBlockIds.size > 0) {
    process.stderr.write(`Resolved ${aliasMap.size}/${aliasBlockIds.size} alias blocks.\n`);
  }

  // Clean all written files
  let cleanedCount = 0;
  for (const entry of Object.values(updated)) {
    const relFromOutput = entry.local_path.replace(/^\.distill\//, "");
    const absPath = path.join(outputDir, relFromOutput);
    const raw = fs.readFileSync(absPath, "utf-8");
    const cleaned = cleanMarkdown(raw, titleMap, aliasMap);
    if (cleaned !== raw) {
      fs.writeFileSync(absPath, cleaned, "utf-8");
      cleanedCount++;
    }
  }
  process.stderr.write(`Cleaned ${cleanedCount} files.\n`);

  process.stderr.write(`Done: ${updatedCount} pages cached, ${deleted.length} deleted/missing.\n`);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
