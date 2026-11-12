export function PlayerAvatar({ name, bot = false, color }: {
  name: string;
  bot?: boolean;
  color: "blue" | "red";
}) {
  return (
    <div className={`player-avatar player-avatar--${color}`}>
      <span className={`player-avatar__face${bot ? " player-avatar__face--bot" : ""}`} aria-hidden="true" />
      <span className="player-avatar__name">{name}</span>
    </div>
  );
}

export function Versus() {
  return <div className="versus" aria-label="versus"><span data-text="VS">VS</span></div>;
}

export function AverageScore({ value, color }: { value: number; color: "blue" | "red" }) {
  return (
    <div className={`avg-box avg-box--${color}`}>
      <span>AVG SCORE</span>
      <strong>{value.toFixed(1)}</strong>
    </div>
  );
}


