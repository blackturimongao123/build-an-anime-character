import { useCallback, useEffect, useRef, useState } from "react";
import {
  CATEGORIES,
  type Category,
  type Character,
  type MatchState,
  type PlayerSide,
} from "@build-character/shared";
import { PlayerAvatar, Versus } from "./ArenaUI";
import { CategoryRow } from "./CategoryRow";
import { FlyingPortrait } from "./FlyingPortrait";
import { RollSlotCard } from "./RollSlotCard";
import { useRollReveal } from "../hooks/useRollReveal";

type Side = "you" | "opp";

interface Flight {
  key: string;
  side: Side;
  category: Category;
  character: Character;
}

/** Find the square (thumb or "+") inside a category row. */
function slotIn(row: HTMLElement | null | undefined) {
  return row?.querySelector<HTMLElement>(".category-row__thumb, .slot-plus") ?? null;
}

export default function DraftScreen({ state, yourSide, onSelect, roomCode }: {
  state: MatchState;
  yourSide: PlayerSide;
  onSelect: (category: Category) => void;
  roomCode?: string | null;
}) {
  const { draft } = state;
  const first = yourSide === "p1";
  const animating = state.phase === "animating";
  const youLocked = first ? draft.lockedP1 : draft.lockedP2;
  // The server hides this until both players have picked (phase "animating").
  const oppLocked = first ? draft.lockedP2 : draft.lockedP1;
  const rollYou = first ? draft.rollP1 : draft.rollP2;
  const rollOpp = first ? draft.rollP2 : draft.rollP1;
  const boardYou = first ? draft.boardP1 : draft.boardP2;
  const boardOpp = first ? draft.boardP2 : draft.boardP1;
  const youName = first ? state.p1Name : state.p2Name;
  const oppName = first ? state.p2Name : state.p1Name;

  const revealYou = useRollReveal(rollYou, draft.usedCharacterIds);
  const revealOpp = useRollReveal(rollOpp, draft.usedCharacterIds);

  const youCardRef = useRef<HTMLDivElement>(null);
  const oppCardRef = useRef<HTMLDivElement>(null);
  const youRows = useRef<Partial<Record<Category, HTMLDivElement | null>>>({});
  const oppRows = useRef<Partial<Record<Category, HTMLDivElement | null>>>({});

  // Keys are per round + rolled character, so a rematch never collides.
  const youKey = rollYou ? `${draft.round}-${rollYou.id}-you` : null;
  const oppKey = rollOpp ? `${draft.round}-${rollOpp.id}-opp` : null;

  const [flights, setFlights] = useState<Flight[]>([]);
  const [launched, setLaunched] = useState<string[]>([]);
  const launchedRef = useRef(new Set<string>());
  // Your pick, shown instantly before the server confirms it.
  const [pending, setPending] = useState<{ key: string; category: Category; character: Character } | null>(null);

  const launch = useCallback((flight: Flight) => {
    if (launchedRef.current.has(flight.key)) return;
    launchedRef.current.add(flight.key);
    setLaunched((l) => [...l, flight.key]);
    setFlights((f) => [...f, flight]);
  }, []);

  const land = useCallback((key: string) => {
    setFlights((f) => f.filter((x) => x.key !== key));
  }, []);

  // Server-confirmed lock we didn't start ourselves (e.g. auto-pick on timeout).
  useEffect(() => {
    if (youKey && youLocked && rollYou) {
      launch({ key: youKey, side: "you", category: youLocked, character: rollYou });
    }
  }, [youKey, youLocked, rollYou, launch]);

  // Opponent's pick only arrives once both have locked: fly it in then.
  useEffect(() => {
    if (oppKey && oppLocked && rollOpp) {
      launch({ key: oppKey, side: "opp", category: oppLocked, character: rollOpp });
    }
  }, [oppKey, oppLocked, rollOpp, launch]);

  const pendingNow = pending && pending.key === youKey ? pending : null;
  const youPicked = !!youLocked || !!pendingNow;
  const canPick = !animating && !youPicked && !!rollYou && revealYou.revealed;

  const pick = (category: Category) => {
    if (!canPick || !rollYou || !youKey) return;
    setPending({ key: youKey, category, character: rollYou });
    launch({ key: youKey, side: "you", category, character: rollYou });
    onSelect(category);
  };

  const youSlots: Partial<Record<Category, Character>> = { ...boardYou.slots };
  if (pendingNow && !youSlots[pendingNow.category]) {
    youSlots[pendingNow.category] = pendingNow.character;
  }
  const flyingInto = (side: Side, category: Category) =>
    flights.some((f) => f.side === side && f.category === category);

  const status = animating
    ? "LOCKED!"
    : youPicked
      ? "WAITING FOR OPPONENT…"
      : revealYou.spinning || revealOpp.spinning
        ? "ROLLING…"
        : "CHOOSE A CATEGORY…";

  return (
    <main className="game game--draft">
      <header className="game__header">
        <p className="eyebrow">DEFAULT MODE</p>
        <h1>BUILD AN ANIME CHARACTER</h1>
        <p className="game__timer" aria-label={`${draft.timerSeconds} seconds remaining`}>{draft.timerSeconds}</p>
        {roomCode && !state.isBot && <p className="game__room">Room {roomCode}</p>}
      </header>

      <div className="draft-arena">
        <div className="draft-player draft-player--you"><PlayerAvatar name={youName} color="blue" /></div>
        <div className="draft-player draft-player--opp"><PlayerAvatar name={oppName} color="red" bot={state.isBot && first} /></div>

        <section className="draft-board draft-board--you" aria-label="Your draft board">
          {CATEGORIES.map((category) => {
            const assigned = youSlots[category];
            return (
              <CategoryRow key={category} category={category} assigned={assigned}
                onPick={canPick && !assigned ? () => pick(category) : undefined}
                prompt={canPick ? "Please Select…" : undefined}
                highlight={(youLocked ?? pendingNow?.category) === category}
                hidePortrait={flyingInto("you", category)}
                rowRef={(el) => { youRows.current[category] = el; }} />
            );
          })}
        </section>

        <div className="draft-roll">
          <RollSlotCard ref={youCardRef} side="you"
            character={revealYou.displayCharacter}
            spinning={revealYou.spinning}
            revealed={revealYou.revealed}
            flownAway={!!youKey && launched.includes(youKey)}
            locked={youPicked} />
          <Versus />
          <RollSlotCard ref={oppCardRef} side="opp"
            character={revealOpp.displayCharacter}
            spinning={revealOpp.spinning}
            revealed={revealOpp.revealed}
            flownAway={!!oppKey && launched.includes(oppKey)}
            locked={!!oppLocked} />
        </div>

        <section className="draft-board draft-board--opp" aria-label="Opponent draft board">
          {CATEGORIES.map((category) => (
            <CategoryRow key={category} category={category} assigned={boardOpp.slots[category]}
              align="right" highlight={oppLocked === category}
              hidePortrait={flyingInto("opp", category)}
              rowRef={(el) => { oppRows.current[category] = el; }} />
          ))}
        </section>
      </div>

      {flights.map((f) => (
        <FlyingPortrait key={f.key} character={f.character}
          getFrom={() => (f.side === "you" ? youCardRef : oppCardRef).current}
          getTo={() => slotIn((f.side === "you" ? youRows : oppRows).current[f.category])}
          onDone={() => land(f.key)} />
      ))}

      <footer className="draft-status" aria-live="polite">
        <strong>{status}</strong>
        <span>Round {draft.round} / {draft.maxRounds}</span>
      </footer>
    </main>
  );
}
