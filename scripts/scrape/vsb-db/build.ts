/**
 * Step 2: fetch every resolved page (cached by title; --fresh refetches), parse "Powers and Stats",
 * tag anime/manga canon, and write forms / stats / abilities / attacks into data/wiki-db/vsb-stats.sqlite.
 * Then export sortable tables (data/generated/vsb-db/) and the coverage report (docs/reviews/WIKI_DB_COVERAGE.md).
 *
 * Run: npm run wiki:db-build   (after npm run wiki:db-resolve)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VsbApi, pageUrl } from "./api.js";
import { openDb } from "./db.js";
import { parsePage, plain, qualifierOf, rankLevel, rankLift, rankSpeed, rankStrike, rankTier, STAT_CATEGORIES } from "./parse.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const R = (...p: string[]) => resolve(root, ...p);
const fresh = process.argv.includes("--fresh");

const coverage = JSON.parse(readFileSync(R("data/sources/anime-coverage.json"), "utf8"));
const exempt = new Set<string>(coverage.exempt);
const rx = (list: string[] = []) => list.map((s) => new RegExp(s, "i"));
const GENERIC_MANGA = rx(coverage.generic.mangaOnly);
const GENERIC_ANIME = rx(coverage.generic.anime);
const LN_SERIES = new Set<string>(coverage.lightNovelSeries ?? []);
const WIKI_TITLES: Record<string, string[]> = JSON.parse(readFileSync(R("data/sources/series-codes.json"), "utf8")).wikiTitles ?? {};

/** Canon tag for a piece of text (form name, stat line or ability detail). */
function canonOf(series: string, text: string, inherited = "both"): { source: string; reason: string } {
  const s = coverage.series[series] ?? {};
  for (const r of rx(s.mangaOnly)) if (r.test(text)) return { source: "manga", reason: `matches ${series} manga-only "${r.source}"` };
  for (const r of GENERIC_MANGA) {
    if (LN_SERIES.has(series) && /light novel/i.test(r.source)) continue; // the anime adapts the light novels
    if (r.test(text)) return { source: "manga", reason: `says "${text.match(r)![0]}"` };
  }
  for (const r of GENERIC_ANIME) if (r.test(text)) return { source: "anime", reason: `says "${text.match(r)![0]}"` };
  for (const r of rx(s.unclear)) if (r.test(text)) return { source: "unclear", reason: `matches ${series} coverage question "${r.source}"` };
  return { source: inherited, reason: inherited === "both" ? "" : "inherited from form/page" };
}

function rankFor(cat: string, raw: string) {
  switch (cat) {
    case "tier": return rankTier(raw);
    case "attack_potency": case "durability": return rankLevel(raw);
    case "striking_strength": return rankStrike(raw);
    case "speed": return rankSpeed(raw);
    case "lifting_strength": return rankLift(raw);
    default: return null;
  }
}

async function main() {
  const api = new VsbApi(R("data/wiki-db/vsb-cache.sqlite"));
  const db = openDb(R("data/wiki-db/vsb-stats.sqlite"));
  db.exec("DELETE FROM pages; DELETE FROM forms; DELETE FROM stats; DELETE FROM abilities; DELETE FROM attacks; DELETE FROM parse_issues;");
  const chars = db.prepare("SELECT * FROM characters WHERE page_title IS NOT NULL").all() as any[];

  const insPage = db.prepare("INSERT OR REPLACE INTO pages (title, url, revid, fetched_at, origin, categories, canon_source, note) VALUES (?,?,?,?,?,?,?,?)");
  const insForm = db.prepare("INSERT INTO forms (page_title, key_index, key_name, canon_source, canon_reason) VALUES (?,?,?,?,?)");
  const insStat = db.prepare("INSERT OR REPLACE INTO stats (form_id, category, raw_text, plain_text, qualifier, tier_code, rank_value, canon_source, canon_reason) VALUES (?,?,?,?,?,?,?,?,?)");
  const insAb = db.prepare("INSERT INTO abilities (page_title, section, ability, detail, canon_source) VALUES (?,?,?,?,?)");
  const insAt = db.prepare("INSERT INTO attacks (page_title, name, canon_source) VALUES (?,?,?)");
  const insIssue = db.prepare("INSERT INTO parse_issues (page_title, issue) VALUES (?,?)");

  const done = new Set<string>();
  let n = 0;
  for (const c of chars) {
    const titles = [c.page_title, ...JSON.parse(c.related_titles ?? "[]")];
    for (const title of titles) {
      if (done.has(title)) continue;
      done.add(title);
      const p = await api.page(title, { fresh });
      if (!p) { insIssue.run(title, "page could not be fetched"); continue; }
      // Two titles can redirect to the same page: process each final page once.
      if (p.title !== title && done.has(p.title)) continue;
      done.add(p.title);
      const parsed = parsePage(p.wikitext);
      // Related version pages must come from the character's own franchise (skips crossovers like "(Granblue Fantasy)").
      if (title !== c.page_title) {
        const origins = (WIKI_TITLES[c.series] ?? []).map((t) => t.toLowerCase());
        if (!origins.some((o) => parsed.origin.toLowerCase().includes(o.replace(/ \(verse\)$/, "")))) {
          insIssue.run(p.title, `skipped related page: origin "${parsed.origin.slice(0, 60)}" is not ${c.series}`);
          continue;
        }
      }
      const lnOk = LN_SERIES.has(c.series) && /\(Light Novel\)$/i.test(p.title);
      const pageCanon = lnOk ? "both" : /\((Manga|Web Novel|Light Novel|Novel)\)$/i.test(p.title) ? "manga" : /\((Anime|Toei)\)$/i.test(p.title) ? "anime" : "both";
      insPage.run(p.title, pageUrl(p.title), p.revid, new Date().toISOString(), parsed.origin, JSON.stringify(p.categories), pageCanon, parsed.note);
      for (const issue of parsed.issues) insIssue.run(p.title, issue);
      parsed.keys.forEach((key, i) => {
        const fc = canonOf(c.series, key, pageCanon);
        const formId = Number(insForm.run(p.title, i, key, fc.source, fc.reason).lastInsertRowid);
        for (const cat of STAT_CATEGORIES) {
          const raw = parsed.stats[cat]?.[i];
          if (!raw) continue;
          const text = plain(raw);
          const r = rankFor(cat, raw);
          const sc = canonOf(c.series, text, fc.source);
          insStat.run(formId, cat, raw, text, qualifierOf(text) || (r?.soft ? "possibly" : ""), r?.value ?? null, r ? r.rank : null, sc.source, sc.reason);
        }
      });
      for (const a of parsed.abilities) insAb.run(p.title, a.section, a.ability, a.detail, canonOf(c.series, `${a.section} ${a.detail}`, pageCanon).source);
      for (const a of parsed.attacks) insAt.run(p.title, a, canonOf(c.series, a, pageCanon).source);
      if (++n % 50 === 0) console.log(`  parsed ${n} pages (${api.requests} requests, ${api.cacheHits} cached)`);
    }
  }
  console.log(`parsed ${n} pages; requests ${api.requests}, cache hits ${api.cacheHits}`);
  api.close();
  exportTables(db);
  writeCoverage(db);
  db.close();
}

/** Sortable per-category tables: character x form x category, with the anime-canon filter applied as a column. */
function exportTables(db: any) {
  const out = R("data/generated/vsb-db");
  mkdirSync(out, { recursive: true });
  const rows = db.prepare(`
    SELECT c.game_id, c.display_name, c.series, c.status, f.page_title, f.key_index, f.key_name, s.category,
           s.plain_text, s.qualifier, s.tier_code, s.rank_value, s.canon_source
    FROM characters c JOIN forms f ON f.page_title = c.page_title OR c.related_titles LIKE '%"' || f.page_title || '"%'
    JOIN stats s ON s.form_id = f.id ORDER BY c.series, c.display_name, f.page_title, f.key_index`).all() as any[];
  const csvCell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const byCat = new Map<string, any[]>();
  for (const r of rows) {
    // "Only what has aired": manga-only and not-yet-animated ("unclear") content are both excluded.
    r.excluded_by_filter = !exempt.has(r.series) && (r.canon_source === "manga" || r.canon_source === "unclear") ? 1 : 0;
    byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);
  }
  for (const [cat, list] of byCat) {
    const sorted = [...list].sort((a, b) => (b.rank_value ?? -1) - (a.rank_value ?? -1));
    writeFileSync(resolve(out, `${cat}.json`), JSON.stringify(sorted, null, 1));
    const cols = Object.keys(sorted[0]);
    writeFileSync(resolve(out, `${cat}.csv`), [cols.join(","), ...sorted.map((r) => cols.map((k) => csvCell(r[k])).join(","))].join("\n"));
  }
  const ab = db.prepare("SELECT c.game_id, c.display_name, c.series, a.page_title, a.section, a.ability, a.canon_source FROM abilities a JOIN characters c ON c.page_title = a.page_title").all();
  writeFileSync(resolve(out, "abilities.json"), JSON.stringify(ab, null, 1));
  console.log(`exported ${rows.length} stat rows in ${byCat.size} categories + ${ab.length} abilities → data/generated/vsb-db/`);
}

function writeCoverage(db: any) {
  const q = (sql: string, ...a: unknown[]) => db.prepare(sql).all(...a) as any[];
  const one = (sql: string, ...a: unknown[]) => db.prepare(sql).get(...a) as any;
  const total = one("SELECT COUNT(*) n FROM characters").n;
  const conf = q("SELECT confidence, COUNT(*) n FROM characters GROUP BY confidence ORDER BY n DESC");
  const method = q("SELECT match_method, COUNT(*) n FROM characters GROUP BY match_method ORDER BY n DESC");
  const pages = one("SELECT COUNT(*) n FROM pages").n;
  const forms = one("SELECT COUNT(*) n FROM forms").n;
  const catCov = q("SELECT category, COUNT(*) n, SUM(rank_value IS NOT NULL) ranked FROM stats GROUP BY category ORDER BY n DESC");
  const issues = q("SELECT issue, COUNT(*) n FROM parse_issues GROUP BY issue ORDER BY n DESC LIMIT 25");
  const perSeries = q(`SELECT series, COUNT(*) n, SUM(page_title IS NOT NULL) matched, SUM(confidence='low') low,
    (SELECT COUNT(*) FROM franchise_pages fp WHERE fp.series = c.series) pool FROM characters c GROUP BY series ORDER BY series`);
  const unresolved = q("SELECT display_name, series, status, reason FROM characters WHERE page_title IS NULL ORDER BY series, display_name");
  const low = q("SELECT display_name, series, page_title, reason FROM characters WHERE confidence='low' ORDER BY series, display_name");
  const canon = q("SELECT canon_source, COUNT(*) n FROM forms GROUP BY canon_source");
  const excludedForms = q(`SELECT c.display_name, c.series, f.page_title, f.key_name, f.canon_reason FROM forms f JOIN characters c ON c.page_title = f.page_title
    WHERE f.canon_source IN ('manga','unclear') ORDER BY c.series, c.display_name`).filter((r) => !exempt.has(r.series));
  const unclear = q(`SELECT c.display_name, c.series, f.key_name, f.canon_reason FROM forms f JOIN characters c ON c.page_title = f.page_title
    WHERE f.canon_source = 'unclear' ORDER BY c.series, c.display_name`);

  // Strongest tier per character, all forms vs anime-canon filtered.
  const strongest = q(`SELECT c.game_id, c.display_name, c.series,
      MAX(s.rank_value) all_rank,
      MAX(CASE WHEN f.canon_source NOT IN ('manga','unclear') AND s.canon_source NOT IN ('manga','unclear') THEN s.rank_value END) filtered_rank
    FROM characters c JOIN forms f ON f.page_title = c.page_title JOIN stats s ON s.form_id = f.id AND s.category = 'tier'
    GROUP BY c.game_id`).filter((r) => !exempt.has(r.series) && r.all_rank !== r.filtered_rank);

  const md: string[] = [];
  md.push("# VS Battles database coverage", "", `Generated by \`npm run wiki:db-build\` on ${new Date().toISOString().slice(0, 10)}. Source: vsbattles.fandom.com (raw pages cached in \`data/wiki-db/\`, gitignored). Tables: \`data/generated/vsb-db/\`.`, "");
  md.push("## Summary", "", `| | Count |`, `|---|---:|`, `| Characters (live + held back) | ${total} |`, `| Matched to a page | ${total - unresolved.length} |`, `| Pages parsed (incl. related versions) | ${pages} |`, `| Forms (keys) | ${forms} |`, "");
  md.push("Match confidence: " + conf.map((r) => `${r.confidence} ${r.n}`).join(", ") + ". Method: " + method.map((r) => `${r.match_method} ${r.n}`).join(", ") + ".", "");
  md.push("Form canon tags: " + canon.map((r) => `${r.canon_source} ${r.n}`).join(", ") + `. Exempt series (manga/novel content kept): ${[...exempt].join(", ")}.`, "");
  md.push("## Categories parsed", "", "| Category | Form rows | With a rank |", "|---|---:|---:|", ...catCov.map((r) => `| ${r.category} | ${r.n} | ${r.ranked} |`), "");
  md.push("## Per series", "", "| Series | Roster | Matched | Low confidence | Wiki pages in franchise |", "|---|---:|---:|---:|---:|", ...perSeries.map((r) => `| ${r.series} | ${r.n} | ${r.matched} | ${r.low} | ${r.pool} |`), "");
  md.push(`## Unresolved (${unresolved.length})`, "", ...unresolved.map((r) => `- ${r.display_name} (${r.series}${r.status === "held" ? ", held back" : ""}): ${r.reason}`), "");
  md.push(`## Low-confidence matches (${low.length}), please check`, "", ...low.map((r) => `- ${r.display_name} (${r.series}) → [${r.page_title}](${pageUrl(r.page_title)}): ${r.reason}`), "");
  md.push(`## Anime-canon filter`, "", `### Excluded manga-only forms (${excludedForms.length})`, "", ...excludedForms.map((r) => `- ${r.display_name} (${r.series}): "${r.key_name}", ${r.canon_reason}`), "");
  md.push(`### Strongest tier changed by the filter (${strongest.length})`, "", ...strongest.map((r) => `- ${r.display_name} (${r.series}): all forms rank ${r.all_rank}, anime-only rank ${r.filtered_rank ?? "none"}`), "");
  md.push(`### Unclear, needs review (${unclear.length})`, "", ...unclear.map((r) => `- ${r.display_name} (${r.series}): "${r.key_name}", ${r.canon_reason}`), "");
  md.push(`## Parse issues (top ${issues.length})`, "", ...issues.map((r) => `- ${r.n} × ${r.issue}`), "");
  mkdirSync(R("docs/reviews"), { recursive: true });
  writeFileSync(R("docs/reviews/WIKI_DB_COVERAGE.md"), md.join("\n") + "\n");
  console.log("wrote docs/reviews/WIKI_DB_COVERAGE.md");
}

main().catch((e) => { console.error(e); process.exit(1); });
