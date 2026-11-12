import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { RoomManager } from "./roomManager.js";
import { loadCharacterPool } from "./characters.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8081;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

loadCharacterPool();

const roomManager = new RoomManager();

/** @type {Map<import('ws').WebSocket, { side: 'p1' | 'p2', roomCode: string, playerName: string }>} */
const socketMeta = new Map();

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * While a draft round is open, each player only sees their own pick.
 * The opponent's locked category (and the character placed there this round)
 * is hidden until both have locked and the phase moves to "animating".
 */
function stateForSide(state, side) {
  if (state.phase !== "draft") return state;
  const opp = side === "p1" ? "P2" : "P1";
  const lockKey = `locked${opp}`;
  const boardKey = `board${opp}`;
  const hiddenCategory = state.draft[lockKey];
  if (!hiddenCategory) return state;
  const slots = { ...state.draft[boardKey].slots };
  delete slots[hiddenCategory];
  return {
    ...state,
    draft: {
      ...state.draft,
      [lockKey]: null,
      [boardKey]: { ...state.draft[boardKey], slots },
    },
  };
}

function broadcastRoom(room) {
  const state = room.state;
  for (const side of ["p1", "p2"]) {
    const ws = room.connections[side];
    if (ws && ws.readyState === ws.OPEN) {
      send(ws, { type: "state", state: stateForSide(state, side), yourSide: side });
    }
  }
}

function setupRoomBroadcast(room) {
  room.onBroadcast = () => broadcastRoom(room);
}

const server = createServer((req, res) => {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin) || !origin) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: roomManager.rooms.size }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Build an Anime Character WebSocket server");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.length > 0 && origin && !ALLOWED_ORIGINS.includes(origin)) {
    ws.close(4003, "Origin not allowed");
    return;
  }

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    if (msg.type === "createRoom") {
      const name = (msg.playerName || "Player").slice(0, 20);
      const vsBot = !!msg.vsBot;
      const botDifficulty = msg.botDifficulty || "easy";
      const room = roomManager.create(name, vsBot, botDifficulty);
      setupRoomBroadcast(room);
      ws.playerName = name;
      room.attach("p1", ws, () => broadcastRoom(room));
      socketMeta.set(ws, { side: "p1", roomCode: room.code, playerName: name });
      send(ws, { type: "roomCreated", roomCode: room.code, side: "p1" });
      if (vsBot) {
        room.startMatch();
      } else {
        room.state = { ...room.state, phase: "lobby" };
        broadcastRoom(room);
      }
      return;
    }

    if (msg.type === "joinRoom") {
      const code = (msg.roomCode || "").toUpperCase();
      const room = roomManager.get(code);
      if (!room) {
        send(ws, { type: "error", message: "Room not found" });
        return;
      }
      if (!room.canJoin()) {
        send(ws, { type: "error", message: "Room is full" });
        return;
      }
      const name = (msg.playerName || "Player 2").slice(0, 20);
      ws.playerName = name;
      room.attach("p2", ws, () => broadcastRoom(room));
      socketMeta.set(ws, { side: "p2", roomCode: code, playerName: name });
      send(ws, { type: "joined", roomCode: code, side: "p2" });
      if (room.connections.p1 && room.state.phase === "lobby") {
        room.startMatch();
      } else {
        broadcastRoom(room);
      }
      return;
    }

    const meta = socketMeta.get(ws);
    if (!meta) {
      send(ws, { type: "error", message: "Not in a room" });
      return;
    }

    const room = roomManager.get(meta.roomCode);
    if (!room) {
      send(ws, { type: "error", message: "Room expired" });
      return;
    }

    if (msg.type === "selectSlot") {
      room.selectSlot(meta.side, msg.category);
      return;
    }

    if (msg.type === "rematch") {
      room.rematch();
      return;
    }

    if (msg.type === "leave") {
      room.detach(meta.side);
      socketMeta.delete(ws);
      if (!room.connections.p1 && !room.connections.p2) {
        roomManager.remove(room.code);
      } else {
        const other = room.connections.p1 || room.connections.p2;
        if (other) send(other, { type: "playerLeft" });
      }
      return;
    }
  });

  ws.on("close", () => {
    const meta = socketMeta.get(ws);
    if (!meta) return;
    const room = roomManager.get(meta.roomCode);
    if (room) {
      room.detach(meta.side);
      if (!room.connections.p1 && !room.connections.p2) {
        roomManager.remove(room.code);
      } else {
        const other = room.connections.p1 || room.connections.p2;
        if (other) send(other, { type: "playerLeft" });
      }
    }
    socketMeta.delete(ws);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other server or set PORT to a free port.`,
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`WebSocket server on http://127.0.0.1:${PORT} (WebSocket upgrade)`);
});
