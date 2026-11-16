/**
 * Step 3: rebuild STR / SPD / ABL / DUR from the VS Battles database, following docs/STAT_RULES.md.
 *
 * - Strongest anime-canon form (anime-coverage.json; exempt series keep everything).
 * - STR = max(lifting score, striking tier score); SPD = physical speed only;
 *   ABL = attack potency score + hax; DUR = durability score + stamina + resistances / immortality.
 * - Hax and durability bonuses: computed from the form's Powers and Abilities list, then the manual layer
 *   in data/overrides/stat-adjustments.json (each entry has a reason) adds to or floors the result.
 * - IQ is never touched. Characters without a page keep their current stats (or the placeholder fill),
 *   marked "common knowledge".
 *
 * Run: npm run wiki:db-derive            (writes docs/reviews/STAT_REBUILD.md + data/generated/stat-rebuild.csv)
 *      npm run wiki:db-derive -- --apply (also writes the stats into data/overrides/manual-curated-stats.json)
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LIFTS, SPEEDS, TIERS, plain, rankSpeed } from "./parse.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const R = (...p: string[]) => resolve(root, ...p);
const readJson = (p: string, d: any = {}) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : d);
const apply = process.argv.includes("--apply");

// ---------- scales (docs/STAT_RULES.md) ----------
const TIER_SCORE: Record<string, number> = {
  "11-C": 0, "11-B": 1, "11-A": 2, "10-C": 4, "10-B": 8, "10-A": 12, "9-C": 16, "9-B": 20, "9-A": 24, "8-C": 28, "High 8-C": 31,
  "8-B": 34, "8-A": 37, "Low 7-C": 40, "7-C": 42, "High 7-C": 44, "Low 7-B": 46, "7-B": 48, "7-A": 51, "High 7-A": 53,
  "6-C": 55, "High 6-C": 57, "Low 6-B": 59, "6-B": 61, "High 6-B": 63, "6-A": 65, "High 6-A": 67, "5-C": 69, "Low 5-B": 71,
  "5-B": 73, "5-A": 75, "High 5-A": 77, "Low 4-C": 79, "4-C": 80, "High 4-C": 81, "4-B": 83, "4-A": 84, "3-C": 86, "3-B": 87,
  "3-A": 88, "High 3-A": 89, "Low 2-C": 90, "2-C": 91, "2-B": 92, "2-A": 93, "Low 1-C": 94, "1-C": 95, "High 1-C": 96,
  "1-B": 97, "High 1-B": 97, "Low 1-A": 98, "1-A": 98, "High 1-A": 99, "0": 100,
};
const SPEED_SCORE: Record<string, number> = {
  "below average human": 4, "normal human": 8, "average human": 8, "athletic human": 12, "peak human": 16, "superhuman": 20,
  "subsonic": 24, "subsonic+": 27, "transonic": 30, "supersonic": 33, "supersonic+": 36, "hypersonic": 40, "hypersonic+": 44,
  "high hypersonic": 48, "high hypersonic+": 51, "massively hypersonic": 55, "massively hypersonic+": 58, "sub-relativistic": 62,
  "sub-relativistic+": 64, "relativistic": 67, "relativistic+": 69, "speed of light": 71, "ftl": 74, "ftl+": 77,
  "massively ftl": 82, "massively ftl+": 87, "infinite": 93, "immeasurable": 97, "irrelevant": 99, "omnipresent": 99,
};
const LIFT_SCORE: Record<string, number> = {
  "below average": 4, "regular human": 8, "average human": 8, "athletic human": 12, "peak human": 16, "superhuman": 22, "class 1": 22,
  "class 5": 24, "class 10": 26, "class 25": 28, "class 50": 30, "class 100": 33, "class k": 38, "class m": 44, "class g": 50,
  "class t": 56, "class p": 62, "class e": 68, "class z": 74, "class y": 79, "stellar": 83, "multi-stellar": 85, "galactic": 87,
  "multi-galactic": 88, "universal": 89, "multiversal": 92, "infinite": 96, "immeasurable": 98, "irrelevant": 100,
};
const tierScore = (code: string | null) => (code && code in TIER_SCORE ? TIER_SCORE[code] : null);

/** Physical speed: drop clauses about teleporting / instant travel / time stop before ranking (STAT_RULES). */
// Teleport-type movement is an ability, not speed. Speed a character boosts with their own abilities
// (Gojo's Blue, Shunpo/flash steps, Gears, Gates, ki or cursed-energy reinforcement) IS physical speed (owner rule).
const NON_PHYSICAL = /teleport|instant(?:aneous)? (?:transmission|travel|movement)|instant transmission|time ?stop|stops? time|omnipresen|flying raijin|flying thunder god|warp|portal|dimensional travel|reaction speed via precog/i;
function physicalSpeed(text: string) {
  const clauses = text.split(/\s*(?:\||;|,(?![^()]*\)))\s*/);
  const kept = clauses.filter((c) => !NON_PHYSICAL.test(c));
  return rankSpeed(kept.join(", ") || "");
}
/** Unquantified ability boosts in the speed row ("higher with Blue", "far higher with Gear 4"): +4 / +8. */
function speedBoost(text: string): number {
  const kept = text.split(/\s*(?:\||;|,(?![^()]*\)))\s*/).filter((c) => !NON_PHYSICAL.test(c)).join(", ");
  if (/\b(?:far|much|significantly|vastly) higher\b[^,;|]*\bwith\b/i.test(kept)) return 8;
  if (/\bhigher\b[^,;|]*\bwith\b/i.test(kept)) return 4;
  return 0;
}

// ---------- hax and durability bonuses from the Powers and Abilities list ----------
const DECISIVE = /reality warping|causality manipulation|conceptual manipulation|existence erasure|time manipulation|time stop|time reversal|plot manipulation|fate manipulation|probability manipulation|acausality|nonexistent physiology|law manipulation|void manipulation|abstract existence/i;
const MAJOR = /soul manipulation|power nullification|absorption|power mimicry|spatial manipulation|space-time manipulation|mind manipulation|death manipulation|durability negation|regeneration negation|sealing|petrification|matter manipulation|biological manipulation|life manipulation|memory manipulation|gravity manipulation|telekinesis|transmutation|statistics reduction|curse manipulation|information manipulation|dimensional manipulation|subjective reality|creation|resurrection|black hole creation|power bestowal|corruption|transduality/i;
const MINOR = /manipulation|projection|creation|summoning|enhanced senses|precognition|barrier|forcefield|poison|paralysis|illusion|invisibility|intangibility|duplication|shapeshifting|flight|fusionism|empowerment|statistics amplification/i;
const RESIST = /resistance/i;

function haxPoints(abilities: { ability: string; detail: string }[]) {
  const seen = new Set<string>();
  let d = 0, m = 0, n = 0;
  const top: string[] = [];
  for (const a of abilities) {
    const name = a.ability.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    if (DECISIVE.test(name)) { d++; if (top.length < 6) top.push(name); }
    else if (MAJOR.test(name)) { m++; if (top.length < 6) top.push(name); }
    else if (MINOR.test(name)) n++;
  }
  // 0..30 hax points, diminishing: a decisive ability matters far more than many minor ones.
  const pts = Math.min(30, 6 * Math.sqrt(d) * (d ? 1.6 : 0) + 3 * Math.sqrt(m) + 0.4 * Math.sqrt(n) * 3);
  return { pts, d, m, n, top };
}

function durabilityPoints(abilities: { ability: string; detail: string }[]) {
  let pts = 0;
  const why: string[] = [];
  const text = abilities.map((a) => `${a.ability} ${a.detail}`).join(" \n ");
  const regen = text.match(/regeneration[^\n]{0,80}?\b(high-godly|mid-godly|low-godly|true godly|high-mid|mid-high|high|mid|low-mid|low)\b/i);
  const regenPts: Record<string, number> = { "true godly": 10, "high-godly": 9, "mid-godly": 8, "low-godly": 7, "high": 5, "high-mid": 4, "mid-high": 4, "mid": 3, "low-mid": 2, "low": 1 };
  if (regen) { pts += regenPts[regen[1].toLowerCase()] ?? 0; why.push(`Regeneration (${regen[1]})`); }
  const immortal = [...text.matchAll(/immortality[^\n]{0,60}?types?\s*([\d,&\s and]+)/gi)].flatMap((m) => m[1].match(/\d/g) ?? []);
  const types = new Set(immortal);
  if (types.size) {
    const existential = [...types].filter((t) => ["4", "5", "8", "9"].includes(t)).length;
    pts += Math.min(10, types.size * 1.5 + existential * 2);
    why.push(`Immortality (Types ${[...types].sort().join(", ")})`);
  }
  const resist = abilities.filter((a) => RESIST.test(a.ability) || /resistance to/i.test(a.detail)).length;
  const resistedHax = abilities.filter((a) => DECISIVE.test(a.ability) || MAJOR.test(a.ability)).length;
  if (resist) { const r = Math.min(6, 1 + resistedHax * 0.25); pts += r; why.push("resistances"); }
  return { pts: Math.min(22, pts), why };
}

// ---------- main ----------
const db = new DatabaseSync(R("data/wiki-db/vsb-stats.sqlite"), { readOnly: true });
const coverage = readJson(R("data/sources/anime-coverage.json"));
const exempt = new Set<string>(coverage.exempt);
const roster = readJson(R("data/characters.json"), []) as any[];
const adjustments = readJson(R("data/overrides/stat-adjustments.json"));
const placeholderFill = readJson(R("data/sources/placeholder-fill-values.json"));

type Row = { id: string; name: string; series: string; old: any; neu: any; form: string; page: string; source: string; reason: string };
const rows: Row[] = [];

const formsOf = db.prepare(`SELECT f.id, f.page_title, f.key_index, f.key_name, f.canon_source FROM forms f WHERE f.page_title = ? OR ? LIKE '%"' || f.page_title || '"%'`);
const statsOf = db.prepare(`SELECT category, plain_text, tier_code, rank_value, canon_source FROM stats WHERE form_id = ?`);
const abilitiesOf = db.prepare(`SELECT ability, detail, section, canon_source FROM abilities WHERE page_title = ?`);
const charOf = db.prepare(`SELECT * FROM characters WHERE game_id = ?`);

for (const c of roster) {
  const old = { strength: c.stats.strength, speed: c.stats.speed, abilities: c.stats.abilities, durability: c.stats.durability };
  const info = charOf.get(c.id) as any;
  const adj = adjustments[c.id] ?? {};
  const isExempt = exempt.has(c.series);
  // Game and non-canon spin-off content never counts; manga-only and not-yet-aired content only for exempt series.
  const allowed = (src: string) => src !== "game" && (isExempt || (src !== "manga" && src !== "unclear"));

  let neu: any = null, form = "", page = "", source = "", reason = "";
  if (info?.page_title) {
    const forms = (formsOf.all(info.page_title, info.related_titles ?? "[]") as any[]).filter((f) => allowed(f.canon_source));
    let best: any = null;
    for (const f of forms) {
      const st = Object.fromEntries((statsOf.all(f.id) as any[]).filter((s) => allowed(s.canon_source)).map((s) => [s.category, s]));
      const tier = tierScore(st.tier?.tier_code) ?? 0;
      const ap = tierScore(st.attack_potency?.tier_code) ?? tier;
      const strike = tierScore(st.striking_strength?.tier_code);
      const lift = st.lifting_strength?.tier_code ? LIFT_SCORE[String(st.lifting_strength.tier_code).toLowerCase()] ?? null : null;
      const str = Math.max(strike ?? 0, lift ?? 0) || ap;
      const sp = st.speed ? physicalSpeed(st.speed.plain_text) : null;
      const spdBase = sp && SPEED_SCORE[sp.value] != null ? SPEED_SCORE[sp.value] : null;
      const spd = spdBase == null ? null : Math.max(spdBase, Math.min(97, spdBase + speedBoost(st.speed.plain_text)));
      const dur = tierScore(st.durability?.tier_code) ?? tier;
      const stamina = st.stamina?.plain_text ?? "";
      const stam = /limitless|infinite|nigh[- ]?(?:limitless|infinite)|tireless/i.test(stamina) ? 2 : /\b(low|poor|below average)\b/i.test(stamina) ? -2 : 0;
      const total = tier * 4 + str + (spd ?? 0) + ap + dur;
      if (!best || total > best.total) best = { f, tier, str, spd, ap, dur, stam, total, st };
    }
    if (best && best.tier > 0) {
      const abil = (abilitiesOf.all(best.f.page_title) as any[]).filter((a) => allowed(a.canon_source));
      const hax = haxPoints(abil);
      const durx = durabilityPoints(abil);
      const ablBase = best.ap;
      // Bonuses shrink as the base tier rises, so the 90s don't all saturate at 100 (manual floors handle true outliers).
      let abl = Math.round(ablBase + Math.max(0, Math.min(97 - ablBase, hax.pts * (1 - ablBase / 112))));
      let dur = Math.round(best.dur + best.stam + Math.max(0, Math.min(97 - best.dur, durx.pts * (1 - best.dur / 112) * (best.dur < 30 ? 0.6 : 1))));
      let str = best.str, spd = best.spd ?? old.speed;
      if (adj.abl) abl += adj.abl;
      if (adj.abl_min) abl = Math.max(abl, adj.abl_min);
      if (adj.dur) dur += adj.dur;
      if (adj.dur_min) dur = Math.max(dur, adj.dur_min);
      if (adj.str) str += adj.str;
      if (adj.spd) spd += adj.spd;
      if (adj.spd_min) spd = Math.max(spd, adj.spd_min);
      const clamp = (n: number) => Math.max(1, Math.min(100, Math.round(n)));
      neu = { strength: clamp(str), speed: clamp(spd), abilities: clamp(abl), durability: clamp(dur) };
      if (adj.set) neu = { ...neu, ...adj.set }; // explicit values win (e.g. a wiki row the parser misreads)
      form = best.f.key_name;
      page = best.f.page_title;
      source = adj.reason ? "wiki + manual" : "wiki";
      const bits = [`tier ${best.st.tier?.tier_code ?? "?"}`, best.st.speed ? `speed ${physicalSpeed(best.st.speed.plain_text)?.value ?? "?"}` : "speed: kept"];
      if (hax.top.length) bits.push(`hax: ${hax.top.slice(0, 4).join(", ")}`);
      if (durx.why.length) bits.push(`dur+: ${durx.why.join(", ")}`);
      if (adj.reason) bits.push(`manual: ${adj.reason}`);
      reason = bits.join("; ");
    }
  }
  if (!neu) {
    // No usable wiki page: keep the current values; replace 50-placeholders with the earlier series-knowledge fill.
    const fill = placeholderFill[c.id];
    const isPlaceholder = [old.strength, old.speed, old.abilities, old.durability].every((v) => v === 50);
    neu = fill && isPlaceholder ? { strength: fill[0], speed: fill[1], abilities: fill[2], durability: fill[4] } : { ...old };
    source = "common knowledge";
    reason = info?.page_title ? "page has no parsable stats; current values kept" : fill && isPlaceholder ? `series-knowledge estimate: ${fill[5]}` : (info?.reason ?? "no VS Battles page") + "; current values kept";
    // Manual series-knowledge values for characters without usable wiki stats.
    if (adj.set) { neu = { ...neu, ...adj.set }; reason = `series-knowledge (manual): ${adj.reason}`; }
  }
  rows.push({ id: c.id, name: c.displayName, series: c.series, old, neu, form, page, source, reason });
}

// ---------- outputs ----------
const sum = (s: any) => s.strength + s.speed + s.abilities + s.durability;
const delta = (r: Row) => sum(r.neu) - sum(r.old);
const fmt = (s: any) => `${s.strength}/${s.speed}/${s.abilities}/${s.durability}`;
const link = (t: string) => (t ? `[${t}](https://vsbattles.fandom.com/wiki/${encodeURIComponent(t.replace(/ /g, "_"))})` : "–");
const md: string[] = [];
md.push("# Stat rebuild (STR / SPD / ABL / DUR)", "", `Generated by \`npm run wiki:db-derive\` on ${new Date().toISOString().slice(0, 10)} following [STAT_RULES.md](../STAT_RULES.md). IQ is unchanged. Values are STR/SPD/ABL/DUR.`, "");
const bySource = rows.reduce((m: any, r) => ((m[r.source] = (m[r.source] ?? 0) + 1), m), {});
md.push(`Characters: ${rows.length}. Source: ${Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(", ")}.`, "");
md.push("## Biggest increases", "", "| Character | Series | Old | New | Change |", "|---|---|---|---|---:|",
  ...[...rows].sort((a, b) => delta(b) - delta(a)).slice(0, 25).map((r) => `| ${r.name} | ${r.series} | ${fmt(r.old)} | ${fmt(r.neu)} | +${delta(r)} |`), "");
md.push("## Biggest decreases", "", "| Character | Series | Old | New | Change |", "|---|---|---|---|---:|",
  ...[...rows].sort((a, b) => delta(a) - delta(b)).slice(0, 25).map((r) => `| ${r.name} | ${r.series} | ${fmt(r.old)} | ${fmt(r.neu)} | ${delta(r)} |`), "");
for (const [stat, label] of [["strength", "STR"], ["speed", "SPD"], ["abilities", "ABL"], ["durability", "DUR"]] as const) {
  md.push(`## Top 20 ${label}`, "", ...[...rows].sort((a, b) => b.neu[stat] - a.neu[stat]).slice(0, 20).map((r, i) => `${i + 1}. ${r.name} (${r.series}): ${r.neu[stat]}`), "");
}
for (const s of ["Dragon Ball", "Naruto", "Bleach", "One Piece", "Jujutsu Kaisen"]) {
  md.push(`## Ladder: ${s}`, "", ...rows.filter((r) => r.series === s).sort((a, b) => sum(b.neu) - sum(a.neu)).map((r) => `- ${r.name}: ${fmt(r.neu)} (was ${fmt(r.old)})`), "");
}
md.push("## Every character", "", "| Character | Series | Old | New | Form | Page | Source | Reason |", "|---|---|---|---|---|---|---|---|",
  ...[...rows].sort((a, b) => (a.series + a.name).localeCompare(b.series + b.name)).map((r) =>
    `| ${r.name} | ${r.series} | ${fmt(r.old)} | ${fmt(r.neu)} | ${r.form.replace(/\|/g, "/") || "–"} | ${link(r.page)} | ${r.source} | ${r.reason.replace(/\|/g, "/")} |`));
writeFileSync(R("docs/reviews/STAT_REBUILD.md"), md.join("\n") + "\n");
mkdirSync(R("data/generated"), { recursive: true });
const csv = ["id,name,series,old_str,old_spd,old_abl,old_dur,new_str,new_spd,new_abl,new_dur,form,page,source,reason",
  ...rows.map((r) => [r.id, r.name, r.series, r.old.strength, r.old.speed, r.old.abilities, r.old.durability, r.neu.strength, r.neu.speed, r.neu.abilities, r.neu.durability, r.form, r.page, r.source, r.reason]
    .map((v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(","))];
writeFileSync(R("data/generated/stat-rebuild.csv"), csv.join("\n") + "\n");
console.log(`rebuilt ${rows.length}: ${JSON.stringify(bySource)} → docs/reviews/STAT_REBUILD.md, data/generated/stat-rebuild.csv`);

if (apply) {
  const p = R("data/overrides/manual-curated-stats.json");
  const raw = readFileSync(p, "utf8");
  const cur = JSON.parse(raw);
  for (const r of rows) cur[r.id] = { strength: r.neu.strength, speed: r.neu.speed, abilities: r.neu.abilities, durability: r.neu.durability };
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  writeFileSync(p, JSON.stringify(cur, null, 2).replace(/\n/g, eol) + eol);
  console.log(`wrote ${rows.length} entries to data/overrides/manual-curated-stats.json; run npm run data:apply`);
}
