/**
 * Step 1: match every roster character to its VS Battles page(s).
 *
 * For each series: collect the franchise's character titles from Category:<franchise> and the
 * franchise page's links (stored as franchise_pages). Match roster characters against them by
 * known titles (hint files, earlier scrapes, batch catalog), then by name. Search is only a fallback,
 * and every chosen page is fetched and checked: not a disambiguation page, and in the right series.
 *
 * Run: npm run wiki:db-resolve   (writes data/wiki-db/vsb-stats.sqlite)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VsbApi } from "./api.js";
import { openDb } from "./db.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const R = (...p: string[]) => resolve(root, ...p);
const readJson = (p: string, fallback: any = {}) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : fallback);

type Char = { id: string; displayName: string; series: string; status: "live" | "held" };

const seriesCfg = readJson(R("data/sources/series-codes.json"));
/** id -> exact VS Battles title, for characters known by another name (Chad = Yasutora Sado). */
const aliases: Record<string, string> = Object.fromEntries(
  Object.entries(readJson(R("data/sources/vsb-aliases.json"))).filter(([k]) => !k.startsWith("_")) as [string, string][],
);

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const wikiTitles: Record<string, string[]> = seriesCfg.wikiTitles;

// Media variants we don't want as the main page (anime canon is the default; Solo Leveling uses novels).
const AVOID = /\((Manga|Live Action|Games?|Video Games?|Stage Play|Spore|Webtoon|Light Novel|Web Novel|Novel)\)$/i;
const AVOID_EXCEPT_NOVEL = /\((Live Action|Games?|Video Games?|Stage Play|Spore)\)$/i;

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const base = (t: string) => t.replace(/\s*\([^)]*\)\s*$/, "");
const tokens = (s: string) => norm(s).split(" ").filter(Boolean);

function rosterCharacters(): Char[] {
  const live = readJson(R("data/characters.json"), []) as any[];
  const heldPath = R("data/generated/held-back-roster.json");
  const held = readJson(heldPath, []) as any[];
  const seen = new Set<string>();
  const out: Char[] = [];
  for (const c of live) { seen.add(c.id); out.push({ id: c.id, displayName: c.displayName, series: c.series, status: "live" }); }
  for (const c of held) if (!seen.has(c.id)) out.push({ id: c.id, displayName: c.displayName, series: c.series, status: "held" });
  return out;
}

/** Titles we already know for an id: hint files, earlier scrapes, batch catalog. */
function knownTitles(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (id: string, t: unknown) => { if (typeof t === "string" && t.trim()) m.set(id, [...(m.get(id) ?? []), t.trim()]); };
  for (const [id, t] of Object.entries(readJson(R("data/sources/wiki-hints.json")))) add(id, t);
  const scrapes = R("data/wiki-db/scrapes");
  if (existsSync(scrapes)) for (const f of readdirSync(scrapes)) {
    try { const j = JSON.parse(readFileSync(resolve(scrapes, f), "utf8")); add(j.id, j.wikiTitle); } catch { /* skip */ }
  }
  const catalog = readJson(R("data/sources/roster-batch2-catalog.json"));
  for (const rows of Object.values(catalog) as any[]) if (Array.isArray(rows)) for (const r of rows) if (Array.isArray(r)) add(r[0], r[2]);
  return m;
}

async function main() {
  const api = new VsbApi(R("data/wiki-db/vsb-cache.sqlite"));
  const db = openDb(R("data/wiki-db/vsb-stats.sqlite"));
  const chars = rosterCharacters();
  const known = knownTitles();
  const onlySeries = process.argv.find((a) => a.startsWith("--series="))?.slice(9);

  // ---- franchise pools ----
  const pools = new Map<string, Set<string>>();
  const seriesCats = new Map<string, Set<string>>(); // category names that prove a page belongs to the series
  for (const series of Object.keys(wikiTitles)) {
    if (onlySeries && series !== onlySeries) continue;
    const pool = new Set<string>();
    const cats = new Set<string>();
    for (const t of wikiTitles[series]) {
      cats.add(t.replace(/ /g, "_"));
      const members = await api.categoryMembers(`Category:${t}`);
      for (const m of members) if (m.ns === 0 && m.title !== t) pool.add(m.title);
      const page = await api.page(t);
      if (page) {
        cats.add(page.title.replace(/ /g, "_"));
        for (const l of page.links) pool.add(l);
      }
    }
    pools.set(series, pool);
    seriesCats.set(series, cats);
    db.prepare("DELETE FROM franchise_pages WHERE series = ?").run(series);
    const ins = db.prepare("INSERT OR IGNORE INTO franchise_pages (series, page_title) VALUES (?, ?)");
    for (const t of pool) ins.run(series, t);
  }
  console.log(`franchise pools: ${[...pools.values()].reduce((a, p) => a + p.size, 0)} titles across ${pools.size} series (${api.requests} requests)`);

  // ---- match ----
  const upsert = db.prepare(`INSERT OR REPLACE INTO characters
    (game_id, display_name, series, status, page_title, related_titles, match_method, confidence, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let done = 0;
  for (const c of chars) {
    if (onlySeries && c.series !== onlySeries) continue;
    const pool = pools.get(c.series) ?? new Set<string>();
    const cats = seriesCats.get(c.series) ?? new Set<string>();
    const avoid = c.series === "Solo Leveling" ? AVOID_EXCEPT_NOVEL : AVOID;
    const nameTokens = tokens(c.displayName);

    /** Fetch a title and check it is a character page of this series; follows disambiguation pages. */
    const verify = async (title: string, depth = 0): Promise<{ title: string; note: string } | null> => {
      const p = await api.page(title);
      if (!p) return null;
      const isDisambig = p.categories.some((x) => /Disambiguation/i.test(x));
      if (isDisambig) {
        if (depth > 0) return null;
        const options = p.links.filter((l) => !avoid.test(l)).sort((a, b) => Number(pool.has(b)) - Number(pool.has(a)));
        for (const o of options) {
          const v = await verify(o, 1);
          if (v) return { title: v.title, note: `via disambiguation "${p.title}"` };
        }
        return null;
      }
      const inSeries = pool.has(p.title) || p.categories.some((x) => cats.has(x)) ||
        [...cats].some((cat) => new RegExp(`'''Origin:'''\\s*\\[\\[${cat.replace(/_/g, " ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(p.wikitext));
      if (!inSeries) return null;
      if (!/Powers and Stats/i.test(p.wikitext)) return null;
      return { title: p.title, note: "" };
    };

    let chosen: { title: string; method: string; confidence: string; reason: string } | null = null;

    // 0) hand-made aliases (data/sources/vsb-aliases.json), then 1) known titles
    for (const t of [...(aliases[c.id] ? [aliases[c.id]] : [])]) {
      const v = await verify(t);
      if (v) { chosen = { title: v.title, method: "alias", confidence: "high", reason: `alias "${t}" ${v.note}`.trim() }; break; }
    }
    for (const t of chosen ? [] : known.get(c.id) ?? []) {
      const v = await verify(t);
      if (v) { chosen = { title: v.title, method: "known-title", confidence: "high", reason: `known title "${t}" ${v.note}`.trim() }; break; }
    }
    // 2) name match within the franchise pool
    if (!chosen && nameTokens.length) {
      const scored = [...pool].filter((t) => !avoid.test(t)).map((t) => {
        const bt = tokens(base(t));
        let score = 0;
        if (bt.join(" ") === nameTokens.join(" ")) score = 3;
        else if (nameTokens.every((x) => bt.includes(x))) score = 2;
        // Spelling variants (Barragan / Baraggan): every name token within 2 edits of a title token.
        else if (nameTokens.every((x) => x.length >= 4 && bt.some((y) => editDistance(x, y) <= (x.length >= 7 ? 2 : 1)))) score = 1;
        return { t, score, len: bt.length + (t !== base(t) ? 0.5 : 0) };
      }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.len - b.len);
      if (scored.length) {
        const top = scored.filter((x) => x.score === scored[0].score);
        for (const s of scored) {
          const v = await verify(s.t);
          if (v) {
            const unique = top.length === 1 || base(top[0].t) === base(top[top.length - 1].t);
            chosen = {
              title: v.title, method: s.score === 3 ? "name-exact" : s.score === 2 ? "name-tokens" : "name-fuzzy",
              confidence: s.score === 3 && unique ? "high" : unique && s.score === 2 ? "medium" : "low",
              reason: unique ? `matched "${c.displayName}" in franchise list ${v.note}`.trim() : `several pool titles match: ${top.slice(0, 4).map((x) => x.t).join(", ")}`,
            };
            break;
          }
        }
      }
    }
    // 3) search fallback
    if (!chosen && wikiTitles[c.series]?.length) {
      for (const t of await api.search(`${c.displayName} ${wikiTitles[c.series][0]}`)) {
        if (avoid.test(t)) continue;
        if (!tokens(base(t)).some((x) => nameTokens.includes(x))) continue;
        const v = await verify(t);
        if (v) { chosen = { title: v.title, method: "search", confidence: "low", reason: `search result "${t}" ${v.note}`.trim() }; break; }
      }
    }

    // Related pages: same base name in the pool (other versions of the same character, e.g. per era).
    const related = chosen ? [...pool].filter((t) => t !== chosen!.title && base(t) === base(chosen!.title) && !avoid.test(t)) : [];
    upsert.run(c.id, c.displayName, c.series, c.status, chosen?.title ?? null, JSON.stringify(related),
      chosen?.method ?? "unresolved", chosen?.confidence ?? "none", chosen?.reason ?? (wikiTitles[c.series]?.length ? "no matching page found" : "series not on VS Battles"));
    if (++done % 50 === 0) console.log(`  matched ${done}/${chars.length} (${api.requests} requests, ${api.cacheHits} cached)`);
  }

  const counts = db.prepare("SELECT confidence, COUNT(*) n FROM characters GROUP BY confidence").all();
  console.log("resolution:", JSON.stringify(counts), `requests ${api.requests}, cache hits ${api.cacheHits}`);
  api.close();
  db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
