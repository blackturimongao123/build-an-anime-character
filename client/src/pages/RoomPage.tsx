import { useNavigate } from "react-router-dom";
import { useGameSocketContext } from "../context/GameSocketContext";
import DraftScreen from "../components/DraftScreen";
import ShowdownScreen from "../components/ShowdownScreen";
import ResultsScreen from "../components/ResultsScreen";

export default function RoomPage() {
  const navigate = useNavigate();
  const { matchState, yourSide, roomCode, selectSlot, rematch, leave, error, connected } =
    useGameSocketContext();

  const handleLeave = () => {
    leave();
    navigate("/");
  };

  if (!matchState) {
    return (
      <div className="lobby">
        <div className="lobby__card">
          <p>{connected ? "Connecting to match..." : "Waiting for server..."}</p>
          {roomCode && <p className="room-code">Room: {roomCode}</p>}
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn" onClick={() => navigate("/")}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (matchState.phase === "lobby") {
    return (
      <div className="lobby">
        <div className="lobby__card">
          <h1>Lobby</h1>
          <p className="room-code">Room: {roomCode ?? matchState.roomCode}</p>
          <p>Share this code with your friend. Waiting for opponent…</p>
          <button type="button" className="btn btn--danger" onClick={handleLeave}>
            Leave
          </button>
        </div>
      </div>
    );
  }

  if (matchState.phase === "draft" || matchState.phase === "animating") {
    return (
      <DraftScreen
        state={matchState}
        yourSide={yourSide}
        onSelect={selectSlot}
        roomCode={roomCode}
      />
    );
  }

  if (matchState.phase === "showdown") {
    return <ShowdownScreen state={matchState} yourSide={yourSide} />;
  }

  return (
    <ResultsScreen
      state={matchState}
      yourSide={yourSide}
      onRematch={rematch}
      onLeave={handleLeave}
    />
  );
}
