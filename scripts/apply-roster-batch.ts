/**
 * Merge data/roster-batch2-entries.json into characters.json (+ wiki/AP hints).
 * New rows get placeholder stats until wiki scrape / IQ apply.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character, CharacterStats } from "@build-character/shared";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const charsPath = resolve(root, "data", "characters.json");
const batchPath = resolve(root, "data", "roster-batch2-entries.json");
const wikiHintsPath = resolve(root, "data", "wiki-hints.json");
const apHintsPath = resolve(root, "data", "anime-planet-hints.json");
const famousPath = resolve(root, "data", "famous-display-names.json");
const newIdsPath = resolve(root, "data", "roster-batch2-new-ids.txt");

type BatchRow = {
  id: string;
  displayName: string;
  series: string;
  wikiPage?: string;
  apSlug?: string;
};

const PLACEHOLDER: CharacterStats = {
  strength: 50,
  speed: 50,
  abilities: 50,
  iq: 50,
  durability: 50,
};

function loadJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

const SERIES_DISAMBIG =
  / \((One Piece|Naruto|Bleach|Dragon Ball|Fairy Tail|Black Clover|Hunter x Hunter|Jujutsu Kaisen|Demon Slayer|My Hero Academia|Attack on Titan|Fullmetal Alchemist|Fate|One Punch Man|Sword Art Online|Tokyo Ghoul|Record of Ragnarok)\)$/i;

function formStatKeyFromWikiPage(wikiPage: string): string | undefined {
  const m = wikiPage.match(/ \(([^)]+)\)\s*$/);
  if (!m || SERIES_DISAMBIG.test(wikiPage)) return undefined;
  return m[1];
}

function main() {
  if (!existsSync(batchPath)) {
    console.error("Missing", batchPath, "— run: node scripts/build-roster-batch2.mjs");
    process.exit(1);
  }
  const batch = JSON.parse(readFileSync(batchPath, "utf-8")) as BatchRow[];
  const chars = JSON.parse(readFileSync(charsPath, "utf-8")) as Character[];
  const byId = new Map(chars.map((c) => [c.id, c]));
  const wikiHints = loadJson<Record<string, string>>(wikiHintsPath, {});
  const apHints = loadJson<Record<string, string>>(apHintsPath, {});
  const famous = loadJson<Record<string, string>>(famousPath, {});

  const added: string[] = [];
  for (const row of batch) {
    if (byId.has(row.id)) continue;
    const wikiPage = row.wikiPage ?? row.displayName;
    const slug = wikiPage.replace(/ /g, "_");
    const wikiStatKey = formStatKeyFromWikiPage(wikiPage);
    const entry: Character = {
      displayName: row.displayName,
      id: row.id,
      portrait: `/portraits/${row.id}.jpg`,
      series: row.series,
      stats: { ...PLACEHOLDER },
      sources: {
        wikiPage,
        wikiUrl: `https://vsbattles.fandom.com/wiki/${slug}`,
        ...(wikiStatKey ? { wikiStatKey } : {}),
      },
    };
    byId.set(row.id, entry);
    if (!wikiHints[row.id]) wikiHints[row.id] = wikiPage;
    if (row.apSlug) apHints[row.id] = row.apSlug;
    if (!famous[row.id]) famous[row.id] = row.displayName;
    added.push(row.id);
  }

  const merged = [...byId.values()].sort(
    (a, b) =>
      a.series.localeCompare(b.series) ||
      a.displayName.localeCompare(b.displayName),
  );
  writeFileSync(charsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");
  writeFileSync(wikiHintsPath, `${JSON.stringify(wikiHints, null, 2)}\n`, "utf-8");
  writeFileSync(apHintsPath, `${JSON.stringify(apHints, null, 2)}\n`, "utf-8");
  writeFileSync(famousPath, `${JSON.stringify(famous, null, 2)}\n`, "utf-8");
  mkdirSync(resolve(root, "data"), { recursive: true });
  writeFileSync(newIdsPath, `${added.join("\n")}\n`, "utf-8");
  console.log(`Roster: ${chars.length} → ${merged.length} (+${added.length} new)`);
  console.log(`New ids list: ${newIdsPath}`);
}

main();
