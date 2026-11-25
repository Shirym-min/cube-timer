import { useEffect, useRef, useState } from "react";
import { TwistyPlayer } from "cubing/twisty";
import { EVENTS, type EventId } from "../../lib/model";
export function Diagram({
  event,
  scramble,
}: {
  event: EventId;
  scramble: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    let player: TwistyPlayer | undefined;
    try {
      player = new TwistyPlayer({
        puzzle: EVENTS.find((e) => e[0] === event)![2],
        alg: scramble,
        visualization: "2D",
        background: "none",
        controlPanel: "none",
        hintFacelets: "none",
      });
      player.timestamp = "end";
      ref.current?.replaceChildren(player);
    } catch {
      setError("展開図を表示できません。");
    }
    return () => {
      player?.remove();
    };
  }, [event, scramble]);
  return (
    <div
      className="diagram"
      role="img"
      aria-label={`${EVENTS.find((e) => e[0] === event)![1]}のスクランブル展開図`}
    >
      <div ref={ref} />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
