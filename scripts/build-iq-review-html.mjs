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

const roster = characters.map((c) => {
  const gameIq = c.stats?.iq ?? 40;
  const overrideIq = overrides[c.id];
  const current = overrideIq ?? gameIq;
  const p = proposal.get(c.id);
  const proposed = p?.proposed ?? current;
  const was = p?.was ?? current;
  const why =
    p?.why ??
    (proposed === current
      ? "No change in revision proposal; keeping current curated / in-game IQ."
      : "—");
  return {
    id: c.id,
    name: c.displayName,
    series: c.series ?? "",
    current: was,
    gameIq,
    overrideIq: overrideIq ?? null,
    proposed,
    pillars: p?.pillars ?? (p?.anchor ? `Anchor: ${p.anchor}` : null),
    why,
    changed: proposed !== was,
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
console.log("Wrote data/iq-revision-review.html (" + roster.length + " characters)");
