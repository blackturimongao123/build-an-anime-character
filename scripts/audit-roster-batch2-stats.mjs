/**
 * Stats health check for ids in data/roster-batch2-new-ids.txt
 * Output: data/roster-batch2-stats-review.json + data/ROSTER_BATCH2_STATS.md
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ids = readFileSync(resolve(root, "data/roster-batch2-new-ids.txt"), "utf8")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const chars = JSON.parse(readFileSync(resolve(root, "data/characters.json"), "utf8"));
const byId = new Map(chars.map((c) => [c.id, c]));
const audit = JSON.parse(
  readFileSync(resolve(root, "data/physical-stat-audit.json"), "utf8"),
);
const auditById = new Map(audit.rows.map((r) => [r.id, r]));
let statsCheck = null;
const scPath = resolve(root, "data/stats-check-report.json");
if (existsSync(scPath)) {
  statsCheck = JSON.parse(readFileSync(scPath, "utf8"));
}
const scById = new Map(
  (statsCheck?.results ?? []).map((r) => [r.id, r]),
);
const scrapeDir = resolve(root, "data/wiki-db/scrapes");

function bucket(c) {
  const s = c.stats;
  const phys = [s.strength, s.speed, s.abilities, s.durability];
  if (phys.every((v) => v === 50)) return "placeholder_50";
  if (phys.every((v) => v === 40)) return "uniform_40";
  if (phys.every((v) => v === 70)) return "uniform_70";
  return "assigned";
}

const summary = {
  total: ids.length,
  missing_char: 0,
  placeholder_50: 0,
  uniform_40: 0,
  uniform_70: 0,
  assigned: 0,
  no_scrape: 0,
  scrape_no_slices: 0,
  scrape_ok: 0,
  audit: {},
  stats_check: { ok: 0, diff: 0, err: 0, placeholder: 0 },
};

const bySeries = {};
const placeholderIds = [];
const noScrapeIds = [];
const uniform40Ids = [];
const statsCheckDiff = [];
const statsCheckErr = [];

for (const id of ids) {
  const c = byId.get(id);
  if (!c) {
    summary.missing_char++;
    continue;
  }
  const b = bucket(c);
  summary[b] = (summary[b] ?? 0) + 1;
  if (b === "placeholder_50") placeholderIds.push(id);
  if (b === "uniform_40") uniform40Ids.push(id);

  bySeries[c.series] ??= {
    total: 0,
    placeholder_50: 0,
    assigned: 0,
    mismatch: 0,
    aligned: 0,
    no_wiki: 0,
    peak_above: 0,
  };
  const ser = bySeries[c.series];
  ser.total++;
  if (b === "placeholder_50") ser.placeholder_50++;
  else ser.assigned++;

  const sf = join(scrapeDir, `${id}.json`);
  if (!existsSync(sf)) {
    summary.no_scrape++;
    ser.no_wiki++;
    noScrapeIds.push(id);
    continue;
  }
  const sc = JSON.parse(readFileSync(sf, "utf8"));
  if (!sc.slices?.length) {
    summary.scrape_no_slices++;
    continue;
  }
  summary.scrape_ok++;

  const row = auditById.get(id);
  if (!row) continue;
  for (const st of row.status ?? []) {
    summary.audit[st] = (summary.audit[st] ?? 0) + 1;
  }
  if ((row.status ?? []).includes("aligned_wiki_path")) ser.aligned++;
  if ((row.status ?? []).includes("wiki_path_mismatch")) ser.mismatch++;
  if ((row.status ?? []).includes("wiki_peak_above_game")) ser.peak_above++;

  const check = scById.get(id);
  if (check) {
    if (check.error || !check.ok) {
      if (check.error?.includes("No parse")) summary.stats_check.err++;
      else if (b === "placeholder_50") summary.stats_check.placeholder++;
      else summary.stats_check.err++;
    } else if (check.delta && Object.keys(check.delta).length) {
      summary.stats_check.diff++;
      statsCheckDiff.push({ id, delta: check.delta, wiki: check.wiki_page });
    } else summary.stats_check.ok++;
    if (check.error) {
      statsCheckErr.push({ id, error: check.error });
    }
  }
}

const out = {
  generated: new Date().toISOString(),
  new_roster_count: ids.length,
  summary,
  by_series: Object.fromEntries(
    Object.entries(bySeries).sort((a, b) => b[1].placeholder_50 - a[1].placeholder_50),
  ),
  placeholder_ids: placeholderIds,
  no_scrape_ids: noScrapeIds,
  uniform_40_ids: uniform40Ids,
  stats_check_diff: statsCheckDiff,
  stats_check_errors: statsCheckErr,
};

writeFileSync(
  resolve(root, "data/roster-batch2-stats-review.json"),
  JSON.stringify(out, null, 2) + "\n",
);

let md = "# Batch 2 new character stats review\n\n";
md += `Generated from \`roster-batch2-new-ids.txt\` (${ids.length} ids).\n\n`;
md += "| Metric | Count |\n|--------|------:|\n";
md += `| Placeholder **50** (wiki not applied) | ${summary.placeholder_50} |\n`;
md += `| Wiki-applied stats | ${summary.assigned} |\n`;
md += `| Uniform 40 / 70 (suspicious) | ${summary.uniform_40} / ${summary.uniform_70} |\n`;
md += `| No scrape JSON | ${summary.no_scrape} |\n`;
md += `| Scrape with slices | ${summary.scrape_ok} |\n`;
md += `| Scrape empty | ${summary.scrape_no_slices} |\n\n`;
if (existsSync(scPath)) {
  md += "### stats-check (live wiki parse vs game)\n\n";
  md += `- OK / aligned parse: **${summary.stats_check.ok}**\n`;
  md += `- DIFF (mapper disagrees with stored): **${summary.stats_check.diff}**\n`;
  md += `- ERR / no parse: **${summary.stats_check.err}**\n`;
  md += `- Still placeholder @50: **${summary.stats_check.placeholder}**\n\n`;
}
md += "### Physical audit labels (wiki DB path vs game)\n\n";
for (const [k, v] of Object.entries(summary.audit).sort((a, b) => b[1] - a[1])) {
  md += `- ${k}: **${v}**\n`;
}
md += "\n### By series\n\n";
md +=
  "| Series | New | @50 | Applied | Aligned path | Mismatch | Peak > game | No scrape |\n";
md +=
  "|--------|------:|----:|--------:|-------------:|---------:|------------:|----------:|\n";
for (const [s, d] of Object.entries(bySeries).sort(
  (a, b) => b[1].placeholder_50 - a[1].placeholder_50,
)) {
  md += `| ${s} | ${d.total} | ${d.placeholder_50} | ${d.assigned} | ${d.aligned} | ${d.mismatch} | ${d.peak_above} | ${d.no_wiki} |\n`;
}
writeFileSync(resolve(root, "data/ROSTER_BATCH2_STATS.md"), md);

console.log(
  `Batch2 stats: placeholder=${summary.placeholder_50} applied=${summary.assigned} no_scrape=${summary.no_scrape}`,
);
console.log("→ data/ROSTER_BATCH2_STATS.md");
