import { useCallback, useEffect, useRef, useState } from "react";
import { randomScrambleForEvent } from "cubing/scramble";
import type { EventId, Penalty, Session, Solve } from "../../lib/model";
import type { Phase } from "../../lib/useTimer";
import type { useStore } from "../../lib/useStore";

export function useTimerSession(
  session: Session | undefined,
  event: EventId,
  commit: ReturnType<typeof useStore>["commit"],
  openManual: () => void,
  notify: (text: string) => void,
) {
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [scrambleBusy, setScrambleBusy] = useState(true);
  const [scrambleError, setScrambleError] = useState("");
  const [multiCount, setMultiCount] = useState(2);
  const [multiIndex, setMultiIndex] = useState(0);
  const [pending, setPending] = useState<Solve | null>(null);
  const [timerPhase, setTimerPhase] = useState<Phase>("idle");
  const generation = useRef(0);
  const scramble = scrambles[multiIndex] ?? "";
  const allScrambles = scrambles.join("\n");
  const timed = !["333fm", "333mbf"].includes(event);

  const generate = useCallback(async () => {
    const run = ++generation.current;
    setScrambleBusy(true);
    setScrambleError("");
    setMultiIndex(0);
    try {
      const out: string[] = [];
      for (let i = 0; i < (event === "333mbf" ? multiCount : 1); i++)
        out.push(
          (
            await randomScrambleForEvent(event === "333mbf" ? "333bf" : event)
          ).toString(),
        );
      if (run === generation.current) setScrambles(out);
    } catch {
      if (run === generation.current) {
        setScrambles([]);
        setScrambleError(
          "スクランブルを生成できませんでした。再試行してください。",
        );
      }
    } finally {
      if (run === generation.current) setScrambleBusy(false);
    }
  }, [event, multiCount]);
  function newSolve(ms: number, penalty: Penalty, splits: number[]): Solve {
    return {
      id: crypto.randomUUID(),
      sessionId: session!.id,
      event,
      ms,
      penalty,
      splits,
      scramble: allScrambles,
      createdAt: Date.now(),
      comment: "",
    };
  }
  async function persistSolve(s: Solve) {
    await commit("solve", s.id, s);
    setPending(null);
    void generate();
  }
  function finish(ms: number, penalty: Penalty, splits: number[]) {
    if (!session) return;
    const s = newSolve(ms, penalty, splits);
    setPending(s);
    if (!timed) {
      openManual();
      return;
    }
    void persistSolve(s).catch(() => {});
  }
  useEffect(() => {
    setTimerPhase("idle");
    setScrambles([]);
    void generate();
    return () => {
      generation.current++;
    };
  }, [session?.id, generate]);
  async function patch(s: Solve, change: Partial<Solve>) {
    try {
      await commit("solve", s.id, { ...s, ...change });
    } catch {}
  }
  async function removeSolve(s: Solve) {
    await commit("solve", s.id, { ...s, deleted: true });
    notify("記録を削除しました。");
  }
  async function copyScramble() {
    try {
      await navigator.clipboard.writeText(allScrambles);
      notify("スクランブルをコピーしました。");
    } catch {
      notify("コピーできませんでした。");
    }
  }

  return {
    scramble: {
      scramble, scrambleBusy, scrambleError, scrambles,
      multiCount, multiIndex, setMultiCount, setMultiIndex, generate, copyScramble,
    },
    phase: timerPhase,
    setTimerPhase,
    timed,
    locked: ["holding", "ready", "inspection", "running"].includes(timerPhase) || !!pending,
    pending, finish, newSolve, persistSolve, patch, removeSolve,
  };
}
