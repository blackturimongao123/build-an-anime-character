export const CATEGORIES = [
  "strength",
  "speed",
  "abilities",
  "iq",
  "durability",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  strength: "Strength",
  speed: "Speed",
  abilities: "Abilities",
  iq: "IQ",
  durability: "Durability",
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  strength: "💪",
  speed: "💨",
  abilities: "⚡",
  iq: "🧠",
  durability: "🛡️",
};

export type CharacterStats = Record<Category, number>;

export interface Character {
  id: string;
  displayName: string;
  series: string;
  stats: CharacterStats;
  sources?: {
    wikiPage?: string;
    wikiUrl?: string;
    wikiFragment?: string;
    wikiStatKey?: string;
  };
  portrait: string;
}

export type BotDifficulty = "easy" | "medium" | "hard";

export type PlayerSide = "p1" | "p2";

export interface SlotAssignment {
  characterId: string;
  category: Category;
}

export interface PlayerBoard {
  slots: Partial<Record<Category, Character>>;
}

export interface DraftState {
  round: number;
  maxRounds: number;
  rollP1: Character | null;
  rollP2: Character | null;
  lockedP1: Category | null;
  lockedP2: Category | null;
  boardP1: PlayerBoard;
  boardP2: PlayerBoard;
  usedCharacterIds: string[];
  timerSeconds: number;
}

export type GamePhase = "lobby" | "draft" | "animating" | "showdown" | "results";

export interface ShowdownBeat {
  category: Category;
  winner: PlayerSide;
  p1Score: number;
  p2Score: number;
  p1Eliminated: boolean;
  p2Eliminated: boolean;
  runningAvgP1: number;
  runningAvgP2: number;
}

export interface MatchState {
  phase: GamePhase;
  roomCode: string;
  p1Name: string;
  p2Name: string;
  isBot: boolean;
  botDifficulty: BotDifficulty;
  draft: DraftState;
  showdownIndex: number;
  showdownBeats: ShowdownBeat[];
  winner: PlayerSide | "tie" | null;
}
