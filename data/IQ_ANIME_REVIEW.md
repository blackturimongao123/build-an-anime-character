# IQ — anime-context manual review

Wiki **Intelligence** rows often lack tier phrases our mapper understands, so `scripts/lib/wiki-stats.ts` falls back to **40**. Many other entries land on **85** because the wiki text mentions “genius” once. Those are poor fits for draft balance.

**Source of truth after review:** `data/manual-iq-overrides.json` (merged by `scripts/apply-iq-overrides.ts`).

**Recommended pipeline:**

```bash
# 1) Sync strength/speed/abilities/durability from VS Battles
data:stats-check-apply

# 2) Patch IQ from anime review
npm run data:iq-apply
```

## Rubric (0–100)

| Band | Meaning | Examples |
|------|---------|----------|
| **10–25** | Impaired, comic relief, or homunculus “empty head” | Mash, Sloth, Hinata (instinct-only volleyball) |
| **26–40** | Below average; brawler instinct; street smarts only | Denji, Asta, Inosuke, Zenitsu (panic mode), Luffy |
| **41–55** | Average shonen lead; learns in fights | Ichigo, Zoro, Sanji, Thorfinn (early), Noelle |
| **56–70** | Skilled tactician or experienced fighter | Saber, Vegeta, Kaneki, Buddha, Edward |
| **71–85** | Elite strategist, mastermind, or vast experience | Rimuru, Garou, Makima, Ainz, Madara, Gojo |
| **86–97** | World-class deductive / scientific / manipulative genius | L, Light, Senku, Koro-sensei, Meruem |
| **98–100** | Parody-omniscient (use sparingly) | Saiki, Anos (wiki); not Deku |

## Wiki parser fallout (was **iq: 40**)

| id | Anime rationale | IQ |
|----|-----------------|-----|
| `koro-sensei` | Superhuman educator, planner, scientist | 94 |
| `makima` | Long-horizon control devil | 93 |
| `rimuru-demon-lord` | Prior corporate + nation-building mind | 80 |
| `garou` | Adapts any martial art; fights intelligently | 80 |
| `ashborn-sl` | Architect of the Shadow Army system | 84 |
| `kaneki-ken-anime` | Analytical, ruthless when cornered | 74 |
| `hajun-record` | Cosmic antagonist; cruel but calculating | 72 |
| `jin-mori-anime` | Fight IQ high; not academic genius | 54 |
| `mash-burnedead` | Deliberate muscle-for-brains gag | 20 |
| `asta-black` | Book-dumb; grit and timing | 36 |
| `noelle-valkyrie` | Earnest, grows with mentorship | 46 |
| `ichigo-bankai` | Instinct and heart; poor long-game plans | 46 |
| `luffy-gear-4` | Battle genius; awful at schemes | 40 |
| `zoro-ennies` | Single-minded swordsman | 42 |
| `sanji` | Perceptive, cooks/strategizes under pressure | 60 |
| `saber-fsn` | King Arthur; command experience | 64 |
| `denji-chainsaw` | Simple motivations; occasional insight | 30 |
| `thor-record` | Divine brawler, not Odin-tier planner | 48 |

## Wiki tier mistakes (selected)

| id | Wiki-ish | Anime adjustment |
|----|----------|------------------|
| `gilgamesh-fsn` | 22 (bad parse) | 74 — ancient king, arrogant but cunning |
| `yamamoto` | 22 | 70 — millennium of command |
| `senku-ishigami` | 85 “genius”; **str/spd 40** = parse default, not “average human” | **97** IQ; physical baseline **14 / 16 / 12** from `manual-overrides.json` |
| `l-lawliet` / `light-yagami` | 85 | **92** / **80** — deductive vs hubristic planner |
| `lelouch-vi-britannia` | 85 | **88** — conspiracy-scale chess |
| `saitama` | 35 | **38** — kept low (satire) |
| `deku-100` | 100 | **68** — diligent student, not omniscient |
| `sloth-fma` | 35 | **16** — homunculus of sloth |
| `gluttony-fma` | 35 | **26** | 
| `greed-fma` | 35 | **54** — cunning businessman side |
| `all-might` | 85 | **44** — combat intuition, not analyst |
| `baki-hanma-anime` | 85 | **50** — fight IQ only |
| `zenitsu-godspeed` | 72 | **32** — coward; genius only asleep |
| `inosuke-demon-slayer` | 55 | **26** |
| `kusuo-saiki` | 85 | **90** — actual omniscient telepath (capped below parody gods) |

## Unchanged wiki IQ

Legendaries, cosmic tiers, and characters whose wiki **85** matches genre expectations (e.g. `netero-hxh`, many Pokémon box art forms) were left on wiki values unless obviously inflated.

Edit `manual-iq-overrides.json` and re-run `npm run data:iq-apply` to tune further.
