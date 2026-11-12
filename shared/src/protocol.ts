import type {
  BotDifficulty,
  Category,
  MatchState,
  PlayerSide,
} from "./types.js";

export type ClientMessage =
  | { type: "createRoom"; playerName: string; vsBot?: boolean; botDifficulty?: BotDifficulty }
  | { type: "joinRoom"; roomCode: string; playerName: string }
  | { type: "selectSlot"; category: Category }
  | { type: "ready" }
  | { type: "rematch" }
  | { type: "leave" };

export type ServerMessage =
  | { type: "error"; message: string }
  | { type: "roomCreated"; roomCode: string; side: PlayerSide }
  | { type: "joined"; roomCode: string; side: PlayerSide }
  | { type: "state"; state: MatchState; yourSide: PlayerSide }
  | { type: "playerLeft" };
