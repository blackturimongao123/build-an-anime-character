# Roster batch 2 expansion

Adds characters per series tier (IQ/strength etc. filled after wiki scrape):

| Tier | Target / series |
|------|-----------------|
| Major | 30 — One Piece, Naruto, Dragon Ball, JJK, Demon Slayer, MHA, HxH, Fairy Tail, Black Clover, Fate, AoT, FMA |
| Bleach | **80** — captains/liutenants, visored, Sternritter, Espada, Soul King + Royal Guard (see catalog) |
| Frozen | **Pokémon** — original roster only (15 legendaries / forms); no catalog expansion |
| Mid | 15 — JoJo, Chainsaw Man, OPM, SDS, SAO, Tokyo Ghoul, Code Geass, Mob, Death Note, Dr Stone, Fire Force, Vinland, Kuroko, RoR, Solo Leveling, Gintama |
| Slime | **30** — Octagram/true dragons + Tempest leaders (see catalog) |
| Minor | 10 — Akame, Assclass, Haikyuu, Overlord, Mushoku, Saiki, Mashle, Ippo, Baki, Kengan, Gurren, Parasyte, GOH, Maou Gakuin, Hellsing, Tokyo Revengers |

## Files

- `roster-batch2-catalog.json` — candidate pool (`[id, name, wikiPage, apSlug?]`)
- `roster-batch2-entries.json` — generated gap-fill for this run
- `roster-batch2-new-ids.txt` — ids added last apply (for scrape/portraits)

## Commands

```bash
npm run data:roster-batch-build
npm run data:roster-batch-apply
npm run data:roster-batch-onboard          # scrape + AP portraits + wiki-apply + validate
```

Portrait chunks and wiki scrape for hundreds of ids can take **1–3 hours**; onboard script processes portraits in chunks of 20.

Edit the catalog to add/rename characters, then re-run build + apply (existing ids are skipped).

Wiki apply uses **per-stat peak** across non-**manga** tab/columns in `data/wiki-db/scrapes/` (profile hints narrow the pool first). Game stats store `sources.wikiStatKey` = `peak (non-manga)` when composited. Re-run `npm run data:wiki-apply` after scrapes or hint changes.
