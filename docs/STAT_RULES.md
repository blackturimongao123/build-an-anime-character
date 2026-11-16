# Stat rules

How the four physical game stats are derived from VS Battles. IQ is not covered here: it always comes from `data/overrides/manual-iq-overrides.json`, your hand-curated values.

## Source and filters

- **Source:** each character's VS Battles page, stored in the local database (`npm run wiki:db-resolve` → `npm run wiki:db-build`).
- **Strongest version:** use the strongest form or key of the character, per the duplicates rule in `docs/data/FRANCHISE_NOTES.md`.
- **Anime canon only:** manga-only forms, stat lines and feats are left out (`data/sources/anime-coverage.json`). Solo Leveling, Fire Force, Hellsing and Kengan are exempt and keep their manga or novel content. Excluded rows stay in the database, tagged, so the rule can change later.
- **Still-airing series, only what has aired** (decided 2026-11-16): forms and feats already shown in the anime count. Anything not yet animated is excluded, the same as manga-only content. Arcs the coverage table marks "unclear" are treated as not yet animated until they air.
- **Firm values first:** "possibly" or "likely" values only count when a form has no firm value.

## The four stats

| Stat | Definition | Baseline from the database | Manual layer (`data/overrides/stat-adjustments.json`) |
|------|-----------|-----------------------------|---------------------------------------------|
| **STR** | The higher of lifting strength and striking strength. | `max(lift score, striking tier score)` | Rare, only when the wiki row is clearly off. |
| **SPD** | **Physical** speed: combat, reaction or movement speed, **including speed gained from abilities that enhance the body's own movement, combat or reaction speed** (rule clarified 2026-11-16). Counts, for example: Gojo using Blue to pull himself and boost his movement; energy, ki or cursed-energy reinforcement; Flash Step, Shunpo, Sonido and Hirenkyaku; Gear 2/4/5; Haki-boosted reactions; Kaioken and similar transformations; Sharingan or Byakugan reaction boosts (as reaction speed). Still excluded: true teleportation or instant relocation (Instant Transmission, Hiraishin, Kamui, portals) and time stop. | Highest speed class after removing clauses about teleportation or instant relocation. Unquantified boosts in the speed row ("higher with X") add +4, and "far/much higher with X" adds +8, capped at 97. | Speed floors (`spd_min`) for characters whose ability-enhanced speed the wiki row doesn't capture. They're calibrated to the characters they keep pace with, with a reason naming the ability. |
| **ABL** | Attack potency plus hax: what the character's abilities would add to the fighter you're building. | Attack potency tier score. | **Hax.** Points on top of the baseline for things like reality, time or causality manipulation, soul or existence erasure, absorption, copying, nullification, regeneration negation and mind control. Each entry needs a short reason that names the abilities it relies on. |
| **DUR** | What the body can take or block, with stamina as an adjacent factor. At the top end this includes anti-hax resistances and immortality, both physical (regeneration) and existential (soul or concept). | Durability tier score, ±2 for stamina. | **Resistances and immortality.** Higher regeneration and immortality types, and broad resistances, are added with a reason. |

`stat-adjustments.json` entries take the form `{ "abl": +N | "abl_min": N, "dur": +N | "dur_min": N, "reason": "…" }`. A `_min` value sets a floor, which is useful for hax that is decisive regardless of raw power, such as Gold Experience Requiem.

## Scales

The same tier gives the same score in STR (striking), ABL (attack potency) and DUR (durability).

| Tier | Score | Tier | Score | Tier | Score |
|------|------:|------|------:|------|------:|
| 10-C | 4 | Low 7-C | 40 | 5-C | 69 |
| 10-B | 8 | 7-C | 42 | Low 5-B | 71 |
| 10-A | 12 | High 7-C | 44 | 5-B | 73 |
| 9-C | 16 | Low 7-B | 46 | 5-A | 75 |
| 9-B | 20 | 7-B | 48 | High 5-A | 77 |
| 9-A | 24 | 7-A | 51 | Low 4-C | 79 |
| 8-C | 28 | High 7-A | 53 | 4-C | 80 |
| High 8-C | 31 | 6-C | 55 | High 4-C | 81 |
| 8-B | 34 | High 6-C | 57 | 4-B | 83 |
| 8-A | 37 | Low 6-B | 59 | 4-A | 84 |
| | | 6-B | 61 | 3-C | 86 |
| | | High 6-B | 63 | 3-B | 87 |
| | | 6-A | 65 | 3-A | 88 |
| | | High 6-A | 67 | High 3-A | 89 |
| Low 2-C | 90 | 2-C | 91 | 2-B | 92 |
| 2-A | 93 | Low 1-C | 94 | 1-C | 95 |
| High 1-C | 96 | 1-B / High 1-B | 97 | Low 1-A / 1-A | 98 |
| High 1-A | 99 | 0 | 100 | | |

**Speed (SPD):**

| Class | Score | Class | Score |
|-------|------:|-------|------:|
| Below average / normal human | 4 / 8 | Massively Hypersonic | 55 |
| Athletic / peak human | 12 / 16 | Massively Hypersonic+ | 58 |
| Superhuman | 20 | Sub-Relativistic / + | 62 / 64 |
| Subsonic / + | 24 / 27 | Relativistic / + | 67 / 69 |
| Transonic | 30 | Speed of Light | 71 |
| Supersonic / + | 33 / 36 | FTL / FTL+ | 74 / 77 |
| Hypersonic / + | 40 / 44 | Massively FTL | 82 |
| High Hypersonic / + | 48 / 51 | Massively FTL+ | 87 |
| | | Infinite | 93 |
| | | Immeasurable | 97 |
| | | Irrelevant | 99 |

**Lifting strength (feeds STR):** Regular human 8, Athletic 12, Peak 16, Superhuman 22, Class 1 22, Class 5 24, Class 10 26, Class 25 28, Class 50 30, Class 100 33, Class K 38, Class M 44, Class G 50, Class T 56, Class P 62, Class E 68, Class Z 74, Class Y 79, Stellar 83, Multi-Stellar 85, Galactic 87, Multi-Galactic 88, Universal 89, Multiversal 92, Infinite 96, Immeasurable 98, Irrelevant 100.

## Hax guide (ABL)

These are guidelines for the manual layer. Judgment per character beats keyword counting.

| Weight | Abilities |
|--------|-----------|
| Decisive (+15 to +30, or a floor around 90–98) | Reality warping, causality manipulation (for example Gold Experience Requiem's return to zero), conceptual or existence erasure, high-level time manipulation (stop or rewind), plot or fate manipulation |
| Major (+6 to +12) | Soul manipulation, power nullification, absorption or copying, spatial or dimensional manipulation, mind control, death manipulation, regeneration or durability negation, sealing |
| Minor (+1 to +4) | Elemental and energy manipulation, status effects (poison, paralysis), barriers, summoning |

## Durability guide (DUR)

- **Regeneration:** Mid-Godly or higher adds +6 to +10.
- **Existential immortality:** soul, concept or abstract immortality adds +8 to +15.
- **Resistances:** broad resistances to major hax add +3 to +8.
- **Stamina:** limitless or near-limitless stamina adds +2, and poor stamina subtracts 2.

The baseline tier still dominates. Adjustments never push a street-level body above 50 unless it truly can't be harmed, for example through intangibility or a conceptual existence.
