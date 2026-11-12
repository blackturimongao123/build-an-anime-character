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

Windows quick start (frees stuck ports): `powershell -File scripts/start-local.ps1`

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

### 2. GitHub Pages

1. In the repo **Settings → Secrets and variables → Actions**, add variable `VITE_WS_URL` = `wss://your-render-app.onrender.com`.
2. If the site is served from a project subpath, set `VITE_BASE_PATH` = `/your-repo-name/`.
3. Enable **GitHub Pages** from **Actions** (workflow `.github/workflows/deploy-pages.yml`).
4. Push to `main` to deploy.

Render’s free tier may sleep; the first connection after idle can take ~30 seconds.

## Character data

- Roster: `data/characters.json` (one strongest form per character; plain `displayName`, no parentheses)
- Manual fixes: `data/manual-overrides.json`
- Validate allowlist, stats and portraits (missing files and duplicate placeholder images fail): `npm run data:validate`
- Refresh wiki stats (cached under `data/raw-wiki/`): `npm run data:scrape`
- Fetch portraits into `public-shared/portraits/` (Rust, parallel Anime-Planet CDN): `npm run data:portraits` — pass `-- --force` to replace files; TypeScript fallback: `npm run portraits:ts --workspace=scripts`

Allowed series are listed in [`scripts/validate-characters.ts`](scripts/validate-characters.ts) (`ALLOWED_SERIES`). Add new entries in [`data/roster-expansion.json`](data/roster-expansion.json), then `npm run data:merge-roster` and `npm run data:validate`.

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
client/           React UI
server/           Authoritative multiplayer
shared/           Game rules + protocol
scripts/          Wiki scrape, validation, portraits
data/             Character database
public-shared/    Portrait assets copied into client build
```
