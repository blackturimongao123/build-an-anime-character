# Franchise scaling notes

## Roster forms (current policy)

- **One roster entry per character** — the **strongest anime-appropriate form** only (`data/overrides/roster-form-policy.json`, `defaultMaxForms: 1`).
- **`displayName`** is the **character name only** (no parenthetical form labels). Wiki slice / stats still come from the peak form via `wiki-profile-hints.json` and stable `id` (e.g. `goku-ssj2`, `meliodas-assault`).
- **Different people** in a series still get separate entries (Demon Slayer cast, FMA homunculi, etc.).
- **Duplicates: always keep the strongest version.** When two entries are the same character (forms, versions or re-imports under another ID), keep one: the highest-tier form, or, when that's unclear, the one with the highest stat total (strength + speed + abilities + durability). Placeholder stats (all 50s) never count as stronger than curated values. The kept entry gets the IQ from the latest IQ review export. Removed copies are listed in `data/DELETED_*.md`.

Re-normalize after bulk edits: `node ../node_modules/tsx/dist/cli.mjs normalize-roster-single-form.ts` (from `scripts/`).

## Solo Leveling

**Solo Leveling is the only roster allowed to use full manhwa / novel feats** (not limited to the anime adaptation). VS Battles pages are typically labeled `(Novel)` but reflect the complete comic series.

Other franchises remain **anime-only** forms unless noted in `wiki-hints.json`.
