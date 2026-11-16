/** Death Note roster: L, Light, Ryuk only. */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERIES = "Death Note";
const KEEP = new Set(["l-lawliet", "light-yagami", "ryuk-dn"]);

const charsPath = resolve(root, "data/characters.json");
const chars = JSON.parse(readFileSync(charsPath, "utf8"));
const byId = new Map(chars.map((c) => [c.id, c]));

const ryukBest = byId.get("ryuk-hxh");
const ryukDn = byId.get("shinigami-dn");
if (ryukBest || ryukDn) {
  const base = ryukBest ?? ryukDn;
  byId.set("ryuk-dn", {
    ...base,
    id: "ryuk-dn",
    displayName: "Ryuk",
    portrait: ryukBest?.portrait ?? ryukDn?.portrait ?? "/portraits/ryuk-dn.jpg",
    series: SERIES,
    stats: ryukBest?.stats ?? ryukDn?.stats,
    sources: ryukBest?.sources ?? ryukDn?.sources,
  });
}
byId.delete("ryuk-hxh");
byId.delete("shinigami-dn");

if (!byId.has("l-lawliet")) {
  byId.set("l-lawliet", {
    id: "l-lawliet",
    displayName: "L",
    series: SERIES,
    portrait: "/portraits/l-lawliet.jpg",
    stats: {
      strength: 14,
      speed: 16,
      abilities: 18,
      iq: 97,
      durability: 14,
    },
    sources: {
      wikiPage: "L (Death Note)",
      wikiUrl: "https://vsbattles.fandom.com/wiki/L_(Death_Note)",
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
drop.push("ryuk-hxh", "shinigami-dn");

const merged = [...byId.values()].sort(
  (a, b) =>
    a.series.localeCompare(b.series) || a.displayName.localeCompare(b.displayName),
);
writeFileSync(charsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

const dropSet = new Set(drop);
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
const ap = JSON.parse(readFileSync(apPath, "utf8"));
delete ap["light-dn"];
delete ap["l-dn"];
delete ap["shinigami-dn"];
ap["l-lawliet"] = "l";
ap["light-yagami"] = "light-yagami";
ap["ryuk-dn"] = "ryuk";
writeFileSync(apPath, `${JSON.stringify(ap, null, 2)}\n`, "utf8");

const famousPath = resolve(root, "data/famous-display-names.json");
const famous = JSON.parse(readFileSync(famousPath, "utf8"));
delete famous["light-dn"];
delete famous["l-dn"];
famous["light-yagami"] = famous["light-yagami"] ?? "Light";
famous["ryuk-dn"] = "Ryuk";
writeFileSync(famousPath, `${JSON.stringify(famous, null, 2)}\n`, "utf8");

const wikiPath = resolve(root, "data/wiki-hints.json");
const wiki = JSON.parse(readFileSync(wikiPath, "utf8"));
delete wiki["light-dn"];
wiki["light-yagami"] = wiki["light-yagami"] ?? "Light Yagami";
wiki["ryuk-dn"] = "Ryuk";
writeFileSync(wikiPath, `${JSON.stringify(wiki, null, 2)}\n`, "utf8");

const catalogPath = resolve(root, "data/roster-batch2-catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
catalog[SERIES] = [
  ["l-lawliet", "L", "L (Death Note)", "l"],
  ["light-yagami", "Light", "Light Yagami", "light-yagami"],
  ["ryuk-dn", "Ryuk", "Ryuk", "ryuk"],
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

const ryukPortrait = join(portraitDir, "ryuk-dn.jpg");
if (!existsSync(ryukPortrait)) {
  for (const from of ["ryuk-hxh.jpg", "ryuk-hxh.webp", "shinigami-dn.jpg"]) {
    const src = join(portraitDir, from);
    if (existsSync(src)) {
      const buf = readFileSync(src);
      writeFileSync(ryukPortrait, buf);
      break;
    }
  }
}

console.log("Dropped:", [...dropSet].sort().join(", "));
console.log("Kept:", [...KEEP].join(", "));
