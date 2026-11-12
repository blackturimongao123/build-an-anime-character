# Wiki search verification (browser + API)

Generated from Fandom search (`Special:Search`) and `scripts/audit-low-stat-wiki.ts` for roster entries with **2+ stats at 40**.

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
