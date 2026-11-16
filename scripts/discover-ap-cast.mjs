/**
 * For each id, try series anime cast pages first and print slug + portrait URL.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { animePlanetPortraitUrl, pickCastRow, parseAnimeCastPage } =
  await import("./lib/anime-planet.ts");

const readiness = JSON.parse(
  readFileSync(resolve(root, "data/roster-readiness.json"), "utf8"),
);
const chars = JSON.parse(
  readFileSync(resolve(root, "data/characters.json"), "utf8"),
);
const animeCast = JSON.parse(
  readFileSync(resolve(root, "data/anime-planet-anime-slugs.json"), "utf8"),
);
const hintsPath = resolve(root, "data/anime-planet-hints.json");
const hints = JSON.parse(readFileSync(hintsPath, "utf8"));

const EXTRA_ANIME = {
  Bleach: ["bleach-thousand-year-blood-war", "bleach-thousand-year-blood-war-part-2"],
  "Dragon Ball": [
    "dragon-ball-z-broly",
    "dragon-ball-z-fusion-reborn-fusion",
    "dragon-ball-z-fusion-reborn",
  ],
  JoJo: [
    "jojos-bizarre-adventure-battle-tendency",
    "jojos-bizarre-adventure-part-2-battle-tendency",
  ],
  "Gurren Lagann": ["gurren-lagann"],
  Overlord: ["overlord-ii", "overlord-iii", "overlord-iv"],
};

const CAST_NAMES = {
  "gyomei-demon-slayer": ["Gyoumei Himejima", "Gyomei Himejima"],
  "tenjiro-bleach": ["Tenjiro Kirinji", "Kirinji Hikifune"],
  "barragan-bleach": ["Barragan", "Baraggan Louisenbairn"],
  "gogeta-dragon-ball": ["Gogeta"],
  "gotenks-dragon-ball": ["Gotenks"],
  "vegito-dragon-ball": ["Vegito", "Vegetto"],
  "stroheim-jojo": ["Rudol von Stroheim", "Rudolf von Stroheim"],
  "jaldabaoth-overlord": ["Jaldabaoth"],
  "lagann-gurren": ["Lagann"],
  "ttgl-gurren": ["Tengen Toppa Gurren Lagann"],
};

const ids = readiness.missingPortrait.filter((id) => {
  const c = chars.find((x) => x.id === id);
  return c && c.series !== "Pokémon";
});

const UA = "BuildCharacterPortraitBot/1.0";
const found = {};

for (const id of ids) {
  const c = chars.find((x) => x.id === id);
  const slugs = [
    ...(animeCast[c.series] ?? []),
    ...(EXTRA_ANIME[c.series] ?? []),
  ];
  const extra = CAST_NAMES[id] ?? [];

  let hit = null;
  for (const slug of slugs) {
    const res = await fetch(
      `https://www.anime-planet.com/anime/${slug}/characters`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) continue;
    const html = await res.text();
    const rows = parseAnimeCastPage(html);
    for (const name of [c.displayName, ...extra]) {
      const row = pickCastRow(rows, name, extra);
      if (!row) continue;
      const slugFromPath = row.path.replace(/^\/characters\//, "");
      hit = { slugFromPath, castAnime: slug, rowName: row.name };
      break;
    }
    if (hit) break;
  }

  if (hit) {
    hints[id] = hit.slugFromPath;
    found[id] = hit;
    console.log("CAST", id, hit);
  } else {
    const url = await animePlanetPortraitUrl(c.displayName, {
      series: c.series,
      characterSlug: hints[id],
      extraQueries: extra,
      animeSlugs: slugs,
    });
    console.log(url ? `URL ${id} ${url}` : `MISS ${id}`);
    if (url && hints[id]) found[id] = { url };
  }
  await new Promise((r) => setTimeout(r, 250));
}

writeFileSync(hintsPath, JSON.stringify(hints, null, 2) + "\n", "utf8");
writeFileSync(
  resolve(root, "data/ap-cast-discovery.json"),
  JSON.stringify(found, null, 2) + "\n",
);
console.log("Updated hints, discovered", Object.keys(found).length);
