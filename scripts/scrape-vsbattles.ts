/**
 * Fetches VS Battles wiki pages for a curated seed list, maps tiers to 0–100 stats,
 * merges into data/characters.json (existing entries preserved unless --replace).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tierStringToScore, clampScore } from "@build-character/shared";
import type { Category, Character, CharacterStats } from "@build-character/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const cacheDir = resolve(root, "data", "raw-wiki");
const outPath = resolve(root, "data", "characters.json");
const overridesPath = resolve(root, "data", "manual-overrides.json");

const WIKI_API = "https://vsbattles.fandom.com/api.php";
const DELAY_MS = 450;

/** Wiki page title -> game metadata */
const SEED_PAGES: Array<{
  wikiPage: string;
  id: string;
  displayName: string;
  series: string;
}> = [
  { wikiPage: "Son Goku (Dragon Ball Super Anime)", id: "goku-base-dbs", displayName: "Goku (Dragon Ball Super)", series: "Dragon Ball" },
  { wikiPage: "Son Goku (Dragon Ball Z Anime)", id: "goku-ssj2", displayName: "Goku SSJ2", series: "Dragon Ball" },
  { wikiPage: "Vegeta (Dragon Ball Super Anime)", id: "vegeta-ssb", displayName: "Vegeta (Super Saiyan Blue)", series: "Dragon Ball" },
  { wikiPage: "Monkey D. Luffy", id: "luffy-gear-4", displayName: "Monkey D. Luffy (Gear 4)", series: "One Piece" },
  { wikiPage: "Sanji", id: "sanji", displayName: "Sanji", series: "One Piece" },
  { wikiPage: "Roronoa Zoro", id: "zoro-ennies", displayName: "Roronoa Zoro", series: "One Piece" },
  { wikiPage: "Naruto Uzumaki", id: "naruto-bsm", displayName: "Naruto Uzumaki (Baryon Mode)", series: "Naruto" },
  { wikiPage: "Sasuke Uchiha", id: "sasuke-rinnegan", displayName: "Sasuke Uchiha (Rinnegan)", series: "Naruto" },
  { wikiPage: "Madara Uchiha", id: "madara", displayName: "Madara Uchiha", series: "Naruto" },
  { wikiPage: "Ichigo Kurosaki", id: "ichigo-bankai", displayName: "Ichigo Kurosaki (Bankai)", series: "Bleach" },
  { wikiPage: "Sōsuke Aizen", id: "aizen", displayName: "Sōsuke Aizen", series: "Bleach" },
  { wikiPage: "Genryūsai Shigekuni Yamamoto", id: "yamamoto", displayName: "Genryūsai Shigekuni Yamamoto", series: "Bleach" },
  { wikiPage: "Satoru Gojo", id: "gojo-satoru", displayName: "Satoru Gojo", series: "Jujutsu Kaisen" },
  { wikiPage: "Ryomen Sukuna", id: "sukuna", displayName: "Ryomen Sukuna", series: "Jujutsu Kaisen" },
  { wikiPage: "Choso", id: "choso", displayName: "Choso", series: "Jujutsu Kaisen" },
  { wikiPage: "Saitama", id: "saitama", displayName: "Saitama", series: "One Punch Man" },
  { wikiPage: "Garou", id: "garou", displayName: "Garou", series: "One Punch Man" },
  { wikiPage: "Meliodas", id: "meliodas-assault", displayName: "Meliodas (Assault Mode)", series: "Seven Deadly Sins" },
  { wikiPage: "Ban", id: "ban-snatch", displayName: "Ban", series: "Seven Deadly Sins" },
  { wikiPage: "Izuku Midoriya", id: "deku-100", displayName: "Izuku Midoriya (100%)", series: "My Hero Academia" },
  { wikiPage: "Toshinori Yagi", id: "all-might", displayName: "Toshinori Yagi (All Might)", series: "My Hero Academia" },
  { wikiPage: "Denji", id: "denji-chainsaw", displayName: "Denji (Chainsaw Man)", series: "Chainsaw Man" },
  { wikiPage: "Makima", id: "makima", displayName: "Makima", series: "Chainsaw Man" },
  { wikiPage: "Alucard", id: "alucard", displayName: "Alucard", series: "Hellsing" },
  { wikiPage: "Jotaro Kujo", id: "jotaro-part-3", displayName: "Jotaro Kujo (Stardust Crusaders)", series: "JoJo" },
  { wikiPage: "DIO", id: "dio-part-3", displayName: "DIO (Stardust Crusaders)", series: "JoJo" },
  { wikiPage: "Artoria Pendragon", id: "saber-fsn", displayName: "Saber (Fate/stay night)", series: "Fate" },
  { wikiPage: "Gilgamesh (Fate/stay night)", id: "gilgamesh-fsn", displayName: "Gilgamesh (Fate/stay night)", series: "Fate" },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWikiHtml(title: string): Promise<string> {
  mkdirSync(cacheDir, { recursive: true });
  const safe = title.replace(/[^\w()-]+/g, "_");
  const cacheFile = resolve(cacheDir, `${safe}.html`);

  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile, "utf-8");
  }

  const url = new URL(WIKI_API);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "text");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wiki fetch failed: ${title} ${res.status}`);
  const json = (await res.json()) as { parse?: { text?: { "*": string } } };
  const html = json.parse?.text?.["*"];
  if (!html) throw new Error(`No parse content for ${title}`);

  writeFileSync(cacheFile, html, "utf-8");
  await sleep(DELAY_MS);
  return html;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function extractField(html: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      `${label}[^<]*</[^>]+>\\s*</[^>]+>\\s*<[^>]+>([^<]+)`,
      "i",
    );
    const m = html.match(re);
    if (m?.[1]) return stripHtml(m[1]);

    const re2 = new RegExp(`${label}[\\s\\S]{0,120}?<td[^>]*>([\\s\\S]*?)</td>`, "i");
    const m2 = html.match(re2);
    if (m2?.[1]) return stripHtml(m2[1]);
  }
  return null;
}

function mapStats(html: string): CharacterStats {
  const lifting = extractField(html, ["Lifting Strength", "Striking Strength"]);
  const speed = extractField(html, ["Speed"]);
  const ap = extractField(html, ["Attack Potency", "Destructive Capacity"]);
  const iq = extractField(html, ["Intelligence"]);
  const dur = extractField(html, ["Durability"]);

  const strength = clampScore(tierStringToScore(lifting ?? "") ?? 35);
  const speedScore = clampScore(tierStringToScore(speed ?? "") ?? 35);
  const abilities = clampScore(tierStringToScore(ap ?? "") ?? 35);
  const iqScore = clampScore(tierStringToScore(iq ?? "") ?? 35);
  const durability = clampScore(tierStringToScore(dur ?? "") ?? 35);

  return {
    strength,
    speed: speedScore,
    abilities,
    iq: iqScore,
    durability,
  };
}

function applyOverrides(char: Character, overrides: Record<string, Partial<Character>>): Character {
  const o = overrides[char.id];
  if (!o) return char;
  return {
    ...char,
    ...o,
    stats: { ...char.stats, ...(o.stats ?? {}) },
  };
}

async function main() {
  const replace = process.argv.includes("--replace");
  const existing: Character[] = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, "utf-8"))
    : [];
  const byId = new Map(existing.map((c) => [c.id, c]));
  const overrides = existsSync(overridesPath)
    ? JSON.parse(readFileSync(overridesPath, "utf-8"))
    : {};

  for (const seed of SEED_PAGES) {
    try {
      const html = await fetchWikiHtml(seed.wikiPage);
      const stats = mapStats(html);
      const entry: Character = applyOverrides(
        {
          id: seed.id,
          displayName: seed.displayName,
          series: seed.series,
          stats,
          portrait: `/portraits/${seed.id}.webp`,
          sources: {
            wikiPage: seed.wikiPage,
            wikiUrl: `https://vsbattles.fandom.com/wiki/${encodeURIComponent(seed.wikiPage.replace(/ /g, "_"))}`,
          },
        },
        overrides,
      );
      byId.set(seed.id, entry);
      console.log(`Scraped ${seed.displayName}`, stats);
    } catch (e) {
      console.warn(`Skip ${seed.wikiPage}:`, (e as Error).message);
      if (!byId.has(seed.id)) {
        console.warn(`  (no existing entry for ${seed.id})`);
      }
    }
  }

  const merged = replace
    ? [...byId.values()]
    : [
        ...existing.filter((c) => !byId.has(c.id) || SEED_PAGES.some((s) => s.id === c.id)),
        ...[...byId.values()].filter((c) => SEED_PAGES.some((s) => s.id === c.id)),
      ];

  const unique = new Map<string, Character>();
  for (const c of [...existing, ...merged]) {
    if (SEED_PAGES.some((s) => s.id === c.id) || !replace) {
      unique.set(c.id, byId.get(c.id) ?? c);
    }
  }

  const finalList = replace
    ? [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
    : [...unique.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));

  writeFileSync(outPath, JSON.stringify(finalList, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${finalList.length} characters to data/characters.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
