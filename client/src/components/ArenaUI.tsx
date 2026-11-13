import { useLayoutEffect, useRef } from "react";

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
 * The count-up writes the number straight to the DOM each frame instead of
 * re-rendering React 60 times a second.
 */
export function AverageScore({ value, color, animate = false, delayMs = 0 }: {
  value: number;
  color: "blue" | "red";
  animate?: boolean;
  delayMs?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLElement>(null);
  const shownRef = useRef(animate ? 0 : value);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const num = numRef.current;
    if (!box || !num) return;
    const show = (v: number) => {
      shownRef.current = v;
      num.textContent = v.toFixed(1);
    };
    const from = shownRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced || from === value) {
      show(value);
      box.classList.remove("avg-box--counting");
      return;
    }
    show(from);
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) {
        start = now;
        box.classList.add("avg-box--counting");
      }
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - (1 - t) ** 3;
      show(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else box.classList.remove("avg-box--counting");
    };
    const timer = setTimeout(() => { frame = requestAnimationFrame(step); }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      box.classList.remove("avg-box--counting");
    };
  }, [value, animate, delayMs]);

  return (
    <div ref={boxRef} className={`avg-box avg-box--${color}`}>
      <span>AVG SCORE</span>
      {/* Filled in by the layout effect (before paint), so React never owns this text. */}
      <strong ref={numRef} />
    </div>
  );
}


