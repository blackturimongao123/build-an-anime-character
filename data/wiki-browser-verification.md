# Wiki search verification (browser + API)

Generated from Fandom search (`Special:Search`) and `scripts/audit-low-stat-wiki.ts` for roster entries with **2+ stats at 40**.

## Stat 40 audit (2026-11-12, browser + probe)

Roster ids that **had** any stat at **40** in `characters.json` were checked on VS Battles (Cursor browser for wrong-page cases, `scripts/_probe-check.ts` for the rest).

### Wrong wiki page (fixed in `wiki-hints.json` / `wiki-profile-hints.json`)

| id | Browser / probe found | Was resolving to | Fix |
|----|------------------------|------------------|-----|
| `gilgamesh-fsn` | [Gilgamesh (Archer)](https://vsbattles.fandom.com/wiki/Gilgamesh_(Archer)) | Generic **Gilgamesh** (all 40s) | Hint → `Gilgamesh (Archer)` |
| `saber-fsn` | [Artoria Pendragon (Saber)](https://vsbattles.fandom.com/wiki/Artoria_Pendragon) | **Saber** disambiguation | Hint → `Artoria Pendragon (Saber)` |
| `vegeta-ssb` | [Vegeta (DBS Anime)](https://vsbattles.fandom.com/wiki/Vegeta_(DBS_Anime)) + **Super Saiyan Blue** slice | `Vegeta (Dragon Ball Super)` (all 40s) | Hint + `statFormPhrase` like `goku-ssj2` |
| `l-lawliet` | [L (Death Note)](https://vsbattles.fandom.com/wiki/L_(Death_Note)) | **L Lawliet** (all 40s) | Hint → `L (Death Note)` |
| `sloth-fma` | [Sloth](https://vsbattles.fandom.com/wiki/Sloth) (FMA homunculus) | **Sloth Bear** via search | Hint → `Sloth` |
| `ash-greninja-anime` | [Greninja](https://vsbattles.fandom.com/wiki/Greninja) (Pokémon) | **Greninja (Super Smash Bros.)** | Hint → `Greninja` |
| `buddha-record` | [Buddha (Record of Ragnarok)](https://vsbattles.fandom.com/wiki/Buddha_(Record_of_Ragnarok)) | **The Buddha (World of Darkness)** | Hint → `Buddha (Record of Ragnarok)` |

After `cargo run … --apply`: **129/136** aligned, **0** entries with all five stats at 40.

### Correct page — remaining **40** is expected or parser

| Pattern | Examples | Verdict |
|---------|----------|---------|
| **iq: 40** only | (was many ids) | Wiki **Intelligence** parse fallback; **anime IQ** now in `manual-iq-overrides.json` via `npm run data:iq-apply` — see `IQ_ANIME_REVIEW.md`. |
| Low physical tiers | `l-lawliet`, `light-yagami`, `senku-ishigami`, `thorfinn-anime` | Death Note / human-scale cast — low strength/speed from wiki tiers. |
| Version slice | `truth-fma` (speed 40), `ichigo-bankai` (abilities/iq 40) | May need `statKey` / `statFormPhrase` if you want a specific arc tab. |
| Legendary Pokémon | `xerneas-anime`, `yveltal-anime` (abilities/durability 40) | Single column on page; spot-check if a form tab is intended. |

Re-run after hint changes:

```bash
PATH="<cursor-node-dir>:$PATH" cargo run --release --manifest-path stats-check/Cargo.toml -- --root . --apply
```

## Browser spot-checks

| Search query | First result (browser) | Verdict |
|--------------|------------------------|---------|
| Levi Ackerman Attack on Titan | [Levi Ackerman](https://vsbattles.fandom.com/wiki/Levi_Ackerman) | Correct page; low **strength** is parser (`Class 1` lifting), not wrong wiki |
| Roronoa Zoro Post-Timeskip | [Roronoa Zoro (Pre-Timeskip)](https://vsbattles.fandom.com/wiki/Roronoa_Zoro_(Pre-Timeskip)) | **Was wrong**: roster used Netflix profile; fixed in `wiki-hints.json` |

## Wrong page fixed

| id | Was | Now |
|----|-----|-----|
| `zoro-ennies` | Roronoa Zoro (Netflix) | Roronoa Zoro (Pre-Timeskip) |

## Correct page, parser / version slice needed

Most of the 28 “low” entries match the top search hit. Remaining 40s are usually:

- **Lifting**: `Class 1`–`Class 100` (Attack on Titan, street tiers) — added to tier mapping.
- **Form/version**: needs `wiki-profile-hints.json` (e.g. `meliodas-assault` → `statFormPhrase`: Assault Mode).
- **Human-scale cast**: Hajime no Ippo, Parasyte, Vinland early arcs — low tiers are expected unless you pick a later arc page.

## Meliodas Assault Mode

Search → **Meliodas** (single profile). Stats for Assault Mode are under transformation clauses / `Assault_Mode` tab — use `statFormPhrase`: `Assault Mode` (configured).

## Full API audit

See `data/wiki-search-audit.json` for per-id `searchHits` and naive `probeStats` on the resolved page.

Re-scrape after hint/profile changes:

```bash
cd scripts
node ../node_modules/tsx/dist/cli.mjs scrape-all-stats.ts --id=<character-id>
```
