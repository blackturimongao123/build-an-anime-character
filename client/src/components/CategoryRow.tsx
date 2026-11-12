import {
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  type Category,
  type Character,
} from "@build-character/shared";
import { Portrait } from "./Portrait";

export function CategoryRow({
  category,
  assigned,
  onPick,
  align = "left",
  prompt,
  score,
  highlight,
  eliminated,
  impact,
  defeated,
  rowRef,
  hidePortrait,
  clash,
  dimmed,
}: {
  category: Category;
  assigned?: Character;
  onPick?: () => void;
  align?: "left" | "right";
  prompt?: string;
  score?: number;
  highlight?: boolean;
  eliminated?: boolean;
  impact?: boolean;
  defeated?: boolean;
  /** Row element; the draft screen uses it to find the slot a portrait flies into. */
  rowRef?: (el: HTMLDivElement | null) => void;
  /** Keep the slot's space but hide its portrait (while a flying portrait lands there). */
  hidePortrait?: boolean;
  /** Showdown clash result for this row: lunge, then win (return), lose (fall off) or tie (both return). */
  clash?: "win" | "lose" | "tie";
  /** Out of scoring but still on the board (e.g. after a tie). */
  dimmed?: boolean;
}) {
  const label = CATEGORY_LABELS[category];
  const icon = <span className="category-row__emoji" aria-hidden="true">{CATEGORY_EMOJI[category]}</span>;

  return (
    <div ref={rowRef} className={`category-row category-row--${align}${highlight ? " category-row--hit" : ""}${eliminated ? " category-row--gone" : ""}${defeated ? " category-row--defeated" : ""}${clash ? ` category-row--clash category-row--clash-${clash}` : ""}${dimmed ? " category-row--dimmed" : ""}`}>
      <div className="category-row__copy">
        <div className="category-row__label">
          {align === "right" ? <>{icon} {label}</> : <>{label} {icon}</>}
        </div>
        {(assigned || prompt) && (
          <span className="category-row__hint">
            {assigned ? (hidePortrait ? "" : assigned.displayName) : prompt}
          </span>
        )}
      </div>
      {assigned ? (
        <Portrait
          character={assigned}
          showName={false}
          score={score}
          className={`category-row__thumb${hidePortrait ? " category-row__thumb--hidden" : ""}`}
        />
      ) : onPick ? (
        <button className="slot-plus" type="button" onClick={onPick} aria-label={`Assign to ${label}`}>+</button>
      ) : (
        <span className="slot-plus slot-plus--inactive" aria-hidden="true" />
      )}
      {impact && <span className="burst" aria-hidden="true" />}
    </div>
  );
}

