import {
  CATEGORIES,
  type Category,
  type Character,
  type DraftState,
  type PlayerBoard,
  type PlayerSide,
  type ShowdownBeat,
  type BotDifficulty,
} from "./types.js";

export const MAX_ROUNDS = 5;
export const DRAFT_TIMER_SECONDS = 15;

export function emptyBoard(): PlayerBoard {
  return { slots: {} };
}

export function createInitialDraft(usedIds: string[] = []): DraftState {
  return {
    round: 1,
    maxRounds: MAX_ROUNDS,
    rollP1: null,
    rollP2: null,
    lockedP1: null,
    lockedP2: null,
    boardP1: emptyBoard(),
    boardP2: emptyBoard(),
    usedCharacterIds: [...usedIds],
    timerSeconds: DRAFT_TIMER_SECONDS,
  };
}

export function availableCategories(board: PlayerBoard): Category[] {
  return CATEGORIES.filter((c) => !board.slots[c]);
}

export function rollCharacter(
  pool: Character[],
  usedIds: string[],
): Character | null {
  const available = pool.filter((c) => !usedIds.includes(c.id));
  if (available.length === 0) return null;
  const idx = Math.floor(Math.random() * available.length);
  return available[idx]!;
}

export function statForCategory(character: Character, category: Category): number {
  return character.stats[category];
}

/**
 * Average after the first `revealed` showdown fights: the total of every revealed
 * score divided by the full category count (5). Knockouts don't affect it, so it
 * only climbs as each fight is shown and ends at total / 5.
 */
export function runningAverage(board: PlayerBoard, revealed: number = CATEGORIES.length): number {
  let total = 0;
  for (const cat of CATEGORIES.slice(0, revealed)) {
    const ch = board.slots[cat];
    if (ch) total += statForCategory(ch, cat);
  }
  return Math.round((total / CATEGORIES.length) * 10) / 10;
}

export function computeShowdownBeats(
  boardP1: PlayerBoard,
  boardP2: PlayerBoard,
): ShowdownBeat[] {
  const beats: ShowdownBeat[] = [];

  for (const [index, category] of CATEGORIES.entries()) {
    const c1 = boardP1.slots[category];
    const c2 = boardP2.slots[category];
    const p1Score = c1 ? statForCategory(c1, category) : 0;
    const p2Score = c2 ? statForCategory(c2, category) : 0;

    let winner: PlayerSide;
    let p1Elim = false;
    let p2Elim = false;

    // Knockouts are visual only; they don't change the average.
    if (p1Score > p2Score) {
      winner = "p1";
      p2Elim = true;
    } else if (p2Score > p1Score) {
      winner = "p2";
      p1Elim = true;
    } else {
      winner = "p1";
      p1Elim = true;
      p2Elim = true;
    }

    beats.push({
      category,
      winner,
      p1Score,
      p2Score,
      p1Eliminated: p1Elim,
      p2Eliminated: p2Elim,
      runningAvgP1: runningAverage(boardP1, index + 1),
      runningAvgP2: runningAverage(boardP2, index + 1),
    });
  }

  return beats;
}

export function finalWinner(beats: ShowdownBeat[]): PlayerSide | "tie" {
  if (beats.length === 0) return "tie";
  const last = beats[beats.length - 1]!;
  if (last.runningAvgP1 > last.runningAvgP2) return "p1";
  if (last.runningAvgP2 > last.runningAvgP1) return "p2";
  return "tie";
}

export function pickBotCategory(
  difficulty: BotDifficulty,
  board: PlayerBoard,
  character: Character,
  opponentBoard: PlayerBoard,
): Category | null {
  const available = availableCategories(board);
  if (available.length === 0) return null;

  if (difficulty === "easy") {
    return available[Math.floor(Math.random() * available.length)]!;
  }

  if (difficulty === "medium") {
    let best: Category = available[0]!;
    let bestVal = -1;
    for (const cat of available) {
      const v = statForCategory(character, cat);
      if (v > bestVal) {
        bestVal = v;
        best = cat;
      }
    }
    return best;
  }

  // hard: maximize expected category win vs opponent's placed stats
  let best: Category = available[0]!;
  let bestVal = -Infinity;
  for (const cat of available) {
    const myStat = statForCategory(character, cat);
    const opp = opponentBoard.slots[cat];
    const oppStat = opp ? statForCategory(opp, cat) : 50;
    const margin = myStat - oppStat;
    const futureBonus =
      available.length > 1
        ? Math.max(
            ...available
              .filter((c) => c !== cat)
              .map((c) => statForCategory(character, c)),
          )
        : 0;
    const score = margin * 2 + futureBonus * 0.1;
    if (score > bestVal) {
      bestVal = score;
      best = cat;
    }
  }
  return best;
}

export function applyLock(
  draft: DraftState,
  side: PlayerSide,
  category: Category,
  pool: Character[],
): DraftState {
  const boardKey = side === "p1" ? "boardP1" : "boardP2";
  const lockKey = side === "p1" ? "lockedP1" : "lockedP2";
  const roll = side === "p1" ? draft.rollP1 : draft.rollP2;

  if (!roll || draft[lockKey]) return draft;
  if (draft[boardKey].slots[category]) return draft;

  const nextBoard = {
    ...draft[boardKey],
    slots: { ...draft[boardKey].slots, [category]: roll },
  };

  return {
    ...draft,
    [boardKey]: nextBoard,
    [lockKey]: category,
    usedCharacterIds: draft.usedCharacterIds.includes(roll.id)
      ? draft.usedCharacterIds
      : [...draft.usedCharacterIds, roll.id],
  };
}

export function bothLocked(draft: DraftState): boolean {
  return draft.lockedP1 !== null && draft.lockedP2 !== null;
}

export function advanceRound(draft: DraftState): DraftState {
  return {
    ...createInitialDraft(draft.usedCharacterIds),
    round: draft.round + 1,
    boardP1: draft.boardP1,
    boardP2: draft.boardP2,
    usedCharacterIds: draft.usedCharacterIds,
  };
}

export function draftComplete(draft: DraftState): boolean {
  return (
    draft.round >= draft.maxRounds &&
    bothLocked(draft) &&
    CATEGORIES.every((c) => draft.boardP1.slots[c] && draft.boardP2.slots[c])
  );
}
