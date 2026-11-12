import {
  applyLock,
  advanceRound,
  bothLocked,
  computeShowdownBeats,
  createInitialDraft,
  draftComplete,
  finalWinner,
  pickBotCategory,
  rollCharacter,
  DRAFT_TIMER_SECONDS,
} from "@build-character/shared";
import { getPool } from "./characters.js";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function defaultMatchState(roomCode, p1Name, p2Name, isBot, botDifficulty) {
  return {
    phase: "lobby",
    roomCode,
    p1Name,
    p2Name,
    isBot,
    botDifficulty,
    draft: createInitialDraft(),
    showdownIndex: -1,
    showdownBeats: [],
    winner: null,
  };
}

export class Room {
  constructor(hostName, vsBot, botDifficulty) {
    this.code = randomCode();
    this.connections = { p1: null, p2: null };
    this.state = defaultMatchState(
      this.code,
      hostName,
      vsBot ? "BOT" : "Waiting for opponent...",
      !!vsBot,
      botDifficulty,
    );
    this.timer = null;
    this.animationTimer = null;
    this.showdownTimer = null;
    this.onBroadcast = null;
  }

  attach(side, ws, onBroadcast) {
    this.connections[side] = ws;
    this.onBroadcast = onBroadcast;
    if (side === "p2" && !this.state.isBot) {
      const name = ws.playerName || "Player 2";
      this.state = { ...this.state, p2Name: name };
    }
  }

  detach(side) {
    this.connections[side] = null;
    this.clearTimers();
  }

  clearTimers() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
    if (this.showdownTimer) {
      clearInterval(this.showdownTimer);
      this.showdownTimer = null;
    }
  }

  startMatch() {
    this.state = {
      ...this.state,
      phase: "draft",
      draft: this.startNewRolls(createInitialDraft()),
    };
    this.startDraftTimer();
    this.broadcast();
  }

  startNewRolls(draft) {
    const pool = getPool();
    const rollP1 = rollCharacter(pool, draft.usedCharacterIds);
    const used = rollP1 ? [...draft.usedCharacterIds, rollP1.id] : draft.usedCharacterIds;
    const rollP2 = rollCharacter(pool, used);
    return {
      ...draft,
      rollP1,
      rollP2,
      lockedP1: null,
      lockedP2: null,
      timerSeconds: DRAFT_TIMER_SECONDS,
    };
  }

  startDraftTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.state.phase !== "draft") return;
      const t = this.state.draft.timerSeconds - 1;
      if (t <= 0) {
        this.autoLockTimeout();
        return;
      }
      this.state = {
        ...this.state,
        draft: { ...this.state.draft, timerSeconds: t },
      };
      this.broadcast();
    }, 1000);
  }

  autoLockTimeout() {
    const pool = getPool();
    const draft = this.state.draft;
    let next = { ...draft };

    if (!next.lockedP1 && next.rollP1) {
      const cats = ["strength", "speed", "abilities", "iq", "durability"].filter(
        (c) => !next.boardP1.slots[c],
      );
      if (cats.length) {
        const cat = cats[Math.floor(Math.random() * cats.length)];
        next = applyLock(next, "p1", cat, pool);
      }
    }

    if (!next.lockedP2 && next.rollP2) {
      if (this.state.isBot) {
        const cat = pickBotCategory(
          this.state.botDifficulty,
          next.boardP2,
          next.rollP2,
          next.boardP1,
        );
        if (cat) next = applyLock(next, "p2", cat, pool);
      } else {
        const cats = ["strength", "speed", "abilities", "iq", "durability"].filter(
          (c) => !next.boardP2.slots[c],
        );
        if (cats.length) {
          const cat = cats[Math.floor(Math.random() * cats.length)];
          next = applyLock(next, "p2", cat, pool);
        }
      }
    }

    this.state = { ...this.state, draft: next };
    if (bothLocked(next)) {
      this.afterBothLocked();
    } else {
      this.broadcast();
    }
  }

  selectSlot(side, category) {
    if (this.state.phase !== "draft") return;
    const pool = getPool();
    const lockKey = side === "p1" ? "lockedP1" : "lockedP2";
    if (this.state.draft[lockKey]) return;

    const next = applyLock(this.state.draft, side, category, pool);
    this.state = { ...this.state, draft: next };

    if (this.state.isBot && side === "p1" && !next.lockedP2 && next.rollP2) {
      setTimeout(() => this.botPick(next), 400 + Math.random() * 800);
    }

    if (bothLocked(next)) {
      this.afterBothLocked();
    } else {
      this.broadcast();
    }
  }

  botPick(draftState) {
    if (this.state.phase !== "draft" || this.state.draft.lockedP2) return;
    const pool = getPool();
    const roll = draftState.rollP2;
    if (!roll) return;
    const cat = pickBotCategory(
      this.state.botDifficulty,
      draftState.boardP2,
      roll,
      draftState.boardP1,
    );
    if (!cat) return;
    const next = applyLock(draftState, "p2", cat, pool);
    this.state = { ...this.state, draft: next };
    if (bothLocked(next)) {
      this.afterBothLocked();
    } else {
      this.broadcast();
    }
  }

  afterBothLocked() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Both players have picked: the round timer ends here and both picks are revealed.
    this.state = {
      ...this.state,
      phase: "animating",
      draft: { ...this.state.draft, timerSeconds: 0 },
    };
    this.broadcast();

    this.animationTimer = setTimeout(() => {
      const draft = this.state.draft;
      if (draftComplete(draft)) {
        this.beginShowdown(draft);
      } else {
        const nextDraft = this.startNewRolls(advanceRound(draft));
        this.state = {
          ...this.state,
          phase: "draft",
          draft: nextDraft,
        };
        this.startDraftTimer();
        this.broadcast();
      }
    }, 1200);
  }

  beginShowdown(draft) {
    const beats = computeShowdownBeats(draft.boardP1, draft.boardP2);
    this.state = {
      ...this.state,
      phase: "showdown",
      showdownBeats: beats,
      showdownIndex: -1,
    };
    this.broadcast();
    this.advanceShowdownStep();
  }

  advanceShowdownStep() {
    const nextIndex = this.state.showdownIndex + 1;
    if (nextIndex >= this.state.showdownBeats.length) {
      this.finishMatch();
      return;
    }
    this.state = { ...this.state, showdownIndex: nextIndex };
    this.broadcast();

    this.showdownTimer = setTimeout(() => {
      this.advanceShowdownStep();
    }, 2200);
  }

  finishMatch() {
    const winner = finalWinner(this.state.showdownBeats);
    this.state = {
      ...this.state,
      phase: "results",
      winner,
    };
    this.broadcast();
  }

  rematch() {
    this.clearTimers();
    this.state = defaultMatchState(
      this.code,
      this.state.p1Name,
      this.state.isBot ? "BOT" : this.state.p2Name,
      this.state.isBot,
      this.state.botDifficulty,
    );
    this.startMatch();
  }

  broadcast() {
    if (this.onBroadcast) this.onBroadcast(this);
  }

  isFull() {
    if (this.state.isBot) return this.connections.p1 !== null;
    return this.connections.p1 && this.connections.p2;
  }

  canJoin() {
    return !this.connections.p2 && !this.state.isBot;
  }
}

export class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  create(hostName, vsBot, botDifficulty) {
    const room = new Room(hostName, vsBot, botDifficulty);
    this.rooms.set(room.code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(code.toUpperCase());
  }

  remove(code) {
    const room = this.rooms.get(code);
    if (room) {
      room.clearTimers();
      this.rooms.delete(code);
    }
  }
}
