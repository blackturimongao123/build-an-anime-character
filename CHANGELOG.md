# Changelog

## 2026-11-13: Lighter client and smoother roll reel

### 9. Performance

Measured with a full local bot match in headless Chromium at 4x CPU slowdown on a Slow 4G profile (1.6 Mbps, 150 ms), before → after:

| Metric | Before | After |
|--------|--------|-------|
| JS bundle | 555 KB (122 KB gzip) | 365 KB (106 KB gzip) |
| Reel cells blank mid-spin | 73% | 3% |
| Portrait downloads per match | 177 (6.5 MB) | 78 (2.9 MB) |
| React commits per second (showdown) | 35 | 0.5 |
| Style recalculation per match | 2.2 s | 1.4 s |

| Area | Change |
|------|--------|
| `client/vite.config.ts`, `client/src/data/roster.ts` | The client no longer bundles the full `data/characters.json` (stats, wiki URLs, notes for every character). The build writes a slim `reel-roster.generated.json` (id, name, portrait; only characters whose portrait exists), regenerated on every dev start/build and when `characters.json` changes. It is gitignored. The server still uses the full file. |
| `client/src/data/roster.ts`, `main.tsx` | Reel faces are preloaded and decoded after the page loads and reused across spins, with 6 new faces added after each spin. Fillers no longer download 23 new images per reel per spin. |
| `client/src/components/RollSlotCard.tsx` | The rolled character's portrait is fetched at high priority when its spin starts. The reel's motion blur only changes in 2 px steps instead of restyling the tall strip every frame. The card is memoized by character id, so the server's once-a-second timer updates no longer re-render the 24-face reel. |
| `client/src/components/ArenaUI.tsx` | The AVG SCORE count-up writes the number directly each frame instead of re-rendering React 60 times a second. |
| `client/src/components/Portrait.tsx` | Images decode asynchronously. |

Not done yet: smaller portrait files. The originals average about 40 KB at about 400 px wide, while the reel shows them at about 170 px and the boards at 56 px. Generating about 320 px WebP thumbnails at build time would cut the remaining image bytes roughly in half or more, but needs a new image library (for example `sharp`).

## 2026-11-12: Average score

### 8. Average score

| Area | Change |
|------|--------|
| `shared/src/game.ts` | **AVG SCORE is now the total of all 5 stats ÷ 5.** Before, a knockout or tie removed that category from the loser's average (it averaged only surviving categories), so knockouts decided the winner. Now after clash *k* each side shows the sum of the first *k* revealed stats ÷ 5: it only climbs and ends at total ÷ 5. Knockout flags are kept for the on-screen knockout only. `finalWinner` compares the final values (equal → tie). |
| `client/src/components/ArenaUI.tsx`, `ShowdownScreen.tsx`, `styles/global.css` | The AVG SCORE number counts up (about 0.65 s, ease-out) from its previous value when the punch lands (210 ms, plus the 620 ms intro on the first desktop clash), with a small pop while counting. Reduced motion jumps straight to the value. The results screen shows the final value without counting. |
| `docs/GAMEPLAY.md`, `README.md` | Rules updated: average = total ÷ 5, fills in per clash, knockouts and ties are visual only. |

**Tested:** shared and client build. Scripted boards (90, 10, 50, 70, 30 vs 20, 80, 50, 60, 40) give 18/4 → 20/20 → 30/30 → 44/42 → 50/50 → tie. A local bot match showed both averages climbing on every clash and never dropping.

## 2026-11-11: Release prep

### 7. Fixes found in the release check

| Area | Change |
|------|--------|
| **Portraits** (`public-shared/portraits/`) | 115 of the 136 portraits were the same image: the last Anime-Planet fetch had saved one generic picture (Kakashi) for every character. Those 115 files were replaced with each character's earlier portrait. File names are unchanged, so `data/characters.json` needed no edits. The 21 portraits that fetched correctly were kept. `client/public/portraits/` is refreshed from `public-shared` automatically on the next dev run or build. |
| `portraits-fetch/src/main.rs` | **Guard:** if the same image comes back for more than one character, none of those copies are saved, and each is logged as `FAIL … likely a site placeholder`. The log now records the source URL of each saved image. **Compile fix:** a moved `ext` in the "skip existing" branch stopped the crate from building. |
| `scripts/validate-characters.ts` | `npm run data:validate` now fails if a portrait file is missing or if two characters share the same image bytes. |
| `server/render.yaml`, `README.md` | The Render build was `npm install` only. The server imports the `shared` workspace package, whose compiled `dist/` isn't committed, so the deploy would succeed and then crash on start (`ERR_MODULE_NOT_FOUND`). The build is now `npm install && npm run build --workspace=@build-character/shared`. Tested from the `server` folder on a clean copy: `/health` returns ok. |
| `.github/workflows/deploy-pages.yml` | Copies `index.html` to `404.html`, so deep links and refreshes on `/room/CODE` load the app instead of GitHub's 404 page. |
| `.gitignore` | Now ignores generated `client/public/portraits/` (Vite copies it from `public-shared`), local debug files (`data/_*`, `scripts/_*`, `data/portrait-samples/`), the 12 MB `data/raw-wiki/` scrape cache, and `reference UI/`, which holds screenshots of the original Roblox game. |
| `stats-check/src/worker.rs` | Removed a hard-coded `C:\Users\Me\…\node.exe` path. It now uses `NODE_BIN` or `node` from PATH. |
| `client/src/components/SoundToggle.css` | On phones, the mute button moves to the bottom-right so it no longer covers the title. |
| `README.md` | Updated the showdown description and added notes on sounds/mute and on the new portrait checks. |

**Tested from a clean `git clone`**, with the new `.gitignore` applied (220 tracked files, about 4.4 MB):
- `npm ci`, the shared build and the client build all succeeded, including under a Pages subpath (`VITE_BASE_PATH=/build-a-character/`).
- `npm run data:validate` passes.
- Played a full bot match to the results screen, then a rematch and a 2-player room.
- At phone size (390 px) there's no horizontal scroll.
- Zero console errors, zero failed requests and zero broken images.
- Both Rust crates build.

## 2026-11-11: Draft animations and hidden picks

Original versions of every modified file (including `ShowdownScreen.tsx`) are backed up in the Claude project Library under `Build a character/_backup-2026-11-11/`.

### 1. Slot-machine roll reel

Each round's rolled character appears in a vertical slot-machine reel. Portraits slide from top to bottom for about 2 seconds, then stop on the rolled character. Both players' cards, including the bot's, reveal at the same moment.

| File | Change |
|------|--------|
| `client/src/hooks/rollClock.ts` | **New.** A shared roll clock (`ROLL_SPIN_MS = 2000`). A roll that starts while another is spinning joins it and gets the same reveal time. A late joiner with less than `ROLL_MIN_JOIN_MS = 1200` left pushes the shared reveal back, so its reel still gets a real spin. |
| `client/src/hooks/useRollReveal.ts` | **Rewritten.** Now only decides *when* a card is revealed, using the shared clock. The old 32 ms `setInterval` frame swapping is gone. Reveal state is stored per character id, so a new roll never flashes as "revealed" for a frame. The call signature is unchanged. |
| `client/src/components/RollSlotCard.tsx` | **Rewritten.** While spinning, it renders `SlotReel`: a strip of 22 random roster portraits plus the final character, animated with `requestAnimationFrame`. The reel decelerates (cubic ease-out over 86% of the roll), overshoots by 6% of a card, then settles. It has speed-based vertical motion blur and never scrolls backwards if the shared end time is pushed back. Reduced motion: no scrolling. |
| `client/src/components/RollSlotCard.css` | **New.** Reel window, drum edge shading and a yellow payline. Base styles for the `.roll-card` wrapper (relative, clipped). The `deal` bounce on reveal. `.roll-card--departed` uses `visibility: hidden` so the flying copy starts from the card's exact position. |

### 2. Shrink and fly into the chosen category

When you press a category's **+**, the rolled card pops slightly, then shrinks and flies into that square. This happens instantly, before the server replies.

| File | Change |
|------|--------|
| `client/src/components/FlyingPortrait.tsx` | **Rewritten.** Uses the Web Animations API with `transform`: a 1.06 pop, then translate and scale into the slot over 520 ms (`FLY_MS`). Positions are measured once on mount, so timer ticks never restart the flight. Takes `getFrom` and `getTo` functions instead of elements. There's a fallback timer in case the animation is cancelled. Reduced motion: lands instantly. |
| `client/src/components/FlyingPortrait.css` | **New.** Styles for the fixed-position flying copy, and `.category-row__thumb--hidden`, which keeps the slot's space while the card is in flight. |
| `client/src/components/CategoryRow.tsx` | New optional props: `rowRef` (lets the draft screen find the slot square) and `hidePortrait` (hides the thumb and name until the flying card lands). |
| `client/src/components/DraftScreen.tsx` | **Rewritten.** Uses `RollSlotCard` with `useRollReveal` for both sides, and `FlyingPortrait` for picks. Your pick is shown immediately as an optimistic local pick until the server confirms it. A server-made pick, such as the timeout auto-pick, also flies in. The opponent's card flies in only once their pick is revealed. You can't pick until your reel has stopped. Status text: ROLLING… / CHOOSE A CATEGORY… / WAITING FOR OPPONENT… / LOCKED!. Flight keys include the round and character id, so a rematch never collides with an earlier match. |

### 3. Opponent's pick hidden until both have picked

| File | Change |
|------|--------|
| `server/src/index.js` | New `stateForSide(state, side)`. During the `draft` phase, each player's broadcast leaves out the opponent's locked category and the character placed there this round. The pick is never sent, so it isn't visible in dev tools either. Once both have picked (phase `animating`), the full state is sent and the opponent's card flies into place. Applies to multiplayer and bot games. |
| `server/src/roomManager.js` | `afterBothLocked()` sets `draft.timerSeconds` to `0`, so the round timer visibly ends when both players have picked. |

### 4. Showdown clash animation

Each clash in the showdown now plays out as a fight between the two portraits in that category.

| File | Change |
|------|--------|
| `client/src/components/ShowdownClash.css` | **New.** Both portraits wind up and lunge at each other, with the impact burst timed to the moment of contact. **Win:** returns to its spot. **Lose:** knocked back, falls off the board and disappears. **Tie:** both hit, recoil and return to their spots. The 1.1 s animation fits inside the 2.2 s step. The first clash waits for the boards to slide together. Reduced motion: the loser just disappears. |
| `client/src/components/ShowdownScreen.tsx` | Works out `win` / `lose` / `tie` for each side of the active clash and passes it to the row. Rows tied in an earlier clash stay visible but dimmed, instead of being hidden like losers. The old `defeated` shake is no longer used here. |
| `client/src/components/CategoryRow.tsx` | New optional props: `clash` (`"win" | "lose" | "tie"`) and `dimmed`. |

**Scoring is unchanged:** both sides of a tie are still eliminated from the average, as in `docs/GAMEPLAY.md`. Only the visuals differ.

**Tested:** played a full bot match to the showdown, with a tie forced in the test copy only. The tie gave both portraits `tie`, and both stayed dimmed afterwards. A normal clash gave `win:68` and `lose:48`, and the loser was knocked off and hidden. Typecheck passes, with no console errors.

### 5. Sound effects

All sounds are synthesized with the Web Audio API, so no audio files were added. They are deliberately quiet (master volume 0.5, and each sound stays at or below a gain of about 0.09).

| File | Change |
|------|--------|
| `client/src/audio/sfx.ts` | **New.** Sounds: `playReelTick` (a short roulette click), `playReelStop` (a soft two-note chime), `playClick` (UI button) and `playPick` (category pop). Also: mute state saved in `localStorage` (`bac:sfx-muted`), and `installClickSounds()`, one document-level `pointerdown` listener. The listener plays `playPick` on an active **+** slot and `playClick` on any other button, select or checkbox, so no other component needed changing. |
| `client/src/components/RollSlotCard.tsx` | The reel ticks each time a portrait crosses the window, with at least 28 ms between ticks, so ticks slow down as the reel does. The chime plays when the card lands. Only your own card makes sound, so two reels don't double up. **Bug fix:** the reel's portrait list is now keyed on the character id instead of the object. Before, every server timer broadcast rebuilt the strip and restarted the spin partway through. |
| `client/src/components/SoundToggle.tsx` / `.css` | **New.** A small 🔊/🔇 mute button, fixed in the top-right corner on every screen. It also installs the click sounds. |
| `client/src/App.tsx` | Renders `<SoundToggle />` next to the routes. |

**Tested:** in a bot match, one roll gave 21 roulette ticks spread over the spin, followed by the chime. Pressing **+** played the pick sound. After muting, the next round made no sounds, and the setting was saved. Typecheck passes, with no console errors.

### 6. Faster clash and punch sounds

| File | Change |
|------|--------|
| `client/src/components/ShowdownClash.css` | The clash runs twice as fast: 0.55 s instead of 1.1 s, with contact at 0.21 s. The impact burst now shows at contact and lasts 0.3 s. The first clash still waits 0.62 s for the boards to slide together. |
| `client/src/audio/sfx.ts` | New `playPunch(heavy)`: a low sine thump plus a short low-passed noise smack, kept quiet. `heavy` is a deeper, longer version used for knockouts. |
| `client/src/components/ShowdownScreen.tsx` | Plays the punch exactly on contact (`CLASH_CONTACT_MS = 210`, plus 620 ms on the intro clash), once per clash. **Knockout:** one heavy hit. **Tie:** two light hits, 70 ms apart. |

### Testing done (sections 1–3)

- Client typecheck (`tsc --noEmit`, strict, with `noUnusedLocals`) passes.
- Ran the real server and client with two browser players, then one bot game:
  - The flying card starts as soon as you press.
  - The other player sees no slot and no highlight from your pick until they pick too.
  - After both pick, the timer shows `0`, the status is `LOCKED!`, and the opponent's card flies in.
  - Round 2 starts with both reels spinning.
  - The bot's pick appears only at `LOCKED!`.
  - No console errors.

### Notes

- **Line endings:** CRLF, matching the rest of the project.
- **Not changed:** `global.css`, the shared game rules and the protocol types.
- **Possible follow-up:** an "opponent has locked in" indicator that doesn't reveal the category. It would need a small server flag.
