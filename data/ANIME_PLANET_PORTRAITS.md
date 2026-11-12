# Anime-Planet portrait lookup

## Search order (automated + manual)

1. Set site search scope to **characters** (not anime).
2. **`animePlanetPortraitUrl`** tries queries in this order:
   - Full `displayName` (as stored on the roster)
   - Parenthesis-stripped full name
   - `Full Name` + series label (e.g. `Sōsuke Aizen` + `Bleach`)
   - Per-id `SEARCH_OVERRIDES` in `fetch-portraits-ids.ts`
   - **First name only last** (stricter match threshold so “Aizen” does not grab a random homonym)
3. **`data/anime-planet-hints.json`** — direct `/characters/<slug>` when full-name search fails (e.g. AP lists Eto as slug `eto` only).

```bash
npx tsx scripts/fetch-portraits-ids.ts <id> …
```

## Manual browser flow

Same as above: **characters** filter → type **full name** first → open the row that matches the series → copy slug into `anime-planet-hints.json` if needed.
