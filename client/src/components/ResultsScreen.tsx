import { useState } from "react";
import { CATEGORIES, type MatchState, type PlayerSide } from "@build-character/shared";
import { AverageScore, PlayerAvatar } from "./ArenaUI";
import { CategoryRow } from "./CategoryRow";
import { RadarChart } from "./RadarChart";

export default function ResultsScreen({ state, yourSide, onRematch, onLeave }: {
  state: MatchState;
  yourSide: PlayerSide;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const tied = state.winner === "tie";
  const [flipped, setFlipped] = useState(false);
  const featuredSide = tied ? yourSide : state.winner ?? yourSide;
  const side = flipped ? featuredSide === "p1" ? "p2" : "p1" : featuredSide;
  const featuredName = featuredSide === "p1" ? state.p1Name : state.p2Name;
  const first = side === "p1";
  const name = first ? state.p1Name : state.p2Name;
  const color = side === yourSide ? "blue" : "red";
  const board = first ? state.draft.boardP1 : state.draft.boardP2;
  const finalBeat = state.showdownBeats.at(-1);
  const average = (first ? finalBeat?.runningAvgP1 : finalBeat?.runningAvgP2) ?? 0;

  return (
    <main className="game game--results">
      <header className="game__header winner-banner">
        <p className="winner-banner__label">{tied ? "TIE" : "WINNER"}</p>
        <h1>{tied ? `${state.p1Name} & ${state.p2Name}` : featuredName}</h1>
      </header>
      <div className="results-layout">
        <section className="results-stats" aria-label={`${name}'s stats`}>
          {CATEGORIES.map((category) => (
            <CategoryRow key={category} category={category} assigned={board.slots[category]}
              score={board.slots[category]?.stats[category]} />
          ))}
        </section>
        <div className={`results-center${flipped ? " results-center--flipped" : ""}`}>
          {!tied && !flipped && <span className="winner-crown" aria-hidden="true">👑</span>}
          <PlayerAvatar name={name} color={color} bot={state.isBot && !first} />
          <AverageScore value={average} color={color} />
          <button type="button" className="btn results-flip" aria-pressed={flipped}
            aria-label="Flip player board" onClick={() => setFlipped(!flipped)}>FLIP</button>
        </div>
        <RadarChart board={board} />
      </div>
      <div className="results-actions">
        <button type="button" className="btn btn--primary" onClick={onRematch}>REMATCH</button>
        <button type="button" className="btn btn--danger" onClick={onLeave}>LEAVE</button>
      </div>
    </main>
  );
}

