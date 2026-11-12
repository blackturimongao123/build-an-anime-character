/**
 * Scrape VS Battles wiki stats for every entry in data/characters.json.
 * Preserves display names, series, portraits; updates stats + sources.
 * Respects data/manual-overrides.json and optional data/wiki-hints.json.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const charactersPath = resolve(root, "data", "characters.json");
const overridesPath = resolve(root, "data", "manual-overrides.json");
const hintsPath = resolve(root, "data", "wiki-hints.json");
const statKeysPath = resolve(root, "data", "wiki-stat-keys.json");
const profileHintsPath = resolve(root, "data", "wiki-profile-hints.json");
const reportPath = resolve(root, "data", "scrape-report.json");

const VERSE_LABEL: Record<string, string> = {
  "Dragon Ball": "Dragon Ball",
      Fate: "Fate",
  "One Piece": "One Piece",
  Naruto: "Naruto",
  Bleach: "Bleach",
  "Jujutsu Kaisen": "Jujutsu Kaisen",
  "One Punch Man": "One Punch Man",
  "Seven Deadly Sins": "Seven Deadly Sins",
  "My Hero Academia": "My Hero Academia",
  "Chainsaw Man": "Chainsaw Man",
  Hellsing: "Hellsing",
  JoJo: "JoJo's Bizarre Adventure",
  "Attack on Titan": "Attack on Titan",
  "Hunter x Hunter": "Hunter x Hunter",
  "Death Note": "Death Note",
  "Fullmetal Alchemist": "Fullmetal Alchemist",
  "Demon Slayer": "Demon Slayer",
  "Sword Art Online": "Sword Art Online",
  "Tokyo Ghoul": "Tokyo Ghoul",
  "Code Geass": "Code Geass",
  "Mob Psycho 100": "Mob Psycho 100",
  "Akame ga Kill": "Akame ga Kill",
  "The Misfit of Demon King Academy": "The Misfit of Demon King Academy",
  "Assassination Classroom": "Assassination Classroom",
  "Haikyuu!!": "Haikyuu",
  "Dr. Stone": "Dr. Stone",
  "Black Clover": "Black Clover",
  "Vinland Saga": "Vinland Saga",
  "Fairy Tail": "Fairy Tail",
  "Gurren Lagann": "Gurren Lagann",
  Overlord: "Overlord",
  "That Time I Got Reincarnated as a Slime": "Tensei Shitara Slime Datta Ken",
  "Mushoku Tensei": "Mushoku Tensei",
  "Fire Force": "Fire Force",
  "Tokyo Revengers": "Tokyo Revengers",
  "Kuroko's Basketball": "Kuroko no Basket",
  "Solo Leveling": "Solo Leveling",
  Gintama: "Gintama",
  "The God of High School": "The God of High School",
  Mashle: "Mashle",
  "Hajime no Ippo": "Hajime no Ippo",
  Baki: "Baki the Grappler",
  "Kengan Ashura": "Kengan Ashura",
  "Pokémon": "Pokemon",
  "Record of Ragnarok": "Record of Ragnarok",
  Parasyte: "Parasyte",
  "The Disastrous Life of Saiki K": "The Disastrous Life of Saiki K.",
};

function simplifyName(displayName: string): string {
  return displayName.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

function applyOverrides(
  char: Character,
  overrides: Record<string, Partial<Character>>,
): Character {
  const o = overrides[char.id];
  if (!o) return char;
  return {
    ...char,
    ...o,
    stats: { ...char.stats, ...(o.stats ?? {}) },
  };
}

async function resolveWikiTitle(
  c: Character,
  hints: Record<string, string>,
): Promise<string | null> {
  if (hints[c.id]) return hints[c.id]!;
  if (c.sources?.wikiPage) return c.sources.wikiPage;

  const base = simplifyName(c.displayName);
  const verse = VERSE_LABEL[c.series] ?? c.series;
  const queries = [
    `${base} (${verse})`,
    `${base} ${verse}`,
    c.displayName,
    base,
  ];

  for (const q of queries) {
    const title = await searchWikiPage(q);
    if (title) return title;
    await sleep(200);
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const only = process.argv
    .find((a) => a.startsWith("--id="))
    ?.slice("--id=".length);

  const chars = JSON.parse(readFileSync(charactersPath, "utf-8")) as Character[];
  const overrides = existsSync(overridesPath)
    ? JSON.parse(readFileSync(overridesPath, "utf-8"))
    : {};
  const hints: Record<string, string> = existsSync(hintsPath)
    ? JSON.parse(readFileSync(hintsPath, "utf-8"))
    : {};
  const statKeys: Record<string, string> = existsSync(statKeysPath)
    ? JSON.parse(readFileSync(statKeysPath, "utf-8"))
    : {};
  const profileHints: Record<
    string,
    {
      fragment?: string;
      tabFragments?: string[];
      powersSection?: boolean;
      statKey?: string;
      statColumnIndex?: number;
      statFormPhrase?: string;
      wikiUrlBase?: string;
    }
  > = existsSync(profileHintsPath)
    ? JSON.parse(readFileSync(profileHintsPath, "utf-8"))
    : {};

  const report: Array<{
    id: string;
    ok: boolean;
    wikiPage?: string;
    error?: string;
    stats?: Character["stats"];
  }> = [];

  const updated: Character[] = [];

  for (const c of chars) {
    if (only && c.id !== only) {
      updated.push(c);
      continue;
    }

    if (overrides[c.id]?.stats && process.argv.includes("--skip-overridden")) {
      updated.push(applyOverrides(c, overrides));
      continue;
    }

    try {
      const wikiTitle = await resolveWikiTitle(c, hints);
      if (!wikiTitle) {
        report.push({ id: c.id, ok: false, error: "no wiki page found" });
        updated.push(applyOverrides(c, overrides));
        continue;
      }

      let html = await fetchWikiHtml(wikiTitle, root);
      const profile = profileHints[c.id];
      if (profile?.powersSection !== false) {
        html = slicePowersAndStatsSection(html);
      }
      if (profile?.tabFragments?.length) {
        html = narrowHtmlToTabFragments(html, profile.tabFragments);
      }
      const statKey = profile?.statKey ?? statKeys[c.id];
      const statColumnIndex = profile?.statColumnIndex;
      const stats = mapStatsFromWikiHtml(html, {
        statKey: statColumnIndex !== undefined ? undefined : statKey,
        statColumnIndex,
        statFormPhrase: profile?.statFormPhrase,
      });
      const pageSlug = wikiTitle.replace(/ /g, "_");
      const fragment = profile?.fragment;
      const wikiUrlBase =
        profile?.wikiUrlBase ?? `https://vsbattles.fandom.com/wiki/${pageSlug}`;
      const wikiUrl = fragment
        ? `${wikiUrlBase}#${fragment}`
        : wikiUrlBase;
      const next: Character = applyOverrides(
        {
          ...c,
          stats,
          sources: {
            wikiPage: wikiTitle,
            wikiUrl,
            ...(fragment ? { wikiFragment: fragment } : {}),
            ...(statKey ? { wikiStatKey: statKey } : {}),
          },
        },
        overrides,
      );
      updated.push(next);
      report.push({ id: c.id, ok: true, wikiPage: wikiTitle, stats: next.stats });
      console.log(`OK ${c.id} <- ${wikiTitle}`, next.stats);
    } catch (e) {
      const msg = (e as Error).message;
      report.push({ id: c.id, ok: false, error: msg });
      console.warn(`FAIL ${c.id}:`, msg);
      updated.push(applyOverrides(c, overrides));
    }

    await sleep(DELAY_MS);
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

  if (!dryRun) {
    updated.sort(
      (a, b) =>
        a.series.localeCompare(b.series) ||
        a.displayName.localeCompare(b.displayName),
    );
    writeFileSync(
      charactersPath,
      JSON.stringify(updated, null, 2) + "\n",
      "utf-8",
    );
    const ok = report.filter((r) => r.ok).length;
    console.log(`Updated ${ok}/${chars.length} characters. Report: data/scrape-report.json`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
