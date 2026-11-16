/**
 * Merge IQ export into manual-iq-overrides.json for the current roster.
 * Remaps dropped/renamed ids; resolves duplicate targets (prefers user-edited, then non-50).
 *
 * Usage: node scripts/import-iq-export-mapped.mjs <path-to-export.json>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Old roster id → current id (dedupe / franchise trims). */
const EXPLICIT_REMAP = {
  "acnologia-human-fairy-tail": "acnologia-anime",
  "ainz-overlord": "ainz-ooal-gown",
  "alice-sao": "alice-alicization",
  "hohe-brother-fma": "alphonse-elric",
  "alucard-hellsing": "alucard",
  "annie-crystal-aot": "annie-aot",
  "anos-voldigoad": "anos-misfit",
  "aomine-kuroko": "aomine-daiki",
  "armin-colossal-anime": "armin-aot",
  "asuna-alicization": "asuna-sao",
  "asuna-sao": "asuna-sao",
  "ymir-attack-aot": "ymir-attack-aot",
  "ban-sds": "ban-snatch",
  "bertolt-aot": "ymir-colossal-aot",
  "buddha-record-2": "buddha-record",
  "denji-chainsaw-csm": "denji-chainsaw",
  "dio-jojo": "dio-part-3",
  "dio-vampire-jojo": "dio-part-3",
  "edward-fma": "edward-elric",
  "envy-fma-catalog": "envy-fma",
  "eren-founding-anime": "eren-yeager-aot",
  "euclid-geass": "lelouch-vi-britannia",
  "father-god-fma": "father-fma",
  "gintoki-gintama": "sakata-gintoki",
  "gluttony-fma-catalog": "gluttony-fma",
  "goku-ui-dragon-ball": "goku-ssj2",
  "goku-black-dragon-ball": "goku-black",
  "vegeta-ssb-evolved-dragon-ball": "vegeta-ssb",
  "irene-dragon-fairy-tail": "irene-fairy-tail",
  "natsu-ignia-fairy-tail": "natsu-dragon-force",
  "zeref-fairy-tail": "zeref-anime",
  "jotaro-star-jojo": "jotaro-part-3",
  "yuta-rika-jjk": "yuta-jjk",
  "kuroko-tetsuya": "kuroko-kuroko",
  "mash-burnedead": "mash-mashle",
  "mash-demon-mashle": "mash-mashle",
  "mob-100-anime": "mob-100-mob",
  "toichiro-mob": "toichiro-suzuki",
  "shinichi-parasyte": "shinichi-izumi",
  "groudon-pokemon": "primal-groudon-anime",
  "kyogre-pokemon": "primal-kyogre-anime",
  "rayquaza-mega-pokemon": "rayquaza-anime",
  "meliodas-sds": "meliodas-assault",
  "igris-commander-sl": "igris-sl",
  "kirito-aw-sao": "kirito-stacia",
  "saiki-saiki": "kusuo-saiki",
  "mori-goh": "jin-mori-anime",
  "thors-vinland": "thors-snake",
  "levi-anime-aot": "levi-ackerman",
  "makima-csm": "makima",
  "reiner-armored-anime": "reiner-aot",
  "zeke-aot": "ymir-beast-aot",
  "light-dn": "light-yagami",
  "shinigami-dn": "ryuk-dn",
  "ryuk-hxh": "ryuk-dn",
  "gilgamesh-ea-fate": "gilgamesh-fsn",
  "l-dn": "l-lawliet",
  "primal-groudon-anime": "primal-groudon-anime",
};

const remapPath = resolve(root, "data/iq-export-id-remap.json");
if (existsSync(remapPath)) {
  Object.assign(
    EXPLICIT_REMAP,
    JSON.parse(readFileSync(remapPath, "utf8")),
  );
}

const exportPath = resolve(
  process.argv[2] ??
    resolve(
      root,
      "data/iq-revision-export-2026-11-13.json",
    ),
);
if (!existsSync(exportPath)) {
  console.error("Export not found:", exportPath);
  process.exit(1);
}

const exp = JSON.parse(readFileSync(exportPath, "utf8"));
const chars = JSON.parse(
  readFileSync(resolve(root, "data/characters.json"), "utf8"),
);
const rosterIds = new Set(chars.map((c) => c.id));

const bySeriesName = new Map();
for (const c of chars) {
  const key = `${c.series}\0${c.displayName.trim().toLowerCase()}`;
  if (!bySeriesName.has(key)) bySeriesName.set(key, c.id);
}

/** @type {Map<string, { series: string, displayName: string, edited: boolean }>} */
const exportMeta = new Map();
for (const row of exp.characters ?? []) {
  exportMeta.set(row.id, {
    series: row.series ?? "",
    displayName: row.displayName ?? "",
    edited: Boolean(row.editedByUser),
    finalIq: row.finalIq,
  });
}

function resolveTarget(oldId) {
  if (rosterIds.has(oldId)) return oldId;
  if (EXPLICIT_REMAP[oldId]) return EXPLICIT_REMAP[oldId];
  const meta = exportMeta.get(oldId);
  if (meta) {
    const key = `${meta.series}\0${meta.displayName.trim().toLowerCase()}`;
    const hit = bySeriesName.get(key);
    if (hit) return hit;
  }
  return null;
}

function iqFromExport(oldId) {
  const fromOverrides = exp.overrides?.[oldId];
  if (fromOverrides !== undefined) return Math.round(Number(fromOverrides));
  const meta = exportMeta.get(oldId);
  if (meta?.finalIq !== undefined) return Math.round(Number(meta.finalIq));
  return null;
}

/** @type {Map<string, { iq: number, from: string[], edited: boolean }>} */
const merged = new Map();

function candidateScore(oldId, target, iq, edited) {
  const direct =
    oldId === target && (edited || iq !== 50) ? 500_000 : 0;
  return direct + (edited ? 100_000 : 0) + (iq !== 50 ? 10_000 : 0) + iq;
}

for (const oldId of Object.keys(exp.overrides ?? {})) {
  const target = resolveTarget(oldId);
  const iq = iqFromExport(oldId);
  if (target == null || iq == null || !rosterIds.has(target)) continue;
  const edited =
    exportMeta.get(oldId)?.edited ||
    (exp.characters?.find((c) => c.id === oldId)?.editedByUser ?? false);
  const score = candidateScore(oldId, target, iq, edited);
  const prev = merged.get(target);
  if (!prev || score > prev.score) {
    merged.set(target, { iq, from: [...(prev?.from ?? []), oldId], edited, score });
  } else if (prev) {
    prev.from.push(oldId);
  }
}

const prevOverrides = JSON.parse(
  readFileSync(resolve(root, "data/manual-iq-overrides.json"), "utf8"),
);
const out = { ...prevOverrides };
let applied = 0;
const skipped = [];

for (const id of rosterIds) {
  const m = merged.get(id);
  if (m) {
    out[id] = m.iq;
    applied++;
  }
}

for (const oldId of Object.keys(exp.overrides ?? {})) {
  if (resolveTarget(oldId) == null) skipped.push(oldId);
}
writeFileSync(
  resolve(root, "data/iq-import-unresolved-ids.txt"),
  `${[...new Set(skipped)].sort().join("\n")}\n`,
  "utf8",
);

const sorted = Object.fromEntries(
  Object.keys(out)
    .filter((k) => rosterIds.has(k))
    .sort((a, b) => a.localeCompare(b))
    .map((k) => [k, out[k]]),
);

writeFileSync(
  resolve(root, "data/manual-iq-overrides.json"),
  `${JSON.stringify(sorted, null, 2)}\n`,
  "utf8",
);

const dupTargets = [...merged.entries()].filter(([, v]) => v.from.length > 1);
console.log(`Export: ${Object.keys(exp.overrides).length} overrides`);
console.log(`Applied to roster: ${applied} / ${rosterIds.size}`);
console.log(`Unresolved old ids: ${skipped.length}`);
console.log(`Remapped duplicate targets: ${dupTargets.length}`);
for (const [id, v] of dupTargets.slice(0, 20)) {
  console.log(`  ${id} <= ${v.from.join(", ")} (IQ ${v.iq})`);
}
if (dupTargets.length > 20) console.log(`  ... +${dupTargets.length - 20} more`);
