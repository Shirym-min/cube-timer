import { useEffect, useRef, useState } from "react";
import type { KPattern } from "cubing/kpuzzle";
import { TwistyPlayer } from "cubing/twisty";
import { applyRecallCubeColors, type CubeMaterial } from "../lib/recallCubeColors";
import type { TopColor } from "../lib/recallFaces";

export function BldPlaybackCube({ algorithm, pattern, top, onFinish, label }: {
  algorithm: string;
  pattern?: KPattern;
  top: TopColor;
  onFinish?: () => void;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayer>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const materials: CubeMaterial[] = [];
    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "3D",
      experimentalSetupAnchor: "start",
      background: "none",
      hintFacelets: "floating",
      viewerLink: "none",
    });
    playerRef.current = player;
    host.current?.replaceChildren(player);
    setError(false);
    void applyRecallCubeColors(player, top, () => active, materials).catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
      playerRef.current = null;
      player.pause();
      player.remove();
      materials.forEach((material) => material.dispose());
    };
  }, [top]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const { detailedTimelineInfo, setupTransformation } = player.experimentalModel;
    let active = true;
    function finish(timeline: { atEnd: boolean; atStart: boolean }) {
      if (active && timeline.atEnd && !timeline.atStart) onFinish?.();
    }

    player.pause();
    setupTransformation.set(pattern?.experimentalToTransformation() ?? null);
    player.alg = algorithm;
    player.controlPanel = algorithm ? "bottom-row" : "none";
    player.timestamp = "start";
    if (algorithm && onFinish) {
      host.current?.scrollIntoView({ block: "nearest" });
      // The player initializes its renderer when it becomes visible.
      void player.experimentalCurrentThreeJSPuzzleObject().then(() => {
        if (!active) return;
        detailedTimelineInfo.addFreshListener(finish);
        player.play();
      }).catch(() => {
        if (active) setError(true);
      });
    }
    return () => {
      active = false;
      detailedTimelineInfo.removeFreshListener(finish);
      player.pause();
    };
  }, [algorithm, pattern, top, onFinish]);

  return (
    <div className="bld-playback">
      <div className="bld-playback-player" ref={host} role="group" aria-label={label} />
      {error && <p role="alert">3D キューブを表示できません。</p>}
    </div>
  );
}
