import { useEffect, useState } from "react";
import { installClickSounds, isMuted, onMutedChange, setMuted } from "../audio/sfx";
import "./SoundToggle.css";

/** Small fixed mute button; also installs the global UI click sounds. */
export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => installClickSounds(), []);
  useEffect(() => onMutedChange(setMutedState), []);

  return (
    <button
      type="button"
      className="sound-toggle"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Unmute sounds" : "Mute sounds"}
    >
      <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
