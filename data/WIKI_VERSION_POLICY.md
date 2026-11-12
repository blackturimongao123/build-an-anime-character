# Wiki version policy (roster stats)

## How many forms go on the roster

**For now:** each **named character** has **one** roster slot — their **strongest** tracked form. Stats are scraped from the matching VS Battles column/tab for that form; the UI shows only the plain character name (no `(Bankai)`, `(Gear 4)`, etc.).

Franchise breadth comes from **different characters**, not multiple versions of the same person.

When adding someone new, pick the peak form you want in the game and map it with `wiki-profile-hints.json`. Use a stable `id` that still hints at the wiki slice (e.g. `naruto-bsm`).

**CI:** `npm run data:validate` enforces one entry per character identity (`data/roster-form-policy.json`) and rejects parenthetical `displayName` values.

## Mapping VS Battles

- **`data/wiki-hints.json`** — canonical wiki page title (wins over stale `sources.wikiPage`).
- **`data/wiki-profile-hints.json`** — URL `#fragment`, `tabFragments` (nested Fandom tabbers), `statColumnIndex` / `statKey` (pipe timelines), `statFormPhrase` (transformation clause), optional `wikiUrlBase` when the link hash page differs from the parsed page.

The scraper slices **Powers and Stats**, narrows tab panels when configured, and prefers pipe-rich stat rows after the `Key:` line.
