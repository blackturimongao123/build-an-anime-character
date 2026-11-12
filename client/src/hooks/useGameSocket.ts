import { useCallback, useEffect, useRef, useState } from "react";
import type { BotDifficulty, Category, MatchState, PlayerSide } from "@build-character/shared";
import type { ClientMessage, ServerMessage } from "@build-character/shared";
import { getWsUrl } from "../config";

export function useGameSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [yourSide, setYourSide] = useState<PlayerSide>("p1");
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return wsRef.current;
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("Connection failed");
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === "error") setError(msg.message);
      if (msg.type === "roomCreated") {
        setRoomCode(msg.roomCode);
        setYourSide(msg.side);
      }
      if (msg.type === "joined") {
        setRoomCode(msg.roomCode);
        setYourSide(msg.side);
      }
      if (msg.type === "state") {
        setMatchState(msg.state);
        setYourSide(msg.yourSide);
      }
      if (msg.type === "playerLeft") setError("Opponent left the room");
    };
    return ws;
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const createRoom = (playerName: string, vsBot: boolean, botDifficulty: BotDifficulty) => {
    setError(null);
    connect();
    const trySend = () => send({ type: "createRoom", playerName, vsBot, botDifficulty });
    if (wsRef.current?.readyState === WebSocket.OPEN) trySend();
    else wsRef.current!.onopen = trySend;
  };

  const joinRoom = (code: string, playerName: string) => {
    setError(null);
    connect();
    const trySend = () => send({ type: "joinRoom", roomCode: code, playerName });
    if (wsRef.current?.readyState === WebSocket.OPEN) trySend();
    else wsRef.current!.onopen = trySend;
  };

  const selectSlot = (category: Category) => {
    send({ type: "selectSlot", category });
  };

  const rematch = () => send({ type: "rematch" });
  const leave = () => {
    send({ type: "leave" });
    wsRef.current?.close();
    setMatchState(null);
    setRoomCode(null);
  };

  return {
    connected,
    roomCode,
    yourSide,
    matchState,
    error,
    createRoom,
    joinRoom,
    selectSlot,
    rematch,
    leave,
  };
}
