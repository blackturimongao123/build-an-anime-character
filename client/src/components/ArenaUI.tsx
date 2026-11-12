import { useEffect, useRef, useState } from "react";

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

const COUNT_UP_MS = 650;

/**
 * Shows the average. With `animate`, it counts up from the last shown value
 * (starting at 0) to `value` after `delayMs`, for the per-fight climb.
 */
export function AverageScore({ value, color, animate = false, delayMs = 0 }: {
  value: number;
  color: "blue" | "red";
  animate?: boolean;
  delayMs?: number;
}) {
  const [shown, setShown] = useState(animate ? 0 : value);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced || from === value) {
      setShown(value);
      return;
    }
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - (1 - t) ** 3;
      setShown(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => { frame = requestAnimationFrame(step); }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, animate, delayMs]);

  const counting = shown !== value;
  return (
    <div className={`avg-box avg-box--${color}${counting ? " avg-box--counting" : ""}`}>
      <span>AVG SCORE</span>
      <strong>{shown.toFixed(1)}</strong>
    </div>
  );
}


