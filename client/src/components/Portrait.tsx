import { useState } from "react";
import type { Character } from "@build-character/shared";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Portrait only needs these fields, so slim reel entries work too. */
type PortraitCharacter = Pick<Character, "id" | "displayName" | "portrait">;

export function portraitSrc(character: PortraitCharacter | null | undefined): string {
  if (!character) return "";
  const path = character.portrait.startsWith("/")
    ? character.portrait
    : `/${character.portrait}`;
  return `${base}${path.replace(/\?/g, "_")}`;
}

export function Portrait({
  character,
  className = "",
  showName = true,
  score,
}: {
  character: PortraitCharacter | null | undefined;
  className?: string;
  showName?: boolean;
  score?: number;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  if (!character) return <div className={`portrait portrait--empty ${className}`} />;

  const initial = character.displayName.charAt(0);
  const src = portraitSrc(character);

  return (
    <div className={`portrait ${className}`}>
      {failedSrc !== src ? (
        <img
          src={src}
          alt={character.displayName}
          onError={() => setFailedSrc(src)}
          decoding="async"
          draggable={false}
        />
      ) : (
        <div className="portrait__fallback" style={{ background: stringHue(character.id) }}>
          {initial}
        </div>
      )}
      {showName && <span className="portrait__name">{character.displayName}</span>}
      {score !== undefined && <span className="portrait__score">{score}</span>}
    </div>
  );
}

function stringHue(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${h}, 55%, 35%), hsl(${h}, 70%, 22%))`;
}


