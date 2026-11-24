import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { TwistyPlayer } from "cubing/twisty";
import { speffzSticker, type Orbit } from "../lib/bld";

export type Highlight = { orbit: Orbit; letter: string };
const initialView = { latitude: 28, longitude: 32 };

export function BldHighlightCube({ highlights }: { highlights: Highlight[] }) {
  const host = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);
  const [error, setError] = useState(false);
  const description = highlights.map(({ orbit, letter }) => `${letter}（${speffzSticker(orbit, letter).position}）`).join("、");

  useEffect(() => {
    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "3D",
      background: "none",
      controlPanel: "none",
      hintFacelets: "none",
      cameraLatitude: initialView.latitude,
      cameraLongitude: initialView.longitude,
      cameraLatitudeLimit: 89,
    });
    player.timestamp = "end";
    playerRef.current = player;
    host.current?.replaceChildren(player);
    let active = true;
    void player.experimentalCurrentCanvases().catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
      playerRef.current = null;
      player.remove();
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const orbits = { EDGES: mask(12, 2), CORNERS: mask(8, 3), CENTERS: mask(6, 1) };
    for (const { orbit, letter } of highlights) {
      const { piece, sticker } = speffzSticker(orbit, letter);
      const facelets = orbits[orbit].pieces[piece].facelets;
      if (!facelets.includes("regular")) facelets.fill("dim");
      facelets[sticker] = "regular";
    }
    player.experimentalStickeringMaskOrbits = { orbits };
  }, [highlights]);

  function reset() {
    const player = playerRef.current;
    if (!player) return;
    player.cameraLatitude = initialView.latitude;
    player.cameraLongitude = initialView.longitude;
  }

  async function rotateWithKeys(event: KeyboardEvent<HTMLDivElement>) {
    const offset = { ArrowLeft: [0, -20], ArrowRight: [0, 20], ArrowUp: [15, 0], ArrowDown: [-15, 0] }[event.key];
    const player = playerRef.current;
    if (!offset || !player) return;
    event.preventDefault();
    const view = await player.experimentalModel.twistySceneModel.orbitCoordinates.get();
    if (playerRef.current !== player) return;
    player.cameraLatitude = Math.max(-88, Math.min(88, view.latitude + offset[0]));
    player.cameraLongitude = view.longitude + offset[1];
  }

  return (
    <figure className="bld-highlight">
      <div className="bld-highlight-player" ref={host} role="group" tabIndex={0}
        aria-label={`3D キューブの交換対象 ${description}。矢印キーで視点を変更`}
        onKeyDown={(event) => void rotateWithKeys(event)} />
      <figcaption>
        <span translate="no">{description}</span>
        <button type="button" className="text-button" onClick={reset} disabled={error}>向きをリセット</button>
      </figcaption>
      {error && <p role="alert">3D キューブを表示できません。</p>}
    </figure>
  );
}

function mask(count: number, size: number) {
  return {
    pieces: Array.from({ length: count }, () => ({
      facelets: Array.from({ length: size }, (): "ignored" | "dim" | "regular" => "ignored"),
    })),
  };
}
