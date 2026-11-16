/**
 * List roster ids whose AP hint/name does not appear on the series anime cast page.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAnimeCastPage, pickCastRow } from "./lib/anime-planet.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chars = JSON.parse(
  readFileSync(resolve(root, "data/characters.json"), "utf8"),
);
const apHints = JSON.parse(
  readFileSync(resolve(root, "data/anime-planet-hints.json"), "utf8"),
);
const slugs = JSON.parse(
  readFileSync(resolve(root, "data/anime-planet-anime-slugs.json"), "utf8"),
);

const EXEMPT = new Set(["Kengan Ashura", "Solo Leveling", "Pokémon"]);
const UA = "BuildCharacterPortraitBot/1.0";

const castCache = new Map();
async function castForSeries(series) {
  if (castCache.has(series)) return castCache.get(series);
  const animeSlugs = slugs[series] ?? [];
  const rows = [];
  for (const slug of animeSlugs) {
    const res = await fetch(
      `https://www.anime-planet.com/anime/${slug}/characters`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) continue;
    rows.push(...parseAnimeCastPage(await res.text()));
  }
  const bySlug = new Map();
  for (const r of rows) {
    const s = r.path.replace(/^\/characters\//, "");
    bySlug.set(s, r);
  }
  castCache.set(series, { rows, bySlug });
  return castCache.get(series);
}

const missing = [];
for (const c of chars) {
  if (EXEMPT.has(c.series)) continue;
  const { rows, bySlug } = await castForSeries(c.series);
  if (!rows.length) continue;
  const hint = apHints[c.id];
  if (hint && bySlug.has(hint)) continue;
  const row = pickCastRow(rows, c.displayName, [c.sources?.wikiPage ?? ""], 45);
  if (row) continue;
  missing.push({ id: c.id, series: c.series, name: c.displayName, hint });
}

console.log("NOT on anime cast:", missing.length);
for (const m of missing.sort((a, b) => a.series.localeCompare(b.series)))
  console.log(m.series, m.id, m.name, m.hint ?? "");
