import { useEffect, useState } from "react";
import type { Character } from "@build-character/shared";
import { joinRoll, subscribeRollEnd } from "./rollClock";

export { ROLL_SPIN_MS } from "./rollClock";

/**
 * Decides *when* a roll card is revealed. The visual slot reel lives in
 * RollSlotCard. Timing comes from the shared roll clock, so both players'
 * cards (including the bot's) reveal at the same instant.
 *
 * `excludeIds` is kept so the draft page's call site doesn't change.
 */
export function useRollReveal(
  finalCharacter: Character | null | undefined,
  _excludeIds: string[],
) {
  const id = finalCharacter?.id ?? null;
  // Store which id has been revealed (not a boolean) so a new character
  // never renders as "revealed" for a frame before the effect runs.
  const [revealedId, setRevealedId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe = () => {};

    const schedule = (end: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => {
          timer = null;
          unsubscribe();
          setRevealedId(id);
        },
        Math.max(0, end - performance.now()),
      );
    };

    unsubscribe = subscribeRollEnd(schedule);
    schedule(joinRoll());

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  const revealed = !!id && revealedId === id;
  return {
    revealed,
    displayCharacter: finalCharacter ?? null,
    spinning: !!id && !revealed,
  };
}
