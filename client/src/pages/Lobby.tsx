import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BotDifficulty } from "@build-character/shared";
import { useGameSocketContext } from "../context/GameSocketContext";

export default function Lobby() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, error } = useGameSocketContext();
  const [name, setName] = useState("Player");
  const [joinCode, setJoinCode] = useState("");
  const [vsBot, setVsBot] = useState(true);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("easy");

  const handleCreate = () => {
    createRoom(name, vsBot, difficulty);
    navigate("/room");
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    joinRoom(joinCode.trim().toUpperCase(), name);
    navigate(`/room/${joinCode.trim().toUpperCase()}`);
  };

  return (
    <div className="lobby">
      <div className="lobby__backdrop" />
      <div className="lobby__card">
        <p className="eyebrow">DEFAULT MODE</p>
        <h1>BUILD AN ANIME CHARACTER</h1>
        <label className="field">
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
        </label>

        <div className="lobby__modes">
          <label className="toggle">
            <input type="checkbox" checked={vsBot} onChange={(e) => setVsBot(e.target.checked)} />
            Play vs BOT
          </label>
          {vsBot && (
            <label className="field">
              <span>BOT difficulty</span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as BotDifficulty)}
              >
                <option value="easy">Easy (random)</option>
                <option value="medium">Medium (smart pick)</option>
                <option value="hard">Hard (strategic)</option>
              </select>
            </label>
          )}
        </div>

        <button type="button" className="btn btn--primary" onClick={handleCreate}>
          Create room
        </button>

        <div className="lobby__divider">or join friend</div>

        <div className="lobby__join">
          <input
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button type="button" className="btn" onClick={handleJoin}>
            Join
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
