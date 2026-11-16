/**
 * Resolve AP portrait URLs for missing roster ids (excl. Pokémon) via cast + search.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { animePlanetPortraitUrl } = await import("./lib/anime-planet.ts");

const readiness = JSON.parse(
  readFileSync(resolve(root, "data/roster-readiness.json"), "utf8"),
);
const chars = JSON.parse(
  readFileSync(resolve(root, "data/characters.json"), "utf8"),
);
const hintsPath = resolve(root, "data/anime-planet-hints.json");
const hints = JSON.parse(readFileSync(hintsPath, "utf8"));
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

const SEARCH_OVERRIDES = {
  "l-lawliet": ["L Lawliet", "Ryuzaki"],
  "light-dn": ["Light Yagami"],
  "barragan-bleach": ["Barragan Louisenbairn"],
  "tenjiro-bleach": ["Tenjiro Kirinji", "Kirinji"],
  "gyomei-demon-slayer": ["Gyomei Himejima"],
  "diarmuid-fate": ["Diarmuid Ua Duibhne", "Lancer Fate Zero"],
  "cu-chulainn-fate": ["Cu Chulainn"],
  "gogeta-dragon-ball": ["Gogeta"],
  "vegito-dragon-ball": ["Vegito"],
  "gotenks-dragon-ball": ["Gotenks"],
  "artoria-fate": ["Artoria Pendragon", "Saber"],
  "artoria-alter-fate": ["Saber Alter", "Artoria Pendragon Alter"],
  "saber-fsn": ["Saber", "Artoria Pendragon"],
  "stroheim-jojo": ["Rudol von Stroheim"],
  "mahoraga-jjk": ["Mahoraga"],
  "jaldabaoth-overlord": ["Jaldabaoth"],
  "lagann-gurren": ["Lagann"],
  "ttgl-gurren": ["Tengen Toppa Gurren Lagann"],
  "satan-goh": ["Mori Jin", "Jin Mori"],
  "uesugi-goh": ["Yoo Mira"],
  "ymir-jaw-aot": ["Porco Galliard", "Jaw Titan"],
  "cart-aot": ["Pieck Finger"],
  "furuta-tg": ["Nimura Furuta"],
  "utsumi-tg": ["Kanae von Rosewald"],
  "medemma-misfit": ["Medio", "Misha Necron"],
};

const SLUG_FIX = {
  "l-lawliet": "l-death-note",
  "light-dn": "light-yagami",
  "cu-chulainn-fate": "cu-chulainn",
  "saber-fsn": "saber-fate-stay-night",
  "furuta-tg": "nimura-furuta",
  "stroheim-jojo": "rudolf-von-stroheim",
  "kuroki-gensai": "gensai-kuroki",
  "kuro-kengan": "gensai-kuroki",
  "sho-mob": "shou-suzuki",
  "suzuki-mob": "toichiro-suzuki",
  "diarmuid-fate": "diarmuid",
  "greeling-fma": "greed",
  "greed-fma": "greed",
  "roy-mustang": "roy-mustang",
  "mustang-fma": "roy-mustang",
  "scar-mob": "mob",
  "scar-fma": "scar",
  "asuna-sao": "asuna-yuuki",
  "asuna-alicization": "asuna-yuuki",
  "yuuki-sao": "yuuki-konno",
  "sung-jinwoo-monarch": "jinwoo-sung",
  "shadow-monarch-sl": "jinwoo-sung",
  "midoriya-100-mha": "izuku-midoriya",
  "deku-gearshift-mha": "izuku-midoriya",
  "gavel-misfit": "gael",
};

const missing = readiness.missingPortrait.filter((id) => {
  const c = chars.find((x) => x.id === id);
  return c && c.series !== "Pokémon";
});

let hintsChanged = false;
for (const [id, slug] of Object.entries(SLUG_FIX)) {
  if (missing.includes(id) && hints[id] !== slug) {
    hints[id] = slug;
    hintsChanged = true;
  }
}
if (hintsChanged) {
  writeFileSync(hintsPath, JSON.stringify(hints, null, 2) + "\n", "utf8");
}

const found = [];
const still = [];
for (const id of missing) {
  const c = chars.find((x) => x.id === id);
  const url = await animePlanetPortraitUrl(c.displayName, {
    series: SERIES[c.series] ?? c.series,
    characterSlug: hints[id] ?? SLUG_FIX[id],
    extraQueries: SEARCH_OVERRIDES[id],
    animeSlugs: animeCast[c.series] ?? [],
  });
  if (url) found.push({ id, url, slug: hints[id] });
  else still.push(id);
  console.log(id, url ? "OK" : "MISS");
  await new Promise((r) => setTimeout(r, 280));
}
console.log("\nfound", found.length, "still", still.length);
if (still.length) console.log(still.join("\n"));
