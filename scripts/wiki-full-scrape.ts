/**
 * Download full VS Battles pages, enumerate every tab + pipe column, store local DB.
 *
 * Usage:
 *   tsx wiki-full-scrape.ts [--shard N] [--shards 8] [--id character-id]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character } from "@build-character/shared";
import {
  DELAY_MS,
  fetchWikiHtml,
  mapStatsFromWikiHtml,
  narrowHtmlToTabFragments,
  searchWikiPage,
  slicePowersAndStatsSection,
  sleep,
} from "./lib/wiki-stats.js";
import { enumerateTabScopes } from "./lib/wiki-tabber.js";
import {
  countPipeColumns,
  extractPipeColumnLabels,
} from "./lib/wiki-pipe-key.js";
import {
  initWikiDb,
  type WikiDbCharacterScrape,
  upsertScrapeSqlite,
  writeScrapeJson,
} from "./lib/wiki-db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const charactersPath = resolve(root, "data", "characters.json");
const hintsPath = resolve(root, "data", "wiki-hints.json");

function parseArgs() {
  const args = process.argv.slice(2);
  let shard: number | null = null;
  let shards = 8;
  let id: string | null = null;
  let idsFile: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--shard") shard = parseInt(args[++i]!, 10);
    else if (args[i] === "--shards") shards = parseInt(args[++i]!, 10);
    else if (args[i] === "--id") id = args[++i]!;
    else if (args[i] === "--ids-file") idsFile = args[++i]!;
  }
  return { shard, shards, id, idsFile };
}

function simplifyName(displayName: string): string {
  return displayName.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

async function resolveWikiTitle(
  c: Character,
  hints: Record<string, string>,
): Promise<string | null> {
  if (hints[c.id]) return hints[c.id]!;
  if (c.sources?.wikiPage) return c.sources.wikiPage;
  const base = simplifyName(c.displayName);
  const queries = [c.displayName, `${base} ${c.series}`, base];
  for (const q of queries) {
    const title = await searchWikiPage(q);
    if (title) return title;
    await sleep(150);
  }
  return null;
}

function cacheRelPath(wikiTitle: string): string {
  const safe = wikiTitle.replace(/[^\w()-]+/g, "_");
  return `data/raw-wiki/${safe}.html`;
}

async function scrapeOne(
  c: Character,
  hints: Record<string, string>,
): Promise<WikiDbCharacterScrape> {
  const scrapedAt = new Date().toISOString();
  const base: WikiDbCharacterScrape = {
    id: c.id,
    displayName: c.displayName,
    series: c.series,
    wikiTitle: null,
    scrapedAt,
    htmlCacheFile: null,
    tabCount: 0,
    slices: [],
  };

  const wikiTitle = await resolveWikiTitle(c, hints);
  if (!wikiTitle) {
    return { ...base, error: "no wiki page found" };
  }

  let pageHtml: string;
  try {
    pageHtml = await fetchWikiHtml(wikiTitle, root);
  } catch (e) {
    return {
      ...base,
      wikiTitle,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  base.wikiTitle = wikiTitle;
  base.htmlCacheFile = cacheRelPath(wikiTitle);

  const scopes = enumerateTabScopes(pageHtml);
  base.tabCount = scopes.length;

  for (const scope of scopes) {
    const html =
      scope.path.length > 0
        ? narrowHtmlToTabFragments(pageHtml, scope.path)
        : scope.html;
    const powers = slicePowersAndStatsSection(html);
    const statHtml = powers ?? html;
    const hasPowers = Boolean(powers);
    const labels = extractPipeColumnLabels(statHtml);
    const ncol = countPipeColumns(statHtml);

    for (let col = 0; col < ncol; col++) {
      const stats = mapStatsFromWikiHtml(statHtml, { statColumnIndex: col });
      base.slices.push({
        tabPath: scope.path,
        columnIndex: col,
        columnLabel: labels?.[col] ?? null,
        stats,
        hasPowersSection: hasPowers,
      });
    }
  }

  await sleep(DELAY_MS);
  return base;
}

async function main() {
  initWikiDb(root);
  const { shard, shards, id, idsFile } = parseArgs();
  const hints: Record<string, string> = existsSync(hintsPath)
    ? JSON.parse(readFileSync(hintsPath, "utf-8"))
    : {};
  let chars = JSON.parse(readFileSync(charactersPath, "utf-8")) as Character[];

  if (id) {
    chars = chars.filter((c) => c.id === id);
  } else if (idsFile) {
    const rel = resolve(root, idsFile);
    const ids = readFileSync(rel, "utf-8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const set = new Set(ids);
    chars = chars.filter((c) => set.has(c.id));
    console.log(`Ids file: ${ids.length} → ${chars.length} matched`);
  } else if (shard !== null) {
    const sorted = [...chars].sort((a, b) => a.id.localeCompare(b.id));
    chars = sorted.filter((_, i) => i % shards === shard);
    console.log(`Shard ${shard}/${shards}: ${chars.length} characters`);
  }

  let ok = 0;
  let fail = 0;
  for (const c of chars) {
    try {
      const record = await scrapeOne(c, hints);
      writeScrapeJson(root, record);
      upsertScrapeSqlite(root, record);
      if (record.error) {
        console.warn("WARN", c.id, record.error);
        fail++;
      } else {
        console.log(
          "OK",
          c.id,
          record.wikiTitle,
          `tabs=${record.tabCount}`,
          `slices=${record.slices.length}`,
        );
        ok++;
      }
    } catch (e) {
      console.error("ERR", c.id, e);
      fail++;
    }
  }
  console.log(`Done: ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
