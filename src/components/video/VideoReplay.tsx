import { useEffect, useRef, useState } from "react";
import { TwistyPlayer } from "cubing/twisty";
import { reconstructSolve } from "../../lib/solveVideo";

type Reconstruction = Awaited<ReturnType<typeof reconstructSolve>>;

export function ManualReplay({ scramble }: { scramble: string }) {
  const [moves, setMoves] = useState("");
  const [reconstruction, setReconstruction] = useState<Reconstruction | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  useEffect(() => { setReconstruction(null); setError(""); }, [scramble]);
  async function verify() {
    setChecking(true);
    setError("");
    setReconstruction(null);
    try {
      setReconstruction(await reconstructSolve(scramble, moves));
    } catch (error) {
      setError(error instanceof Error ? error.message : "手順を確認できませんでした。");
    } finally {
      setChecking(false);
    }
  }

  return (
    <details className="video-panel video-reconstruction">
      <summary>手順を入力して確認</summary>
      <div className="video-panel-body">
        <label>解法手順
          <textarea rows={3} value={moves} spellCheck={false} disabled={checking} onChange={(event) => {
            setMoves(event.currentTarget.value);
            setReconstruction(null);
            setError("");
          }} placeholder="R U R' …" />
        </label>
        <button disabled={checking || !scramble.trim() || !moves.trim()} onClick={() => void verify()}>{checking ? "確認中…" : "手順を読み込む"}</button>
        {error && <p role="alert">{error}</p>}
        {reconstruction && <>
          <p role="status">{reconstruction.solved ? "入力した手順で全面が揃います。" : "入力した手順では全面が揃いません。"}</p>
          <Replay reconstruction={reconstruction} />
        </>}
      </div>
    </details>
  );
}

export function Replay({ reconstruction }: { reconstruction: Reconstruction }) {
  const host = useRef<HTMLDivElement>(null);
  const { scramble, moves } = reconstruction;
  useEffect(() => {
    const cube = new TwistyPlayer({
      puzzle: "3x3x3",
      experimentalSetupAlg: scramble,
      alg: moves,
      visualization: "2D",
      background: "none",
      hintFacelets: "none",
    });
    host.current?.replaceChildren(cube);
    return () => cube.remove();
  }, [scramble, moves]);
  return <div className="video-replay" ref={host} aria-label="解法手順の再生" />;
}
