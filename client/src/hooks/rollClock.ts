/**
 * Shared clock for roll animations, so every roll card on screen
 * (you + opponent/bot) reveals at the same instant.
 *
 * A roll that starts while another is still spinning joins it and shares
 * its end time. If it joins too late to get a decent spin, the shared end
 * is pushed back and every card re-times to the new end.
 */
export const ROLL_SPIN_MS = 2000;
/** Minimum spin a late-joining card gets before the shared reveal. */
export const ROLL_MIN_JOIN_MS = 1200;

type Listener = (end: number) => void;

let currentEnd = 0;
const listeners = new Set<Listener>();

/** Join the active roll (or start a new one). Returns the shared reveal time. */
export function joinRoll(now = performance.now()): number {
  if (now < currentEnd) {
    const minEnd = now + ROLL_MIN_JOIN_MS;
    if (minEnd > currentEnd) {
      currentEnd = minEnd;
      listeners.forEach((l) => l(currentEnd));
    }
  } else {
    currentEnd = now + ROLL_SPIN_MS;
  }
  return currentEnd;
}

export function getRollEnd(): number {
  return currentEnd;
}

export function subscribeRollEnd(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
