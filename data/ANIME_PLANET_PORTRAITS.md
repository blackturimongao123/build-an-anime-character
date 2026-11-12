# Anime-Planet portrait lookup

## Preferred: anime **cast** page

For each roster series we map to Anime-Planet anime slug(s), e.g. [Tokyo Ghoul √A characters](https://www.anime-planet.com/anime/tokyo-ghoul-a/characters).

The fetcher loads `data/anime-planet-anime-slugs.json`, requests `/anime/<slug>/characters`, parses the cast table (`class="name"` + `/characters/...` links), and matches the roster **display name** (full name first; “Eto Yoshimura” → cast row **Eto**).

Portrait URL comes from the cast thumbnail CDN (full size) or the character page.

## Fallback chain

1. **Cast pages** for the character’s `series` (see `anime-planet-anime-slugs.json`)
2. **`anime-planet-hints.json`** — manual `/characters/<slug>` when cast misses
3. **Global character search** — full name → name + series → overrides → first name last

## Manual browser flow

1. Open the correct anime on Anime-Planet → **characters** tab (URL ends in `/characters`).
2. Find the row (e.g. **Eto** on Tokyo Ghoul).
3. If needed, add the anime slug to `anime-planet-anime-slugs.json` under the game series key (multiple seasons OK).

```bash
npx tsx scripts/fetch-portraits-ids.ts <id> …
```
