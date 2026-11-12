# How Build an Anime Character works

This document describes player-facing rules and how the online server applies them. Stat numbers come from VS Battles wiki data, normalized to a **0–100** scale per category (see `data/characters.json` and `shared/src/tiers.ts`).

---

## Goal

Build the **strongest overall lineup** across five stats. You do not add numbers together for one giant “power level”—each category is its own head-to-head clash. The player with the higher **running average** of still-active categories after all clashes wins.

---

## The five categories

| Key | UI label | Meaning (simplified) |
|-----|----------|-------------------|
| `strength` | Strength | Peak **lifting** or **striking** physical output — not attack potency |
| `speed` | Speed | **Physical** travel/combat speed only (not teleport-style techniques) |
| `abilities` | Abilities | **Attack potency** plus how overpowered special effects are (hax, space/time defence, etc.) |
| `iq` | IQ | Intelligence and tactics |
| `durability` | Durability | How hard you are to put down, erase, or bypass |

Each roster character has a fixed score in each category. In draft and showdown, only the stat **matching the slot** matters (e.g. the character in the Speed slot uses their Speed value).

### What 0 and 100 mean (design anchors)

These are **reference endpoints** for the draft scale, not strict physics sim rules.

| Stat | **0** (floor) | **100** (ceiling) |
|------|----------------|-------------------|
| **Strength** | Weak infant / negligible physical force | Destroy/create **multiple realities or infinite universes** with raw physical output |
| **Speed** | Cannot meaningfully move (where that applies) | **Instant travel** over any distance by **physical** speed (not Instant Transmission–class swaps) |
| **Abilities** | No meaningful destructive or hax impact | Universe/multiverse-scale **attack potency** and domination-tier powers (e.g. passive control like Gojo’s Infinity on a relevant scale) |
| **Durability** | Any serious hit ends the fight | **Immortality**, intangibility, cannot be erased, resists reality warping and time manipulation |
| **IQ** | Animal-level or worse | Omniscient-tier mastery |

Most roster scores sit between these extremes. VS Battles tier phrases are **mapped** into 0–100 bands in `shared/src/tiers.ts`.

---

## Modes

### vs BOT

- Host checks **Play vs BOT** and picks **Easy**, **Medium**, or **Hard**.
- You are always **Player 1**; the server plays **Player 2** as BOT.
- Same rules as multiplayer; the server locks the BOT’s pick after you lock (short delay).

### 2-player online

- **Player 1** creates a room and shares the **6-letter code** (no confusing characters like `0`/`O`).
- **Player 2** enters the code and joins.
- The **WebSocket server** is authoritative: both clients display the same `MatchState` broadcasts.

---

## Match phases

```
lobby → draft (×5 rounds) → animating → showdown → results
```

| Phase | What happens |
|-------|----------------|
| **lobby** | Waiting for opponent (or BOT already set). Host starts when ready. |
| **draft** | Each round, both sides get a **random character** from the global pool, then each **locks** that character into **one empty category** on their board. |
| **animating** | Brief pause (~1.2s) between rounds or before showdown. |
| **showdown** | Five clashes play in order (Strength → Speed → Abilities → IQ → Durability). |
| **results** | Winner from final running averages; rematch option. |

---

## Draft (5 rounds)

Constants (`shared/src/game.ts`): **`MAX_ROUNDS = 5`**, **`DRAFT_TIMER_SECONDS = 15`**.

### Each round

1. Server rolls **Player 1’s** character from the pool (excluding characters **already used in this match** by either player).
2. Server rolls **Player 2’s** character from what’s left (P1’s new roll is also excluded from P2’s pool for that round).
3. Each player sees **their** roll (and the opponent’s roll when applicable).
4. Each player taps **+** on **one category** that is still empty on **their** board.
5. When **both** have locked, the round ends. Boards carry forward; empty slots remain for later rounds.

### Rules

- **One character per category per player** — five slots, five rounds, five characters each.
- **No duplicate characters in one match** — once a character id is used, neither side can roll them again that game.
- **No re-locking** — after you lock a category for the round, you cannot change it.
- **Independent rolls** — you and your opponent usually get **different** characters each round.

### Timer

If the timer hits **0**, anyone who has not locked yet gets an **auto-pick**: a random **remaining empty category** (BOT uses its difficulty logic instead of random).

### BOT difficulties

| Difficulty | Behavior |
|------------|----------|
| **Easy** | Random empty category. |
| **Medium** | Picks the category where the rolled character’s stat is **highest**. |
| **Hard** | Picks the category that maximizes expected clash margin vs your **already placed** stats, with a small bonus for strong leftover stats on future rounds. |

---

## Showdown

After round 5, both boards must have **one character in every category**. The server builds five **beats** (`computeShowdownBeats`).

### Order

Clashes always run in this order:

1. Strength  
2. Speed  
3. Abilities  
4. IQ  
5. Durability  

(UI steps through them ~2.2s apart.)

### Per category

- Compare **P1’s stat** vs **P2’s stat** for that category only (0 if missing, which should not happen after a full draft).
- **Higher stat wins the clash.**

### Elimination mechanic

This is the distinctive rule:

| Clash outcome | Effect |
|---------------|--------|
| **You win** | Your opponent is **eliminated in that category** (their slot no longer counts toward their average). |
| **You lose** | **You** are eliminated in that category. |
| **Tie** | **Both** are eliminated in that category. |

Elimination only affects the **running average** display and the final result—it does not remove characters from the board visually; it marks that slot as “out” for scoring.

### Running average (AVG SCORE)

After each clash, each side’s average is recomputed using **only categories not yet eliminated** for that player:

\[
\text{average} = \text{round to 1 decimal}\left(\frac{\sum \text{active stat values}}{\text{count of active categories}}\right)
\]

Example: after winning Strength, you still count all five of your stats; after you lose Speed, your Speed slot stops contributing.

The UI shows these running averages updating after each beat.

### Match winner

After the last category (`finalWinner`):

- Compare **final running averages** (after all eliminations from beat 5).
- Higher average wins (**p1** or **p2**).
- **Exact tie** → declared **tie**.

There is no “sudden death” beyond the five ordered clashes.

---

## Stats and balance notes

- Scores are **not** raw VS Battles tiers in the UI; they are mapped to 0–100 for draft readability.
- **Per stat line on the wiki**, the pipeline takes the **highest** matching tier or keyword it finds in that row (after optional form/tab slicing) — see `maxTierScore` / `mapStatsFromWikiHtml` in `scripts/lib/wiki-stats.ts`.
- **Strength** = max(**Lifting Strength**, **Striking Strength**) for the chosen form. **Attack Potency is not used for Strength.**
- **Speed** = best **physical** speed tier; clauses that look like teleportation, Instant Transmission, swaps, time-stop-as-movement, etc. are skipped when a better physical clause exists.
- **Abilities** = best of **Attack Potency** and the **Powers and Abilities** section (destructive/hax tier and “how busted” the kit is). Striking Strength does not inflate Abilities.
- **Durability** = durability/stamina row plus high-end endurance keywords (immortality, erase resistance, etc.) when the wiki states them.
- Some characters are **form-specific** roster entries (e.g. Goku SSJ2) with wiki slices in `data/wiki-profile-hints.json`.
- Manual tuning lives in `data/manual-overrides.json`.
- Re-verify scraped stats (parallel): `npm run data:stats-check` (Rust + TS mapper). Use `npm run data:stats-check-apply` to write wiki-derived numbers back into `data/characters.json`.

---

## Rematch

From **results**, either player can request a **rematch**: same room code and BOT settings, fresh draft (new rolls, empty boards, pool reset for used ids).

---

## Where logic lives (for developers)

| Area | Location |
|------|----------|
| Rules (draft, showdown, BOT picks) | `shared/src/game.ts` |
| Types & categories | `shared/src/types.ts` |
| Authoritative room / timers | `server/src/roomManager.js` |
| UI | `client/src/pages/` |

For setup and deployment, see the root [README.md](../README.md).
