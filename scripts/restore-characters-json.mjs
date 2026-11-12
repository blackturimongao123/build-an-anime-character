/**
 * Restore data/characters.json after a partial write (e.g. portraits-fetch used a narrow struct).
 * Keeps current id / displayName / portrait; backfills series + stats + sources from roster-expansion,
 * manual-overrides, and wiki hints.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const charsPath = resolve(root, "data", "characters.json");
const expansionPath = resolve(root, "data", "roster-expansion.json");
const overridesPath = resolve(root, "data", "manual-overrides.json");
const hintsPath = resolve(root, "data", "wiki-hints.json");

const DEFAULT_STATS = {
  strength: 40,
  speed: 40,
  abilities: 40,
  iq: 40,
  durability: 40,
};

const slim = JSON.parse(readFileSync(charsPath, "utf-8"));
const expansion = existsSync(expansionPath)
  ? JSON.parse(readFileSync(expansionPath, "utf-8"))
  : [];
const overrides = existsSync(overridesPath)
  ? JSON.parse(readFileSync(overridesPath, "utf-8"))
  : {};
const hints = existsSync(hintsPath)
  ? JSON.parse(readFileSync(hintsPath, "utf-8"))
  : {};

const byExpansion = new Map(expansion.map((c) => [c.id, c]));

const restored = slim.map((current) => {
  const base = byExpansion.get(current.id) ?? {
    id: current.id,
    displayName: current.displayName,
    series: "Unknown",
    stats: { ...DEFAULT_STATS },
    portrait: current.portrait,
    sources: hints[current.id]
      ? {
          wikiPage: hints[current.id],
          wikiUrl: `https://vsbattles.fandom.com/wiki/${hints[current.id].replace(/ /g, "_")}`,
        }
      : undefined,
  };
  const merged = {
    ...base,
    id: current.id,
    displayName: current.displayName ?? base.displayName,
    portrait: current.portrait ?? base.portrait,
    stats: { ...DEFAULT_STATS, ...base.stats },
    sources: base.sources,
  };
  const o = overrides[current.id];
  if (o) {
    if (o.stats) merged.stats = { ...merged.stats, ...o.stats };
    if (o.series) merged.series = o.series;
    if (o.displayName) merged.displayName = o.displayName;
    if (o.sources) merged.sources = { ...merged.sources, ...o.sources };
  }
  if (!merged.sources?.wikiPage && hints[current.id]) {
    merged.sources = {
      wikiPage: hints[current.id],
      wikiUrl: `https://vsbattles.fandom.com/wiki/${hints[current.id].replace(/ /g, "_")}`,
    };
  }
  return merged;
});

restored.sort(
  (a, b) =>
    a.series.localeCompare(b.series) ||
    a.displayName.localeCompare(b.displayName),
);

writeFileSync(charsPath, JSON.stringify(restored, null, 2) + "\n");
console.log(`Restored ${restored.length} characters with stats/series.`);
