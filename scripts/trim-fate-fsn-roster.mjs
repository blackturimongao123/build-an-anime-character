/** Fate roster: Fate/stay night (5th war + core cast) only — no F/Z, FGO, Apocrypha, etc. */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERIES = "Fate";
const PLACEHOLDER = {
  strength: 50,
  speed: 50,
  abilities: 50,
  iq: 50,
  durability: 50,
};

/** 5th Holy Grail War + main FSN humans; Saber Alter (HF). */
const KEEP = new Set([
  "shirou-fate",
  "rin-fate",
  "emiya-fate",
  "kirei-fate",
  "artoria-fate",
  "artoria-alter-fate",
  "cu-chulainn-fate",
  "rider-medusa-fate",
  "medea-fate",
  "hassan-fate",
  "heracles-fate",
  "gilgamesh-fsn",
]);

const ADDS = [
  {
    id: "artoria-fate",
    displayName: "Saber",
    wikiPage: "Artoria Pendragon",
    portrait: "/portraits/artoria-fate.jpg",
  },
  {
    id: "artoria-alter-fate",
    displayName: "Saber Alter",
    wikiPage: "Saber Alter",
    portrait: "/portraits/artoria-alter-fate.jpg",
  },
  {
    id: "cu-chulainn-fate",
    displayName: "Lancer",
    wikiPage: "Cu Chulainn (Fate)",
    portrait: "/portraits/cu-chulainn-fate.jpg",
  },
  {
    id: "rider-medusa-fate",
    displayName: "Rider",
    wikiPage: "Medusa (Fate)",
    portrait: "/portraits/rider-medusa-fate.jpg",
  },
];

const charsPath = resolve(root, "data/characters.json");
const chars = JSON.parse(readFileSync(charsPath, "utf8"));
const byId = new Map(chars.map((c) => [c.id, c]));

const gilFsn = byId.get("gilgamesh-fsn");
const gilEa = byId.get("gilgamesh-ea-fate");
if (gilFsn) {
  byId.set("gilgamesh-fsn", { ...gilFsn, series: SERIES });
} else if (gilEa) {
  byId.set("gilgamesh-fsn", {
    ...gilEa,
    id: "gilgamesh-fsn",
    displayName: "Gilgamesh",
    portrait: gilEa.portrait ?? "/portraits/gilgamesh-fsn.jpg",
    series: SERIES,
    sources: {
      wikiPage: "Gilgamesh (Archer)",
      wikiUrl: "https://vsbattles.fandom.com/wiki/Gilgamesh_(Archer)",
    },
  });
}
byId.delete("gilgamesh-ea-fate");

for (const row of ADDS) {
  if (byId.has(row.id)) continue;
  const slug = row.wikiPage.replace(/ /g, "_").replace(/[()]/g, "");
  byId.set(row.id, {
    id: row.id,
    displayName: row.displayName,
    series: SERIES,
    portrait: row.portrait,
    stats: { ...PLACEHOLDER },
    sources: {
      wikiPage: row.wikiPage,
      wikiUrl: `https://vsbattles.fandom.com/wiki/${encodeURIComponent(row.wikiPage.replace(/ /g, "_"))}`,
    },
  });
}

const drop = [];
for (const [id, c] of [...byId]) {
  if (c.series !== SERIES) continue;
  if (KEEP.has(id)) continue;
  byId.delete(id);
  drop.push(id);
}
drop.push("gilgamesh-ea-fate");

const merged = [...byId.values()].sort(
  (a, b) =>
    a.series.localeCompare(b.series) || a.displayName.localeCompare(b.displayName),
);
writeFileSync(charsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

const dropSet = new Set([
  ...drop,
  "enkidu-fate",
  "ereshkigal-fate",
  "goetia-fate",
  "ishtar-fate",
  "iskandar-fate",
  "iskandar-king-fate",
  "jeanne-fate",
  "jeanne-alter-fate",
  "karna-fate",
  "mash-fate",
  "merlin-fate",
  "mordred-fate",
  "scathach-fate",
  "solomon-fate",
  "tamamo-fate",
  "tokiomi-fate",
  "diarmuid-fate",
  "king-hassan-fate",
  "waver-fate",
  "bb-fate",
]);

const sidecars = [
  "anime-planet-hints.json",
  "wiki-hints.json",
  "famous-display-names.json",
  "manual-iq-overrides.json",
  "wiki-stat-keys.json",
  "wiki-profile-hints.json",
];
for (const file of sidecars) {
  const path = resolve(root, "data", file);
  if (!existsSync(path)) continue;
  const data = JSON.parse(readFileSync(path, "utf8"));
  for (const id of dropSet) delete data[id];
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const apPath = resolve(root, "data/anime-planet-hints.json");
if (existsSync(apPath)) {
  const ap = JSON.parse(readFileSync(apPath, "utf8"));
  delete ap["gilgamesh-ea-fate"];
  ap["gilgamesh-fsn"] = ap["gilgamesh-fsn"] ?? "gilgamesh";
  writeFileSync(apPath, `${JSON.stringify(ap, null, 2)}\n`, "utf8");
}

const catalogPath = resolve(root, "data/roster-batch2-catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
catalog[SERIES] = [
  ["shirou-fate", "Shirou", "Shirou Emiya", "shirou-emiya"],
  ["rin-fate", "Rin", "Rin Tohsaka", "rin-tohsaka"],
  ["emiya-fate", "Archer", "EMIYA", "archer"],
  ["kirei-fate", "Kirei", "Kirei Kotomine", "kirei-kotomine"],
  ["artoria-fate", "Saber", "Artoria Pendragon", "saber"],
  ["artoria-alter-fate", "Saber Alter", "Saber Alter", "saber-alter"],
  ["cu-chulainn-fate", "Lancer", "Cu Chulainn (Fate)", "cu-chulainn"],
  ["rider-medusa-fate", "Rider", "Medusa (Fate)", "medusa"],
  ["medea-fate", "Caster", "Medea", "medea"],
  ["hassan-fate", "Assassin", "Hassan-i-Sabbah", "hassan-i-sabbah"],
  ["heracles-fate", "Berserker", "Heracles", "heracles"],
  ["gilgamesh-fsn", "Gilgamesh", "Gilgamesh (Archer)", "gilgamesh"],
];
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

const portraitDir = resolve(root, "public-shared/portraits");
const clientPortraitDir = resolve(root, "client/public/portraits");
for (const id of dropSet) {
  for (const dir of [portraitDir, clientPortraitDir]) {
    for (const ext of [".jpg", ".webp", ".png", ".jpeg"]) {
      const p = join(dir, `${id}${ext}`);
      if (existsSync(p)) unlinkSync(p);
    }
  }
}

console.log("Kept FSN:", [...KEEP].sort().join(", "));
console.log("Dropped:", [...dropSet].sort().join(", "));
console.log(
  "Fate roster:",
  merged.filter((c) => c.series === SERIES).length,
  "characters",
);
