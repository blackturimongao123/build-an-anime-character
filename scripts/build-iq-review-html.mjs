/**
 * Builds data/iq-revision-review.html from characters.json + IQ_REVISION_PROPOSAL.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");

const characters = JSON.parse(
  fs.readFileSync(path.join(dataDir, "characters.json"), "utf8")
);
const overrides = JSON.parse(
  fs.readFileSync(path.join(dataDir, "manual-iq-overrides.json"), "utf8")
);
const proposalMd = fs.readFileSync(
  path.join(dataDir, "IQ_REVISION_PROPOSAL.md"),
  "utf8"
);

/** @type {Map<string, { was: number, proposed: number, pillars?: string, why: string, anchor?: string }>} */
const proposal = new Map();

const pipeCount = (s) => (s.match(/\|/g) || []).length;

let section = "";
const anchorRe =
  /^\| `([^`]+)` \| (\d+) \| \*\*(\d+)\*\* \| ([^|]+) \|$/;
for (const line of proposalMd.split("\n")) {
  const h = line.match(/^## Anchor: (.+)/);
  if (h) section = h[1];
  if (pipeCount(line) !== 5) continue;
  const row = line.match(anchorRe);
  if (row) {
    proposal.set(row[1], {
      was: Number(row[2]),
      proposed: Number(row[3]),
      why: row[4].trim(),
      anchor: section || undefined,
    });
  }
}

const changeRe =
  /^\| `([^`]+)` \| (\d+) \| \*\*(\d+)\*\* \| ([^|]+) \| (.+) \|$/;
for (const line of proposalMd.split("\n")) {
  if (pipeCount(line) !== 6) continue;
  const row = line.match(changeRe);
  if (!row) continue;
  const id = row[1];
  if (proposal.has(id)) continue;
  proposal.set(id, {
    was: Number(row[2]),
    proposed: Number(row[3]),
    pillars: row[4].trim(),
    why: row[5].trim(),
  });
}

/** IDs with reviewed IQ (proposal row or applied export), even when IQ is 50. */
const curatedIqIds = new Set(proposal.keys());
const appliedExportPath = path.join(
  dataDir,
  "iq-revision-export-applied-2026-11-12.json",
);
if (fs.existsSync(appliedExportPath)) {
  const applied = JSON.parse(fs.readFileSync(appliedExportPath, "utf8"));
  if (applied.overrides && typeof applied.overrides === "object") {
    for (const id of Object.keys(applied.overrides)) curatedIqIds.add(id);
  }
}

const roster = characters.map((c) => {
  const gameIq = Math.min(
    100,
    Math.max(0, Math.round(Number(c.stats?.iq) || 50)),
  );
  const overrideIq = overrides[c.id];
  const current = gameIq;
  const p = proposal.get(c.id);
  const baseline = p?.was ?? overrideIq ?? gameIq;
  const proposed = p?.proposed ?? overrideIq ?? gameIq;
  const physical = [
    c.stats?.strength,
    c.stats?.speed,
    c.stats?.abilities,
    c.stats?.durability,
  ].map((v) => Math.round(Number(v) || 0));
  const statsPlaceholder = physical.every((v) => v === 50);
  const iqPlaceholder = gameIq === 50 && !curatedIqIds.has(c.id);
  const why =
    p?.why ??
    (p
      ? "—"
      : iqPlaceholder
        ? "Placeholder IQ (default 50) — not yet in revision proposal; set a real score and export."
        : "No IQ row in revision proposal; showing current in-game IQ (edit and export to curate).");
  return {
    id: c.id,
    name: c.displayName,
    series: c.series ?? "",
    current,
    baseline,
    gameIq,
    overrideIq: overrideIq ?? null,
    proposed,
    pillars: p?.pillars ?? (p?.anchor ? `Anchor: ${p.anchor}` : null),
    why,
    changed: proposed !== baseline,
    inProposal: Boolean(p),
    iqPlaceholder,
    statsPlaceholder,
  };
});

roster.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

const payload = JSON.stringify(roster);
const framework = proposalMd.split("---")[0].trim();

const tplPath = path.join(__dirname, "iq-revision-review.template.html");
let html = fs.readFileSync(tplPath, "utf8");
html = html
  .replace("/*ROSTER_JSON*/", payload)
  .replace("/*FRAMEWORK_JSON*/", JSON.stringify(framework));
fs.writeFileSync(path.join(dataDir, "iq-revision-review.html"), "\uFEFF" + html, "utf8");
const placeholderIq = roster.filter((c) => c.iqPlaceholder).length;
console.log(
  "Wrote data/iq-revision-review.html (" +
    roster.length +
    " characters, " +
    placeholderIq +
    " placeholder IQ)",
);
