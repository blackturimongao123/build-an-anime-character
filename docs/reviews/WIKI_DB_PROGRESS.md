# VS Battles database: progress (paused 2026-11-16)

## Done

- **Cleanup (local, not pushed).** These commits are waiting for "push", together with `b29995b` (strongest-duplicate fix):
  - `bbf010e` Reorganize project structure
  - `b4ecaa3` Consistent character IDs
- **Database tooling** (`scripts/scrape/vsb-db/`, committed in `8a62509`):
  - `api.ts`: VS Battles MediaWiki API client. About 1 request per second, retries, generic User-Agent, and every response cached in `data/wiki-db/vsb-cache.sqlite` (gitignored).
  - `resolve.ts` (`npm run wiki:db-resolve`): series → franchise page (`wikiTitles` in `data/sources/series-codes.json`) → `Category:<franchise>` members + franchise page links → match roster characters. Matching order: aliases (`data/sources/vsb-aliases.json`), known titles from the hint files, scrapes and catalog, exact or token or fuzzy name match, then search as a last resort. Every page is checked: disambiguation pages are followed, the series is confirmed, and the page must have a "Powers and Stats" section.
  - `parse.ts`: "Powers and Stats" → keys (forms) → per-form tier, attack potency, speed, lifting and striking strength, durability, stamina, range, equipment, intelligence and weaknesses, plus the abilities list and attacks. Each value gets a rank: tier ordinal (10-C … 0), speed class, lift class. "Possibly" and "likely" values count only when nothing firm exists. Tested on Cell (Toei) and Byakuya Kuchiki.
  - `build.ts` (`npm run wiki:db-build`): fetch, parse, anime-canon tags, then exports to `data/generated/vsb-db/*.csv|json` and `docs/reviews/WIKI_DB_COVERAGE.md`.
  - `query.ts` (`npm run wiki:db-query -- "SQL"`): ad-hoc queries.
- **Config:** `data/sources/anime-coverage.json` holds the anime-canon filter. Exempt: Solo Leveling, Fire Force, Hellsing, Kengan Ashura.
- **Rules:** `docs/STAT_RULES.md` defines STR, SPD, ABL and DUR and the 0–100 scales.
- **Resolution run, finished:**
  - 742 characters: 694 live plus 48 from the held-back list (`data/generated/held-back-roster.json`).
  - **605 matched:** 554 high confidence, 40 medium, 11 low. **137 unmatched:** minor characters without pages, Haikyuu!! (not on VS Battles), and some naming mismatches.
  - Results are in `data/wiki-db/vsb-stats.sqlite`.

## Next steps, in order

1. **Review the unmatched and low-confidence matches.**
   - Run `npm run wiki:db-query -- "SELECT display_name, series, status, reason FROM characters WHERE page_title IS NULL ORDER BY series"`.
   - Add the obvious ones to `data/sources/vsb-aliases.json` (game id → exact wiki title).
   - Re-run `npm run wiki:db-resolve`. It's cheap, because lookups are cached.
2. **Parse:** run `npm run wiki:db-build`. This is about 620 page fetches (roughly 11 minutes at 1 request per second; cached pages are instant). Run it in the background.
3. **Check the parse:**
   - Open `docs/reviews/WIKI_DB_COVERAGE.md` and look at the parse issues and the categories without ranks.
   - Hand-check 15 random characters against their live pages, then fix `parse.ts` and rebuild.
   - Known gap: "Notable Attacks/Techniques" isn't picked up yet (0 attacks found on the two test pages).
4. **Anime-canon filter:** review the forms excluded as manga-only, the "unclear" list, and the "strongest tier changed by the filter" list in the coverage report. Adjust `anime-coverage.json` where needed.
5. **Stat rebuild** (new script `scripts/scrape/vsb-db/derive.ts`, following `docs/STAT_RULES.md`):
   - **Strongest form:** pick the strongest anime-canon form per character (exempt series keep everything).
   - **STR:** `max(lift score, striking tier score)`.
   - **SPD:** physical speed only (drop teleport or instant-travel clauses).
   - **ABL:** attack potency score plus hax from `data/overrides/stat-adjustments.json`. The hax entries are manual, with reasons that cite the abilities from the database. Gold Experience Requiem goes near the top.
   - **DUR:** durability score, ±2 for stamina, plus resistances and immortality from `stat-adjustments.json`.
   - **IQ:** unchanged.
   - **No wiki page:** characters without a page keep their current stats, or get common-sense values flagged as such.
6. **Outputs:**
   - `docs/reviews/STAT_REBUILD.md`: old → new per character, the form and wiki page used, and a reason. Plus the biggest movers, a top 20 per stat, and series ladders (DBZ, Naruto, Bleach).
   - `data/generated/stat-rebuild.csv`.
7. **Apply through overrides** (`data/overrides/manual-curated-stats.json` + `stat-adjustments.json`), then `npm run data:apply`, `npm run data:validate`, and a local bot match. **Commit locally, don't push**: you review STAT_REBUILD.md first.

## Resume

```bash
npm run wiki:db-resolve
```

```bash
npm run wiki:db-build
```

## Open questions

- **Medium coverage-table entries:** Bleach's final arc, One Piece's Elbaph, Demon Slayer's Infinity Castle and others are tagged "unclear" rather than excluded. Do you want unclear content excluded too?
- **Characters with no VS Battles page** (about 137): keep their current stats, or estimate from series knowledge?
