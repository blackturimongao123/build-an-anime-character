/**
 * Yu-Gi-Oh roster: Yugi, Yami Yugi, Kaiba + 13 strongest duel monsters.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERIES = "Yu-Gi-Oh";
const PLACEHOLDER = { strength: 50, speed: 50, abilities: 50, iq: 50, durability: 50 };

const HUMANS = [
  ["kaiba-ygo", "Kaiba", "Seto Kaiba", "seto-kaiba"],
  ["yugi-ygo", "Yugi", "Yugi Mutou", "yugi-mutou"],
  ["yami-yugi-ygo", "Yami Yugi", "Yami Yugi", "yami-yugi"],
];

const KEEP_HUMANS = new Set(HUMANS.map(([id]) => id));

const DROP_HUMANS = [
  "joey-ygo",
  "tea-ygo",
  "tristan-ygo",
  "mai-ygo",
  "pegasus-ygo",
  "bakura-ygo",
  "marik-ygo",
  "ishizu-ygo",
  "mokuba-ygo",
  "rebecca-ygo",
  "weevil-ygo",
  "rex-ygo",
];

/** Strongest duel-monster lineup (13) — no joke/filler cards. */
const CARDS = [
  ["exodia-ygo", "Exodia the Forbidden One", ""],
  ["horakhty-ygo", "Horakhty", "horakhty"],
  ["zorc-ygo", "Zorc Necrophades", "zorc-necrophades"],
  ["winged-dragon-ra-ygo", "The Winged Dragon of Ra", "the-winged-dragon-of-ra"],
  ["obelisk-ygo", "Obelisk the Tormentor", "obelisk-the-tormentor"],
  ["slifer-ygo", "Slifer the Sky Dragon", "slifer-the-sky-dragon"],
  ["blue-eyes-ygo", "Blue-Eyes White Dragon", "blue-eyes-white-dragon"],
  ["dark-magician-ygo", "Dark Magician", "dark-magician"],
  ["dark-magician-girl-ygo", "Dark Magician Girl", "dark-magician-girl"],
  ["critias-ygo", "Critias", "critias"],
  ["timaeus-ygo", "Timaeus", "timaeus"],
  ["hermos-ygo", "Hermos", "hermos"],
  ["blue-eyes-ultimate-ygo", "Blue-Eyes Ultimate Dragon", "blue-eyes-ultimate-dragon"],
];

const charsPath = resolve(root, "data/characters.json");
const wikiHintsPath = resolve(root, "data/wiki-hints.json");
const apHintsPath = resolve(root, "data/anime-planet-hints.json");
const famousPath = resolve(root, "data/famous-display-names.json");

const chars = JSON.parse(readFileSync(charsPath, "utf8"));
const byId = new Map(chars.map((c) => [c.id, c]));

for (const id of DROP_HUMANS) byId.delete(id);
for (const [id, c] of [...byId]) {
  if (c.series === SERIES && !KEEP_HUMANS.has(id)) byId.delete(id);
}

for (const [id, displayName, wikiPage, apSlug] of HUMANS) {
  const slug = wikiPage.replace(/ /g, "_");
  byId.set(id, {
    id,
    displayName,
    series: SERIES,
    portrait: `/portraits/${id}.jpg`,
    stats: { ...PLACEHOLDER },
    sources: {
      wikiPage,
      wikiUrl: `https://vsbattles.fandom.com/wiki/${slug}`,
    },
  });
}

for (const [id, displayName, apSlug] of CARDS) {
  const wikiPage = displayName.replace(/ /g, "_");
  byId.set(id, {
    id,
    displayName,
    series: SERIES,
    portrait: `/portraits/${id}.jpg`,
    stats: { ...PLACEHOLDER },
    sources: {
      wikiPage: displayName,
      wikiUrl: `https://vsbattles.fandom.com/wiki/${wikiPage}`,
    },
  });
}

const merged = [...byId.values()].sort(
  (a, b) =>
    a.series.localeCompare(b.series) || a.displayName.localeCompare(b.displayName),
);
writeFileSync(charsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

const ids = new Set(merged.map((c) => c.id));
const famousShort = {
  "exodia-ygo": "Exodia",
  "horakhty-ygo": "Horakhty",
  "zorc-ygo": "Zorc",
  "winged-dragon-ra-ygo": "The Winged Dragon of Ra",
  "obelisk-ygo": "Obelisk",
  "slifer-ygo": "Slifer",
  "blue-eyes-ygo": "Blue-Eyes",
  "blue-eyes-ultimate-ygo": "Blue-Eyes Ultimate",
  "dark-magician-ygo": "Dark Magician",
  "dark-magician-girl-ygo": "Dark Magician Girl",
  "critias-ygo": "Critias",
  "timaeus-ygo": "Timaeus",
  "hermos-ygo": "Hermos",
  "yugi-ygo": "Yugi",
  "yami-yugi-ygo": "Yami Yugi",
  "kaiba-ygo": "Kaiba",
};

function pruneAndPatch(path, patch) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  for (const key of Object.keys(data)) {
    if (key.startsWith("_")) continue;
    if (!ids.has(key)) delete data[key];
  }
  Object.assign(data, patch);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const wikiPatch = Object.fromEntries([
  ...CARDS.map(([id, name]) => [id, name]),
  ...HUMANS.map(([id, , wikiPage]) => [id, wikiPage]),
]);
const apPatch = Object.fromEntries([
  ...CARDS.filter(([, , slug]) => slug).map(([id, , slug]) => [id, slug]),
  ...HUMANS.map(([id, , , apSlug]) => [id, apSlug]),
]);

pruneAndPatch(wikiHintsPath, wikiPatch);
pruneAndPatch(apHintsPath, apPatch);
pruneAndPatch(
  famousPath,
  Object.fromEntries(
    [
      ...CARDS.map(([id, name]) => [id, famousShort[id] ?? name]),
      ...HUMANS.map(([id, displayName]) => [id, famousShort[id] ?? displayName]),
    ],
  ),
);

const portraitDir = resolve(root, "public-shared/portraits");
for (const id of DROP_HUMANS) {
  for (const ext of [".jpg", ".webp", ".png"]) {
    const p = join(portraitDir, `${id}${ext}`);
    if (existsSync(p)) unlinkSync(p);
  }
}

console.log(`Yu-Gi-Oh: kept humans ${[...KEEP_HUMANS].join(", ")}`);
console.log(`+${CARDS.length} cards, dropped ${DROP_HUMANS.length} humans`);
console.log(`Roster total: ${merged.length}`);
