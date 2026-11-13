import { forwardRef, memo, useEffect, useMemo, useRef } from "react";
import type { Character } from "@build-character/shared";
import { Portrait, portraitSrc } from "./Portrait";
import { pickSpinCharacters } from "../data/roster";
import { getRollEnd } from "../hooks/rollClock";
import { playReelStop, playReelTick } from "../audio/sfx";
import "./RollSlotCard.css";

/** Filler portraits that scroll past before the final one lands. */
const REEL_FILLERS = 22;

type RollSlotCardProps = {
  character: Character | null | undefined;
  spinning: boolean;
  revealed: boolean;
  flownAway: boolean;
  locked?: boolean;
  side: "you" | "opp";
};

/**
 * The server re-sends fresh character objects on every timer tick. Compare by
 * id so those ticks don't re-render the card and its 24-face reel.
 */
const sameCard = (a: RollSlotCardProps, b: RollSlotCardProps) =>
  a.character?.id === b.character?.id &&
  a.spinning === b.spinning &&
  a.revealed === b.revealed &&
  a.flownAway === b.flownAway &&
  a.locked === b.locked &&
  a.side === b.side;

export const RollSlotCard = memo(forwardRef<
  HTMLDivElement,
  RollSlotCardProps
>(function RollSlotCard(
  { character, spinning, revealed, flownAway, locked, side },
  ref,
) {
  const showName = revealed && !spinning;
  const landed = revealed && !spinning && !!character;
  // Soft chime when your reel lands (your card only).
  useEffect(() => {
    if (landed && side === "you") playReelStop();
  }, [landed, side, character?.id]);
  const showSeries = showName && !!character;
  const reelActive = spinning && !!character;
  return (
    <div className="roll-card-outer">
      <div
        ref={ref}
        className={[
          "roll-card",
          `roll-card--${side}`,
          spinning ? "roll-card--spinning" : "",
          reelActive ? "roll-card--reel" : "",
          locked ? "roll-card--locked" : "",
          flownAway ? "roll-card--departed" : "",
          revealed && !spinning ? "roll-card--revealed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {reelActive ? (
          <SlotReel key={character.id} character={character} sound={side === "you"} />
        ) : (
          <Portrait
            character={character}
            showName={showName}
            className="roll-card__portrait"
          />
        )}
      </div>
      {showSeries && (
        <span className="roll-card-outer__series">{character.series}</span>
      )}
    </div>
  );
}), sameCard);

/**
 * Slot-reel easing: spins fast and decelerates over most of the roll,
 * overshoots slightly past the final portrait, then settles back.
 */
const SETTLE_AT = 0.86;
const OVERSHOOT = 0.06; // in card heights
function reelEase(t: number, travel: number) {
  const over = OVERSHOOT / travel;
  if (t < SETTLE_AT) {
    const u = 1 - t / SETTLE_AT;
    return (1 + over) * (1 - u * u * u);
  }
  const u = (t - SETTLE_AT) / (1 - SETTLE_AT);
  return 1 + over * (1 - (u * u * (3 - 2 * u)));
}

/**
 * Vertical slot-machine reel. Strip order top→bottom is
 * [spare, FINAL, filler…]; it starts showing the last filler and slides
 * down until FINAL fills the card. The spare above FINAL is only seen
 * during the settle bounce.
 */
/** Minimum gap between roulette ticks, so the fast start stays a soft rattle. */
const TICK_MIN_GAP_MS = 28;

function SlotReel({ character, sound }: { character: Character; sound: boolean }) {
  const stripRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    // The rolled character is the face the reel lands on: fetch it first.
    const landing = new Image();
    landing.fetchPriority = "high";
    landing.src = portraitSrc(character);
    const fillers = pickSpinCharacters(
      REEL_FILLERS + 1,
      new Set([character.id]),
    );
    return [fillers[0]!, character, ...fillers.slice(1)];
    // Keyed on id: the server re-sends fresh character objects every timer tick,
    // and a new object must not rebuild (and restart) the spinning reel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const count = items.length;
    const finalIndex = 1;
    const startIndex = count - 1;
    const travel = startIndex - finalIndex;
    const start = performance.now();
    let maxProgress = 0;
    let lastPos = startIndex;
    let lastT = start;
    let raf = 0;
    let lastCell = startIndex;
    let lastTickAt = 0;
    let lastBlur = -1;

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const frame = (now: number) => {
      const end = getRollEnd();
      const span = Math.max(1, end - start);
      // Monotonic, so a pushed-back shared end never scrolls the reel backwards.
      maxProgress = Math.max(maxProgress, Math.min(1, (now - start) / span));
      const eased = reduceMotion ? (maxProgress < 1 ? 0 : 1) : reelEase(maxProgress, travel);
      const pos = startIndex - eased * travel; // index shown at top of the card
      strip.style.transform = `translate3d(0, ${(-pos / count) * 100}%, 0)`;

      // Vertical motion blur scaled by speed (items per second).
      const dt = Math.max(1, now - lastT);
      const speed = Math.abs(lastPos - pos) / (dt / 1000);
      lastPos = pos;
      lastT = now;
      // Blur in 2px steps: a filter change re-renders the whole tall strip, so
      // only touch it when the level actually changes (a few times per spin).
      const blur = reduceMotion ? 0 : Math.round(Math.min(6, speed * 0.35) / 2) * 2;
      if (blur !== lastBlur) {
        strip.style.setProperty("--reel-blur", `${blur}px`);
        lastBlur = blur;
      }

      // Roulette tick each time a new portrait crosses the window (your card only,
      // so two reels don't double up).
      if (sound) {
        const cell = Math.round(pos);
        if (cell !== lastCell && now - lastTickAt >= TICK_MIN_GAP_MS) {
          playReelTick();
          lastTickAt = now;
        }
        lastCell = cell;
      }

      if (maxProgress < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [items, sound]);

  return (
    <div className="slot-reel" aria-hidden="true">
      <div
        ref={stripRef}
        className="slot-reel__strip"
        style={{
          height: `${items.length * 100}%`,
          transform: `translate3d(0, ${(-(items.length - 1) / items.length) * 100}%, 0)`,
        }}
      >
        {items.map((c, i) => (
          <div
            className="slot-reel__cell"
            key={`${c.id}-${i}`}
            style={{ height: `${100 / items.length}%` }}
          >
            <Portrait character={c} showName={false} className="roll-card__portrait" />
          </div>
        ))}
      </div>
    </div>
  );
}
