/**
 * Apply stats from wiki DB: per-stat peak across slices (excludes manga tabs/columns).
 * Profile hints narrow the slice pool first. Curated overrides run via separate npm scripts.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character, CharacterStats } from "@build-character/shared";
import { clampScore } from "@build-character/shared";
import {
  type WikiDbCharacterScrape,
  scrapeJsonPath,
  wikiDbDir,
} from "./lib/wiki-db.js";
import {
  deriveStatKeyFromWikiPage,
  peakPhysicalFromSlices,
  type WikiSliceProfile,
} from "./lib/pick-wiki-slice.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const charsPath = resolve(root, "data", "characters.json");
const profilePath = resolve(root, "data/wiki-profile-hints.json");
const statKeysPath = resolve(root, "data/wiki-stat-keys.json");
const curatedPath = resolve(root, "data/manual-curated-stats.json");

const APPLY_KEYS: (keyof CharacterStats)[] = [
  "strength",
  "speed",
  "abilities",
  "durability",
];

function loadJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function mergeProfile(
  id: string,
  profiles: Record<string, WikiSliceProfile>,
  statKeys: Record<string, string>,
  c: Character,
): WikiSliceProfile | undefined {
  const p = profiles[id];
  const storedKey = c.sources?.wikiStatKey;
  const priorKey =
    storedKey && !storedKey.toLowerCase().startsWith("peak")
      ? storedKey
      : undefined;
  const statKey =
    p?.statKey ??
    statKeys[id] ??
    priorKey ??
    deriveStatKeyFromWikiPage(c.sources?.wikiPage);
  if (!p && !statKey) return undefined;
  return { ...p, ...(statKey ? { statKey } : {}) };
}

function loadScrape(id: string): WikiDbCharacterScrape | null {
  const path = scrapeJsonPath(root, id);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as WikiDbCharacterScrape;
}

function main() {
  const profiles = loadJson<Record<string, WikiSliceProfile>>(profilePath, {});
  const statKeys = loadJson<Record<string, string>>(statKeysPath, {});
  const curated = loadJson<Record<string, Partial<CharacterStats>>>(
    curatedPath,
    {},
  );

  const chars = JSON.parse(readFileSync(charsPath, "utf-8")) as Character[];
  const scrapeDir = resolve(wikiDbDir(root), "scrapes");
  const onDisk = existsSync(scrapeDir)
    ? readdirSync(scrapeDir).filter((f) => f.endsWith(".json"))
    : [];
  if (!onDisk.length) {
    console.error("No scrapes in data/wiki-db/scrapes — run wiki-full-scrape first.");
    process.exit(1);
  }

  let updated = 0;
  for (const c of chars) {
    const scrape = loadScrape(c.id);
    if (!scrape?.slices.length) continue;

    const profile = mergeProfile(c.id, profiles, statKeys, c);
    const peak = peakPhysicalFromSlices(scrape.slices, profile, {
      displayName: c.displayName,
      wikiPage: c.sources?.wikiPage ?? scrape.wikiTitle ?? undefined,
      wikiStatKey: profile?.statKey,
    });
    if (!peak) continue;

    const patch = { ...peak.stats };
    const phys = APPLY_KEYS.map((k) => patch[k]);
    if (
      phys.every((v) => v === phys[0]) &&
      (phys[0] === 40 || phys[0] === 70)
    ) {
      continue;
    }
    const cur = curated[c.id];
    if (cur) {
      for (const k of Object.keys(cur) as (keyof CharacterStats)[]) {
        if (k in patch && cur[k] !== undefined) patch[k] = clampScore(cur[k]!);
      }
    }

    let changed = false;
    for (const k of APPLY_KEYS) {
      if (c.stats[k] !== patch[k]) {
        c.stats[k] = patch[k];
        changed = true;
      }
    }
    const { wikiFragment: _wf, wikiStatKey: _wk, ...srcRest } = c.sources ?? {};
    const nextSources: NonNullable<Character["sources"]> = { ...srcRest };
    if (scrape.wikiTitle) {
      nextSources.wikiPage = scrape.wikiTitle;
      nextSources.wikiUrl = `https://vsbattles.fandom.com/wiki/${scrape.wikiTitle.replace(/ /g, "_")}`;
    }
    nextSources.wikiStatKey = peak.wikiStatKey;
    if (peak.wikiFragment) nextSources.wikiFragment = peak.wikiFragment;
    const srcChanged =
      JSON.stringify(c.sources ?? {}) !== JSON.stringify(nextSources);
    if (srcChanged) {
      c.sources = nextSources;
      changed = true;
    }
    if (changed) updated++;
  }

  writeFileSync(charsPath, `${JSON.stringify(chars, null, 2)}\n`, "utf-8");
  console.log(
    `Updated ${updated} characters (per-stat peak, non-manga slices).`,
  );
}

main();
