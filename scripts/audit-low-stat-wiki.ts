/**
 * Search VS Battles for roster ids with 2+ stats at 40; print API hits + probed stats.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character } from "@build-character/shared";
import {
  fetchWikiHtml,
  mapStatsFromWikiHtml,
  searchWikiPage,
  slicePowersAndStatsSection,
  sleep,
  DELAY_MS,
} from "./lib/wiki-stats.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hints = JSON.parse(
  readFileSync(resolve(root, "data", "wiki-hints.json"), "utf-8"),
) as Record<string, string>;
const chars = JSON.parse(
  readFileSync(resolve(root, "data", "characters.json"), "utf-8"),
) as Character[];

const low = chars.filter((c) => {
  const s = c.stats;
  const n = [s.strength, s.speed, s.abilities, s.iq, s.durability].filter(
    (v) => v === 40,
  ).length;
  return n >= 2;
});

type Row = {
  id: string;
  displayName: string;
  currentWiki: string | undefined;
  hintWiki: string | undefined;
  searchHits: string[];
  probeStats?: Character["stats"];
};

const out: Row[] = [];

for (const c of low) {
  const q = c.displayName.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const queries = [
    c.displayName,
    `${q} (${c.series})`,
    `${q} ${c.series}`,
    hints[c.id] ?? "",
  ].filter(Boolean);

  const hits = new Set<string>();
  for (const query of queries) {
    const t = await searchWikiPage(query);
    if (t) hits.add(t);
    await sleep(200);
  }

  const title = hints[c.id] ?? c.sources?.wikiPage ?? [...hits][0] ?? null;
  let probeStats: Character["stats"] | undefined;
  if (title) {
    try {
      let html = await fetchWikiHtml(title, root);
      html = slicePowersAndStatsSection(html);
      probeStats = mapStatsFromWikiHtml(html);
    } catch {
      /* skip */
    }
    await sleep(DELAY_MS);
  }

  out.push({
    id: c.id,
    displayName: c.displayName,
    currentWiki: c.sources?.wikiPage,
    hintWiki: hints[c.id],
    searchHits: [...hits],
    probeStats,
  });
  console.log(
    c.id,
    "->",
    title,
    probeStats,
    "hits:",
    [...hits].slice(0, 3).join(" | "),
  );
}

writeFileSync(
  resolve(root, "data", "wiki-search-audit.json"),
  JSON.stringify(out, null, 2) + "\n",
);
