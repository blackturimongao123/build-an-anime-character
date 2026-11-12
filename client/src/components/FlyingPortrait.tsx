import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Character } from "@build-character/shared";
import { Portrait } from "./Portrait";
import "./FlyingPortrait.css";

export const FLY_MS = 520;

type Box = { left: number; top: number; width: number; height: number };

function rectOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/**
 * Shrink-and-relocate: a copy of the rolled portrait pops slightly, then
 * shrinks while flying into the category slot. Rects are measured once on
 * mount, so parent re-renders (timer ticks) never restart the flight.
 */
export function FlyingPortrait({
  character,
  getFrom,
  getTo,
  onDone,
}: {
  character: Character;
  getFrom: () => HTMLElement | null | undefined;
  getTo: () => HTMLElement | null | undefined;
  onDone: () => void;
}) {
  const [rects, setRects] = useState<{ from: Box; to: Box } | null>(null);
  const elRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Measure once, on mount.
  useLayoutEffect(() => {
    const fromEl = getFrom();
    const toEl = getTo();
    if (!fromEl || !toEl) {
      onDoneRef.current();
      return;
    }
    setRects({ from: rectOf(fromEl), to: rectOf(toEl) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  // Animate once the clone is in the DOM at the start rect.
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el || !rects) return;
    const { from, to } = rects;
    const end = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDoneRef.current();
    };

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof el.animate !== "function") {
      finish();
      return;
    }
    const anim = el.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", offset: 0 },
        { transform: "translate(0px, 0px) scale(1.06)", offset: 0.14, easing: "cubic-bezier(.4,0,.2,1)" },
        { transform: end, offset: 1 },
      ],
      { duration: FLY_MS, easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" },
    );
    anim.onfinish = finish;
    // Safety net if the animation is cancelled or the tab is hidden.
    const timer = setTimeout(finish, FLY_MS + 150);
    return () => {
      clearTimeout(timer);
      anim.cancel();
    };
  }, [rects]);

  if (!rects) return null;
  const { from } = rects;

  return createPortal(
    <div
      ref={elRef}
      className="flying-portrait"
      style={{ left: from.left, top: from.top, width: from.width, height: from.height }}
      aria-hidden="true"
    >
      <Portrait character={character} showName={false} className="flying-portrait__card" />
    </div>,
    document.body,
  );
}
