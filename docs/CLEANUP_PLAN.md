# Cleanup plan (proposal, 2026-11-16)

Nothing in this plan has been done yet. It covers four things:

- where every file goes
- what gets deleted
- a single ID rule
- what a rename touches

The ID mapping itself is in [`docs/reviews/id-migration-2026-11-16.json`](../data/id-migration.json).

## 1. Current state

| Folder | What it is | Notes |
|--------|-----------|-------|
| `client/`, `server/`, `shared/` | The game (Vite/React client, WebSocket server, shared rules) | Well organized. No changes proposed. |
| `public-shared/portraits/` | Portrait images (one per character) | File names don't always match IDs (e.g. `gluttony-fma-catalog`). |
| `data/` | 44 tracked files: the roster plus overrides, hints, reports, logs, review pages and Markdown notes, all in one folder | Hard to tell inputs from outputs. Reports and logs are 1.3 MB of noise in every diff. |
| `data/wiki-db/` | Local VS Battles scrape cache (gitignored) | Fine as is. |
| `scripts/` | 55 files in one flat folder, mixing TS, MJS, PowerShell and one Python script | 7 unused scripts, 2 PowerShell copies of TS/MJS scripts. |
| `tools/portraits-fetch/`, `tools/stats-check/`, `tools/wiki-db/` | Rust tools, each at the repo root | Three top-level folders for tooling. |
| `docs/` | Only `GAMEPLAY.md` | The other 11 Markdown docs live in `data/`. |
| `dist/`, `music/` | Empty folders | Leftovers. |
| `reference UI/` | Local screenshots (gitignored) | Not in the repo. |
| `package.json` | 43 npm scripts with mixed naming (`data:iq-apply`, `data:roster-batch-scrape-8`, `data:assets`…) | `scripts/package.json` duplicates about 12 of them. |

### Unused or duplicate files (no npm script, code, CI or other script uses them)

| File | Why it can go |
|------|---------------|
| `scripts/fetch-wiki-pages.ts`, `scripts/find-wiki-page.ts`, `scripts/probe-stats.ts` | Early debugging helpers, replaced by `wiki-full-scrape.ts` |
| `scripts/fix-yuta-rika-id.mjs`, `scripts/reset-junk-physical-stats.mjs` | One-off fixes that already ran |
| `scripts/sample-portrait-picre.ts`, `scripts/process-portrait-chromakey.py` | Abandoned portrait experiments |
| `scripts/apply-iq-overrides.ps1` | Duplicate of `apply-iq-overrides.ts` (npm uses the `.ts`) |
| `scripts/build-iq-review-html.ps1` | Duplicate of `build-iq-review-html.mjs` (npm uses the `.mjs`) |
| `data/scrape-log.txt`, `data/wiki-search-audit-log.txt`, `data/missing-wiki-stats.txt`, `data/manual-portrait-variants.txt` | Old logs and notes; nothing reads them |
| `dist/`, `music/` | Empty |
| Untracked: `data/generated/iq-review-prune-log.json` (contains your Downloads path), `data/generated/portraits-ap-refetch-log.txt`, `data/generated/wiki-rescrape-batch-log.txt` | Logs; would be gitignored |

## 2. Proposed layout

```
.
├── client/  server/  shared/        unchanged
├── public-shared/portraits/         unchanged location; files renamed to <id>.<ext>
├── data/
│   ├── characters.json              THE roster (server, client build, validator read it)
│   ├── overrides/                   hand-edited values you curate
│   │   ├── iq.json                      (was manual-iq-overrides.json)
│   │   ├── stats.json                   (was manual-curated-stats.json)
│   │   ├── manual-overrides.json
│   │   ├── display-names.json           (was famous-display-names.json)
│   │   └── form-policy.json             (was roster-form-policy.json)
│   ├── sources/                     inputs for scraping, portraits and roster batches
│   │   ├── wiki-hints.json  wiki-profile-hints.json  wiki-stat-keys.json
│   │   ├── anime-planet-hints.json  anime-planet-slugs.json
│   │   └── roster-expansion.json  roster-batch2-*.json
│   ├── generated/                   GITIGNORED: reports, logs, review pages (all regenerable)
│   │   └── stats-check-report.json  physical-stat-audit.json  roster-readiness.json
│   │       wiki-search-audit.json  scrape-report.json  portraits-log.txt
│   │       iq-revision-review.html  *-log.txt  *-export-*.json
│   └── tools/wiki-db/                     gitignored scrape cache (unchanged)
├── scripts/
│   ├── scrape/      vsbattles + wiki scrape, shards, sqlite merge, wiki apply
│   ├── curate/      apply-overrides, IQ review page + import/merge, display names, roster batch/merge, form policy, restore
│   ├── portraits/   fetch (Anime-Planet), import manual, prune duplicates
│   ├── validate/    validate-characters, audit-* , stats-check worker
│   ├── dev/         start-local.ps1
│   └── lib/         shared helpers (unchanged)
├── tools/                           Rust crates
│   ├── tools/portraits-fetch/  tools/stats-check/  tools/wiki-db/
├── docs/
│   ├── GAMEPLAY.md  CLEANUP_PLAN.md
│   ├── data/        FRANCHISE_NOTES, WIKI_VERSION_POLICY, ANIME_PLANET_PORTRAITS, ROSTER_BATCH2, ROSTER_READINESS
│   └── reviews/     HUMAN_STAT_REVIEW, IQ_ANIME_REVIEW, IQ_REVISION_PROPOSAL, PHYSICAL_STAT_AUDIT,
│                    ROSTER_BATCH2_STATS, wiki-browser-verification, DELETED_2026-11-16
├── README.md  CHANGELOG.md  package.json
```

### npm scripts: one naming scheme, `<area>:<action>`

| Area | Scripts |
|------|---------|
| `dev` / `build` | `dev`, `dev:local`, `dev:server`, `build` (unchanged) |
| `data:` | `data:validate`, `data:apply` (runs IQ, then stats overrides, in the right order), `data:stats-check`, `data:stats-check-apply` |
| `iq:` | `iq:review` (sync + build page), `iq:import`, `iq:merge-proposal` |
| `roster:` | `roster:merge-expansion`, `roster:batch-build`, `roster:batch-apply`, `roster:batch-onboard`, `roster:display-names`, `roster:form-policy`, `roster:restore` |
| `wiki:` | `wiki:shards`, `wiki:scrape`, `wiki:scrape-shard`, `wiki:db-import`, `wiki:db`, `wiki:apply`, `wiki:needs-scrape` |
| `portraits:` | `portraits:fetch`, `portraits:import-manual`, `portraits:prune-duplicates` |
| `audit:` | `audit:readiness`, `audit:batch-stats`, `audit:physical` |

`scripts/package.json` keeps only its dependencies. The root scripts call `tsx scripts/...` directly, so every script is defined in one place.

### Paths that must change (and what stays)

- **Stays the same, so nothing to change:**
  - `data/characters.json` and `public-shared/portraits/`. These are what the server, `client/vite.config.ts` (portrait copy and reel-roster generation), the validator and `server/render.yaml` (`buildFilter` includes `data/characters.json`) read.
  - The GitHub Pages workflow, which only builds `shared` and `client`.
- **`package.json`:** every `scripts/...`, `--manifest-path stats-check|wiki-db|portraits-fetch` and `data/...` path.
- **Scripts that hard-code data paths** (`resolve(root, "data", ...)`): every moved overrides, sources or generated file needs its path updated, about 30 scripts.
- **Rust crates:**
  - `tools/stats-check/src/worker.rs` calls `scripts/validate/stats-check-worker.ts`.
  - `stats-check` writes `data/generated/stats-check-report.json`.
  - `wiki-db` writes `data/generated/PHYSICAL_STAT_AUDIT.md` and `data/generated/physical-stat-audit.json`.
  - `portraits-fetch` writes `data/generated/portraits-log.txt`.
  - Their `--root` handling stays; only the file paths change.
- **Docs:** links in `README.md`, `docs/GAMEPLAY.md` and the moved Markdown files.
- **`.gitignore`:** add `data/generated/` and `tools/*/target/`.

## 3. ID rule

**`<character-slug>-<series-code>`**

- **character-slug:** the display name, lowercased, accents and punctuation removed, spaces as hyphens. For example `All Might` → `all-might`, `C.C.` → `cc`, `Schrödinger` → `schrodinger`.
- **series-code:** one fixed code per series, from the table in `docs/reviews/id-migration-2026-11-16.json`. Each code matches what most IDs in that series already use (`aot`, `bleach`, `dragon-ball`, `jjk`, `one-piece`, `opm`…), which keeps the number of renames low.
- **Portrait file:** `<id>.<ext>`.
- **No form tags in IDs:** the roster is one entry per character, so forms like `-ssj2` or `-gear-4` go.

Result on the live roster (694 after the Fate trim and duplicate fixes): **151 IDs change**; 543 already match. Examples:

| Now | Proposed | Why |
|-----|----------|-----|
| `goku-ssj2` | `goku-dragon-ball` | form tag + series code |
| `levi-ackerman` | `levi-aot` | surname instead of series code |
| `luffy-gear-4` | `luffy-one-piece` | form tag |
| `l-lawliet` | `l-dn` | series code (held-back list) |
| `akame-aga` | `akame-aga` | already matches |
| `koro-sensei` | `korosensei-ac` | name + series code |
| `principal-ac` | `asano-ac` | slug didn't match the name |
| `aokiji-fairy-tail` | `invel-fairy-tail` | **wrong slug** (Aokiji is One Piece) |
| `ivan-fire-force` | `iris-fire-force` | **wrong slug** |
| `hikeshi-fire-force` | `hibana-fire-force` | **wrong slug** |
| `ryuk-hxh` | `ryuk-dn` | **wrong series** (Ryuk is Death Note) |
| `gluttony-fma-catalog` | `gluttony-fma` | stray suffix |
| `heracles-fate` | `berserker-fate` | follows the display name (or rename the display name to Heracles) |
| `ymir-fritz-aot` | `founding-aot` | follows the display name "Founding" |
| `nikola-record` | `tesla-record` | follows the display name |

**Duplicates rule (your standing rule, also in `docs/data/FRANCHISE_NOTES.md`):** when two entries are the same character, keep the strongest version. That means the highest-tier form, or the highest stat total when unclear. Placeholder 50s never win. The kept entry gets the export IQ.

**Status of the flags** (all listed in `docs/reviews/id-migration-2026-11-16.json` under `flags`):

- **Live IDs whose slug doesn't match the display name:** most are fine renames.
- **Fate (resolved):** trimmed to Gilgamesh, Iskandar and Saber, so the class-name question is gone.
- **Annie (resolved):** the duplicate is removed, and the copy with real stats is kept.
- **Held-back 51:** 4 collisions remain, each resolved by the strongest-version rule if they ever return:
  - Lancer: both copies are placeholders and only Cú Chulainn remains a candidate. Fate is now limited to 3 characters, so neither returns.
  - Saber: already live as `saber-fsn`.
  - Deku: `deku-gearshift-mha` (later, stronger form) over `midoriya-100-mha`.
  - Asuna: whichever has curated stats when re-added.
- **Stashed 296:** 119 renames, no collisions.

## 4. What renaming IDs touches

- **Roster and images:** `data/characters.json` (`id` and `portrait`), plus 151 portrait files.
- **Override, hint and review files keyed by ID** (number of affected IDs in each, measured at 714 characters; slightly fewer now):

  | File | IDs |
  |------|----:|
  | `manual-iq-overrides.json` | 156 |
  | `famous-display-names.json` | 156 |
  | `stats-check-report.json` | 156 |
  | `physical-stat-audit.json` and `.md` | 153 |
  | `iq-revision-export-applied-2026-11-12.json` | 96 |
  | `portraits-log.txt` | 96 |
  | `wiki-hints.json` | 89 |
  | `roster-batch2-catalog.json` | 72 |
  | `roster-expansion.json` | 70 |
  | `anime-planet-hints.json` | 66 |
  | `wiki-stat-keys.json` | 38 |
  | `roster-readiness.json` | 36 |
  | `roster-batch2-stats-review.json` | 35 |
  | `wiki-profile-hints.json` | 17 |
  | `manual-overrides.json` | 14 |
  | `manual-curated-stats.json` | 13 |
  | `wiki-search-audit.json` | 11 |
  | `roster-form-policy.json` | 2 |
  | `roster-batch2-entries.json` | 2 |

- **Scripts with hard-coded IDs:** `scripts/scrape/scrape-vsbattles.ts` (26), `scripts/portraits/fetch-portraits-ids.ts` (11), `tools/wiki-db/src/audit.rs` (3).
- **The IQ review page:** its saved browser edits are keyed by ID. Export any unsaved edits before the rename, then rebuild the page.
- **Local only:** `data/wiki-db/scrapes/<id>.json` (151 files) would be renamed to match.
- **The game itself is not affected:** client, server and shared code contain no character IDs. Rooms in progress just finish on the old data.
- **History:** `DELETED_2026-11-16.md` and the review Markdown files keep the old IDs; they're records. `docs/reviews/id-migration-2026-11-16.json` keeps the old → new map.

## 5. Size of the change

| Action | Count |
|--------|------:|
| Files moved (data 33, scripts 47, docs 11, 3 Rust crates) | about 95 files, 3 folders |
| Files deleted (unused scripts 9, old logs 4, empty folders 2) | 15 |
| IDs renamed (and their portraits) | 151 + 151 |
| Files edited for new paths/IDs | about 60 |

## 6. Risks and how to keep them small

1. **Broken script paths:** many scripts hard-code `data/...` paths. Mitigation: move in one commit, then run every npm script's dry or quick mode, `data:validate`, a full build and a local match.
2. **Lost IQ-review edits:** the page's saved edits are keyed by ID. Mitigation: export before renaming.
3. **Wrong-ID merges:** a slug collision would merge two characters. Mitigation: the plan already found 1 live collision (two Annies), and the migration aborts on any collision.
4. **Old commands stop working:** npm names change. Mitigation: the README gets a table of old → new names.
5. **Render redeploy:** the ID rename changes `data/characters.json`, so the server redeploys and rooms in progress reset. Push when nobody's playing.

Suggested order:

1. Files and folders only, with no ID changes. Verify.
2. ID rename. Verify.
3. Push both after your OK.
