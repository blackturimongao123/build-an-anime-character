/**
 * Build data/roster-batch2-entries.json from catalog + per-series targets.
 * Catalog: data/roster-batch2-catalog.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const charsPath = resolve(root, "data", "characters.json");
const catalogPath = resolve(root, "data", "roster-batch2-catalog.json");
const outPath = resolve(root, "data", "roster-batch2-entries.json");

/** Never auto-expand — keep whatever is already in characters.json */
const SERIES_FROZEN = new Set(["Pokémon"]);

/** Override default tier caps (e.g. expanded casts). */
const SERIES_EXTRA_TARGETS = {
  "That Time I Got Reincarnated as a Slime": 30,
  Bleach: 80,
  JoJo: 50,
};

const SERIES_TARGETS = {
  major30: [
    "One Piece",
    "Bleach",
    "Naruto",
    "Dragon Ball",
    "Jujutsu Kaisen",
    "Demon Slayer",
    "My Hero Academia",
    "Hunter x Hunter",
    "Fairy Tail",
    "Black Clover",
    "Fate",
    "Attack on Titan",
    "Fullmetal Alchemist",
  ],
  mid15: [
    "JoJo",
    "Chainsaw Man",
    "One Punch Man",
    "Seven Deadly Sins",
    "Sword Art Online",
    "Tokyo Ghoul",
    "Code Geass",
    "Mob Psycho 100",
    "Death Note",
    "Dr. Stone",
    "That Time I Got Reincarnated as a Slime",
    "Fire Force",
    "Vinland Saga",
    "Kuroko's Basketball",
    "Record of Ragnarok",
    "Solo Leveling",
    "Gintama",
  ],
  minor10: [
    "Akame ga Kill",
    "Assassination Classroom",
    "Haikyuu!!",
    "Overlord",
    "Mushoku Tensei",
    "The Disastrous Life of Saiki K",
    "Mashle",
    "Hajime no Ippo",
    "Baki",
    "Kengan Ashura",
    "Gurren Lagann",
    "Parasyte",
    "The God of High School",
    "The Misfit of Demon King Academy",
    "Hellsing",
    "Tokyo Revengers",
  ],
};

function targetForSeries(series) {
  if (SERIES_TARGETS.major30.includes(series)) return 30;
  if (SERIES_TARGETS.mid15.includes(series)) return 15;
  if (SERIES_TARGETS.minor10.includes(series)) return 10;
  return 12;
}

function rowFromTuple(t, series) {
  const [id, displayName, wikiPage, apSlug] = t;
  return { id, displayName, series, wikiPage: wikiPage || displayName, apSlug: apSlug || undefined };
}

const chars = JSON.parse(readFileSync(charsPath, "utf-8"));
const counts = new Map();
for (const c of chars) {
  counts.set(c.series, (counts.get(c.series) ?? 0) + 1);
}
const existingIds = new Set(chars.map((c) => c.id));

if (!existsSync(catalogPath)) {
  console.error("Missing", catalogPath);
  process.exit(1);
}
const catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));

const entries = [];
const seen = new Set();
for (const [series, tuples] of Object.entries(catalog)) {
  const have = counts.get(series) ?? 0;
  if (SERIES_FROZEN.has(series)) {
    console.log(`${series}: frozen at ${have} (no batch expansion)`);
    continue;
  }
  const target =
    SERIES_EXTRA_TARGETS[series] ?? targetForSeries(series);
  const need = Math.max(0, target - have);
  let added = 0;
  for (const t of tuples) {
    const row = rowFromTuple(t, series);
    if (existingIds.has(row.id) || seen.has(row.id)) continue;
    if (added >= need) break;
    entries.push(row);
    seen.add(row.id);
    added++;
  }
  console.log(
    `${series}: have=${have} target=${target} queued=${added} (catalog=${tuples.length})`,
  );
}

writeFileSync(outPath, JSON.stringify(entries, null, 2) + "\n");
console.log(`Wrote ${entries.length} entries → ${outPath}`);
