import { createContext, useContext, type ReactNode } from "react";
import { useGameSocket } from "../hooks/useGameSocket";

type GameSocketValue = ReturnType<typeof useGameSocket>;

const GameSocketContext = createContext<GameSocketValue | null>(null);

export function GameSocketProvider({ children }: { children: ReactNode }) {
  const value = useGameSocket();
  return <GameSocketContext.Provider value={value}>{children}</GameSocketContext.Provider>;
}

export function useGameSocketContext() {
  const ctx = useContext(GameSocketContext);
  if (!ctx) throw new Error("GameSocketProvider required");
  return ctx;
}
