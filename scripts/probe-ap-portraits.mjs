/** Quick AP URL probe for roster ids */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { animePlanetPortraitUrl } = await import("./lib/anime-planet.ts");

const ids = process.argv.slice(2);
const chars = JSON.parse(readFileSync(resolve(root, "data/characters.json"), "utf8"));
const hints = JSON.parse(
  readFileSync(resolve(root, "data/anime-planet-hints.json"), "utf8"),
);
const animeCast = JSON.parse(
  readFileSync(resolve(root, "data/anime-planet-anime-slugs.json"), "utf8"),
);

const SERIES = {
  "Attack on Titan": "Shingeki no Kyojin",
  "Death Note": "Death Note",
  Bleach: "Bleach",
  "Dragon Ball": "Dragon Ball Super",
  Fate: "Fate/stay night",
  "Fullmetal Alchemist": "Fullmetal Alchemist: Brotherhood",
  "Demon Slayer": "Kimetsu no Yaiba",
  "Jujutsu Kaisen": "Jujutsu Kaisen",
  "Gurren Lagann": "Tengen Toppa Gurren Lagann",
  JoJo: "JoJo's Bizarre Adventure",
  "Kengan Ashura": "Kengan Ashura",
  "Mob Psycho 100": "Mob Psycho 100",
  "My Hero Academia": "Boku no Hero Academia",
  Overlord: "Overlord",
  "Solo Leveling": "Ore dake Level Up na Ken",
  "Sword Art Online": "Sword Art Online",
  "The God of High School": "The God of High School",
  "The Misfit of Demon King Academy": "Maou Gakuin",
  "Tokyo Ghoul": "Tokyo Ghoul",
};

for (const id of ids) {
  const c = chars.find((x) => x.id === id);
  if (!c) continue;
  const url = await animePlanetPortraitUrl(c.displayName, {
    series: SERIES[c.series] ?? c.series,
    characterSlug: hints[id],
    animeSlugs: animeCast[c.series] ?? [],
  });
  console.log(id, c.displayName, "→", url ?? "MISS");
  await new Promise((r) => setTimeout(r, 300));
}
