# Human-scale & wiki-fallback stat review

## The “40” problem

When a VS Battles row has **no tier phrase** the mapper matches (`maxTierScore(..., fallback)` with default **40**), the stat becomes **40**. That is **not** “average human” on our scale — it is an **unknown / missing parse** band sitting awkwardly above real human anchors (**10-b ≈ 12**, athlete **≈ 18**, street **≈ 22**). See `shared/src/tiers.ts`.

**Senku-style cases:** weak normals were showing **strength/speed 40** while **IQ** was correctly boosted by `manual-iq-overrides.json`.

## Review actions (2026-11-12)

| Issue | ids | Fix |
|-------|-----|-----|
| Wiki **40 fallback** on mundane bodies | `l-lawliet`, `light-yagami`, `senku-ishigami`, `kuroko-tetsuya`, `aomine-daiki`, `roy-mustang`, `thorfinn-anime` | `manual-curated-stats.json` human baselines |
| **Wrong wiki hit** (stats from another character) | `hinata-shoyo` → Hinata Hyūga (Naruto) | No reliable Haikyuu page on VS; **full curated** volleyball baseline |
| **Wrong wiki inflation** | `lelouch-vi-britannia`, `c-c-geass` strength **100** | Curated teen / immortal **human-scale** strength |
| Shinigami parse lumped at 40 | `ryuk-hxh` | Curated (still superhuman hax, not four 40s) |
| Cosmic / form parse gaps | `truth-fma` speed, `ichigo-bankai` abilities, Xerneas/Yveltal, SL novel speeds | Curated from series context |
| Wrong era / speed band | `ichigo-bankai` was **Pre-Timeskip** (hypersonic **68**); VS **Post-Timeskip → Merged Hollow Form** lists **Massively FTL with Bankai** (~**122×c** on verse CRT) vs **Adam** wiki **~88** (FTL+/MFTL band) | **speed 90** + wiki hints to Post-Timeskip col 3 |
| **Manga peak** (wiki parse miss) | `alucard` | **str 90**, **spd 88**, **abl 94**, **dura 98** (curated); **iq** from `manual-iq-overrides.json` / review export |
| Intentional | `luffy-gear-4` **iq 40** | Kept (anime review) |

## Pipeline

```bash
npm run data:stats-check-apply   # wiki (can reintroduce 40s)
npm run data:iq-apply            # anime IQ
npm run data:curated-apply       # this review
```

Edit `data/manual-curated-stats.json` and re-run `data:curated-apply`.

Legacy full packages for some of the same ids still exist in `data/manual-overrides.json` (used by `scrape-all-stats.ts`); **curated file is what post–stats-check apply uses.**
