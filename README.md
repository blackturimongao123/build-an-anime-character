# Build an Anime Character

Browser game inspired by anime stat-draft showdowns: roll characters, assign them to five categories, then watch the showdown. Play online with room codes or vs a BOT (easy / medium / hard).

## Stack

| Part | Tech |
|------|------|
| Client | Vite + React (GitHub Pages) |
| Server | Node + `ws` (Render free tier) |
| Data | `data/characters.json` (VS Battles–derived 0–100 stats) |

## Local development

One command starts the **game UI** and **WebSocket server** for local testing:

```bash
npm install
npm run dev:local
```

| Service | URL |
|--------|-----|
| Play in browser | http://localhost:5173 |
| WebSocket (direct, local) | `ws://127.0.0.1:8781` |
| WebSocket (via Vite) | `ws://localhost:5173/game-ws` (used automatically in dev) |

Windows quick start (frees stuck ports): `powershell -File scripts/dev/start-local.ps1`

`dev:local` builds `shared/`, then runs the server and Vite together. Stop with `Ctrl+C` (both processes exit).

Optional: only the API server — `npm run dev:server`. Only the UI — `npm run dev` (still needs the server running for multiplayer/BOT).

## Deploy

### 1. WebSocket server (Render)

1. Push this repo to GitHub.
2. On [Render](https://render.com), create a **Web Service** from the repo.
3. Set **Root Directory** to `server`, **Build** `npm install && npm run build --workspace=@build-character/shared`, **Start** `npm start`. (The server imports the `shared` workspace package, which must be built first; with plain `npm install` the deploy succeeds but the server crashes on start.)
4. Add env var `ALLOWED_ORIGINS` = your GitHub Pages URL (e.g. `https://youruser.github.io`).
5. Copy the service URL and use `wss://...` (not `ws://`).

You can use [`server/render.yaml`](server/render.yaml) as a blueprint.

The live server is managed by the Render Blueprint at [`server/render.yaml`](server/render.yaml) (set **Blueprint Path** to `server/render.yaml`; it is not at the repo root). It is connected through Render's GitHub App and auto-deploys on every push to `main`. A service created from the plain public repo URL does not auto-deploy.

### 2. GitHub Pages

1. In the repo **Settings → Secrets and variables → Actions**, add variable `VITE_WS_URL` = `wss://your-render-app.onrender.com`.
2. If the site is served from a project subpath, set `VITE_BASE_PATH` = `/your-repo-name/`.
3. Enable **GitHub Pages** from **Actions** (workflow `.github/workflows/deploy-pages.yml`).
4. Push to `main` to deploy.

Render’s free tier may sleep; the first connection after idle can take ~30 seconds.

## Character data

- Roster: `data/characters.json` (one entry per character, the strongest version; plain `displayName`, no parentheses)
- Hand-edited values: `data/overrides/` (IQ, curated stats, manual fixes, display names, form policy). Apply them with `npm run data:apply`.
- Validate allowlist, stats and portraits (missing files and duplicate placeholder images fail): `npm run data:validate`
- Refresh wiki stats (cached under `data/raw-wiki/`): `npm run wiki:scrape-stats`
- Fetch portraits into `public-shared/portraits/` (Rust, parallel Anime-Planet CDN): `npm run portraits:fetch` (pass `-- --force` to replace files). TypeScript fallbacks: `npm run portraits:fetch-ts`, or `npm run portraits:fetch-ids -- <id> …` for specific characters.
- IQ review page: `npm run iq:review` writes `data/generated/iq-revision-review.html`. Import its export with `npm run iq:import`.

Allowed series are listed in [`scripts/validate/validate-characters.ts`](scripts/validate/validate-characters.ts) (`ALLOWED_SERIES`). Add new entries in [`data/sources/roster-expansion.json`](data/sources/roster-expansion.json), then `npm run roster:merge-expansion` and `npm run data:validate`.

## How to play

Short version:

1. **Create room** (optionally vs BOT) or **join** with a 6-letter code.
2. Each round, tap **+** on a category to lock your rolled character there (5 rounds total).
3. After draft, **Showdown** compares each category: the portraits charge at each other, the lower stat is knocked off the board, and on a tie both clash and return to their spots.
4. **AVG SCORE** is the total of all 5 stats ÷ 5. It fills in as each clash is revealed; knockouts and ties are visual only. Highest average wins.

Sounds (roll ticks, clicks, punches) are synthesized in the browser; use the 🔊 button to mute.

**Full rules** (draft timer, knockouts, BOT tiers, ties): [docs/GAMEPLAY.md](docs/GAMEPLAY.md).

## Project structure

```
client/                React UI
server/                Authoritative multiplayer
shared/                Game rules + protocol
public-shared/         Portrait assets copied into the client build
data/
  characters.json      The roster (server, client build and validator read it)
  overrides/           Hand-edited values: IQ, curated stats, display names, form policy
  sources/             Inputs for scraping, portraits and roster batches
  generated/           Reports, logs, review page (gitignored, regenerable)
  wiki-db/             Local VS Battles scrape cache (gitignored)
scripts/
  scrape/              VS Battles + wiki scraping, shards, wiki apply
  curate/              Apply overrides, IQ review, roster batches, display names
  portraits/           Portrait fetch / import / dedupe
  validate/            Validator and audits
  dev/                 Local helpers
  lib/                 Shared script helpers
tools/                 Rust crates: portraits-fetch, stats-check, wiki-db
docs/                  Gameplay, data notes (docs/data), reviews and change records (docs/reviews)
```

### npm script names (renamed 2026-11-16)

Commands follow `<area>:<action>`. Old names:

| Old | New |
|-----|-----|
| `data:iq-apply` / `data:curated-apply` | `data:apply-iq` / `data:apply-stats` (both: `data:apply`) |
| `data:assets` | `data:refresh-assets` |
| `data:scrape` / `data:stats` | `wiki:scrape-legacy` / `wiki:scrape-stats` |
| `data:wiki-shards`, `data:wiki-scrape`, `data:wiki-scrape-shard` | `wiki:shards`, `wiki:scrape`, `wiki:scrape-shard` |
| `data:wiki-db`, `data:wiki-db-import`, `data:wiki-db-merge` | `wiki:db`, `wiki:db-import`, `wiki:db-merge` |
| `data:wiki-stat-keys`, `data:wiki-apply` | `wiki:stat-keys`, `wiki:apply` |
| `data:needs-wiki-scrape`, `data:needs-wiki-scrape-8` | `wiki:needs-scrape`, `wiki:needs-scrape-8` |
| `data:iq-sync-roster`, `data:iq-review-html`, `data:iq-website` | `iq:sync`, `iq:review-page`, `iq:review` |
| `data:iq-import-export`, `data:iq-merge-proposal` | `iq:import`, `iq:merge-proposal` |
| `data:merge-roster`, `data:restore-characters`, `data:display-names`, `data:form-policy` | `roster:merge-expansion`, `roster:restore`, `roster:display-names`, `roster:form-policy` |
| `data:roster-batch-build`, `-apply`, `-onboard`, `-scrape-8` | `roster:batch-build`, `-apply`, `-onboard`, `-scrape-8` |
| `data:portraits`, `data:portraits-manual` | `portraits:fetch`, `portraits:import-manual` |
| `data:roster-readiness`, `data:roster-batch-stats-audit`, `data:physical-audit` | `audit:readiness`, `audit:batch-stats`, `audit:physical` |

`data:validate`, `data:stats-check`, `data:stats-check-apply` and all `dev`/`build` commands are unchanged. Every command is defined in the root `package.json`.
