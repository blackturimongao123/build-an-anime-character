import { useEffect } from "react";
import { CATEGORIES, type MatchState, type PlayerSide } from "@build-character/shared";
import { AverageScore, PlayerAvatar, Versus } from "./ArenaUI";
import { CategoryRow } from "./CategoryRow";
import { playPunch } from "../audio/sfx";
import "./ShowdownClash.css";

/** Contact point of the 0.55s clash animation (see ShowdownClash.css). */
const CLASH_CONTACT_MS = 210;
/** First clash waits for the boards to slide together (desktop, motion allowed). */
const INTRO_DELAY_MS = 620;

export default function ShowdownScreen({ state, yourSide }: {
  state: MatchState;
  yourSide: PlayerSide;
}) {
  const index = state.showdownIndex;
  const beat = state.showdownBeats[index];
  const sides: PlayerSide[] = [yourSide, yourSide === "p1" ? "p2" : "p1"];
  // The average starts climbing when the punch lands.
  const clashDelay =
    (index <= 0 && typeof window !== "undefined" &&
      window.matchMedia("(min-width: 681px) and (prefers-reduced-motion: no-preference)").matches
      ? INTRO_DELAY_MS
      : 0) + CLASH_CONTACT_MS;

  // Punch sound on contact: one heavy hit for a knockout, two quick hits for a tie.
  const beatKey = beat ? `${index}-${beat.category}` : null;
  useEffect(() => {
    if (!beat) return;
    const introDelay =
      index <= 0 && window.matchMedia("(min-width: 681px) and (prefers-reduced-motion: no-preference)").matches
        ? INTRO_DELAY_MS
        : 0;
    const tie = beat.p1Score === beat.p2Score;
    const at = introDelay + CLASH_CONTACT_MS;
    const timers = [setTimeout(() => playPunch(!tie), at)];
    if (tie) timers.push(setTimeout(() => playPunch(false), at + 70));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per clash
  }, [beatKey]);

  return (
    <main className={`game game--showdown${beat ? " game--clashing" : ""}${index <= 0 ? " game--showdown-intro" : ""}`}>
      <header className="game__header">
        <h1>SHOWDOWN</h1>
      </header>
      <div className="showdown-arena">
        {index <= 0 && <Versus />}
        {sides.map((side, position) => {
          const first = side === "p1";
          const left = position === 0;
          const color = left ? "blue" : "red";
          const name = first ? state.p1Name : state.p2Name;
          const board = first ? state.draft.boardP1 : state.draft.boardP2;
          const average = (first ? beat?.runningAvgP1 : beat?.runningAvgP2) ?? 0;
          return (
            <section className={`showdown-col showdown-col--${color}`} key={side} aria-label={`${name}'s board`}>
              <PlayerAvatar name={name} color={color} bot={state.isBot && !first} />
              <div className="showdown-stats">
                {CATEGORIES.map((category) => {
                  const active = beat?.category === category;
                  const previous = state.showdownBeats.slice(0, index).find((item) => item.category === category);
                  const eliminated = first ? previous?.p1Eliminated : previous?.p2Eliminated;
                  // Ties knock nobody off: both stay on the board (dimmed, out of scoring).
                  const previousTie = !!previous && previous.p1Score === previous.p2Score;
                  const clash = active
                    ? beat.p1Score === beat.p2Score
                      ? "tie"
                      : (first ? beat.p1Eliminated : beat.p2Eliminated) ? "lose" : "win"
                    : undefined;
                  return (
                    <CategoryRow key={active ? `${category}-clash` : category} category={category} assigned={board.slots[category]}
                      align={left ? "left" : "right"} eliminated={eliminated && !previousTie} dimmed={eliminated && previousTie}
                      highlight={active} impact={active && left} clash={clash}
                      score={active ? first ? beat.p1Score : beat.p2Score : undefined} />
                  );
                })}
              </div>
              <AverageScore color={color} value={average} animate delayMs={clashDelay} />
            </section>
          );
        })}
      </div>
    </main>
  );
}


