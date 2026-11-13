/**
 * Build data/wiki-stat-keys.json from roster-batch2-catalog (+ wiki-profile-hints statKey).
 * Used when applying DB scrapes so each roster id maps to a version/column label.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = resolve(root, "data/roster-batch2-catalog.json");
const profilePath = resolve(root, "data/wiki-profile-hints.json");
const hintsPath = resolve(root, "data/wiki-hints.json");
const charsPath = resolve(root, "data/characters.json");
const outPath = resolve(root, "data/wiki-stat-keys.json");

const SERIES_DISAMBIG = new Set([
  "one piece",
  "naruto",
  "bleach",
  "dragon ball",
  "fairy tail",
  "black clover",
  "hunter x hunter",
  "jujutsu kaisen",
  "demon slayer",
  "my hero academia",
  "attack on titan",
  "fullmetal alchemist",
  "fate",
  "pokémon",
  "pokemon",
  "one punch man",
  "sword art online",
  "tokyo ghoul",
  "record of ragnarok",
]);

function norm(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function fromWikiPage(wikiPage) {
  const m = wikiPage.match(/ \(([^)]+)\)\s*$/);
  if (!m) return undefined;
  const inner = m[1].trim();
  if (SERIES_DISAMBIG.has(norm(inner))) return undefined;
  return inner;
}

const keys = {};

if (existsSync(profilePath)) {
  const profiles = JSON.parse(readFileSync(profilePath, "utf8"));
  for (const [id, p] of Object.entries(profiles)) {
    if (p?.statKey) keys[id] = p.statKey;
  }
}

if (existsSync(catalogPath)) {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  for (const tuples of Object.values(catalog)) {
    for (const t of tuples) {
      const [id, displayName, wikiPage, , statKeyExplicit] = t;
      if (keys[id]) continue;
      if (statKeyExplicit) {
        keys[id] = statKeyExplicit;
        continue;
      }
      const fromPage = wikiPage ? fromWikiPage(wikiPage) : undefined;
      if (fromPage) keys[id] = fromPage;
    }
  }
}

if (existsSync(charsPath)) {
  const chars = JSON.parse(readFileSync(charsPath, "utf8"));
  const hints = existsSync(hintsPath)
    ? JSON.parse(readFileSync(hintsPath, "utf8"))
    : {};
  for (const c of chars) {
    if (keys[c.id]) continue;
    const page = c.sources?.wikiPage ?? hints[c.id];
    if (typeof page !== "string") continue;
    const fromPage = fromWikiPage(page);
    if (fromPage) keys[c.id] = fromPage;
  }
}

writeFileSync(outPath, JSON.stringify(keys, null, 2) + "\n");
console.log(`Wrote ${Object.keys(keys).length} stat keys → ${outPath}`);
