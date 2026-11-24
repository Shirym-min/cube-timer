import { useEffect, useRef, useState } from "react";
import { inspectionPenalty, type Penalty, type Settings } from "./model";
export type Phase =
  "idle" | "holding" | "ready" | "inspection" | "running" | "stopped";
export function useTimer(
  settings: Settings,
  enabled: boolean,
  onFinish: (ms: number, penalty: Penalty, splits: number[]) => void,
) {
  const [phase, setPhase] = useState<Phase>("idle"),
    [elapsed, setElapsed] = useState(0),
    [parts, setParts] = useState<number[]>([]);
  const r = useRef({
    phase: "idle" as Phase,
    start: 0,
    inspectionStart: 0,
    inspecting: false,
    holdStart: 0,
    penalty: "OK" as Penalty,
    splits: [] as number[],
    pressed: false,
    cue: 0,
  });
  const audio = useRef<AudioContext | undefined>(undefined);
  const callback = useRef(onFinish);
  callback.current = onFinish;
  const options = useRef(settings);
  options.current = settings;
  function change(p: Phase) {
    r.current.phase = p;
    setPhase(p);
  }
  function finish(dnf = false) {
    const s = r.current,
      ms = Math.floor(performance.now() - s.start);
    setElapsed(ms);
    s.pressed = false;
    change("stopped");
    callback.current(ms, dnf ? "DNF" : s.penalty, [...s.splits]);
  }
  function down() {
    if (options.current.sound) {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume().catch(() => {});
      } catch {}
    }
    const s = r.current;
    if (s.pressed) return;
    s.pressed = true;
    if (s.phase === "running") {
      const ms = Math.floor(performance.now() - s.start);
      if (s.splits.length < options.current.phases - 1) {
        s.splits.push(ms);
        setParts([...s.splits]);
      } else finish();
      return;
    }
    if (!enabled) {
      s.pressed = false;
      return;
    }
    s.holdStart = performance.now();
    change(options.current.hold === 0 ? "ready" : "holding");
  }
  function up() {
    const s = r.current;
    s.pressed = false;
    if (s.phase === "holding") {
      change(s.inspecting ? "inspection" : "idle");
      return;
    }
    if (s.phase !== "ready") return;
    const now = performance.now();
    if (options.current.inspection && !s.inspecting) {
      s.inspectionStart = now;
      s.inspecting = true;
      s.cue = 0;
      setElapsed(0);
      change("inspection");
      return;
    }
    s.penalty = s.inspecting
      ? inspectionPenalty(now - s.inspectionStart)
      : "OK";
    s.inspecting = false;
    s.start = now;
    s.splits = [];
    setParts([]);
    setElapsed(0);
    change("running");
  }
  function cancelHold() {
    const s = r.current;
    s.pressed = false;
    if (["holding", "ready"].includes(s.phase))
      change(s.inspecting ? "inspection" : "idle");
  }
  function reset() {
    r.current.inspecting = false;
    r.current.pressed = false;
    setElapsed(0);
    setParts([]);
    change("idle");
  }
  const actions = useRef({ down, up, finish, reset, cancelHold });
  actions.current = { down, up, finish, reset, cancelHold };
  useEffect(() => {
    const editable = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      !!t.closest(
        "input,textarea,select,button,a,dialog,[contenteditable=true]",
      );
    const keydown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Escape") {
        if (r.current.phase === "running") {
          e.preventDefault();
          actions.current.finish(true);
        } else if (!r.current.inspecting) actions.current.reset();
        return;
      }
      if (e.code === "Space" && !editable(e.target)) {
        e.preventDefault();
        actions.current.down();
      }
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.code === "Space" && r.current.pressed) {
        e.preventDefault();
        actions.current.up();
      }
    };
    const blur = () => actions.current.cancelHold();
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    if (phase !== "holding" && !r.current.inspecting) return;
    let frame = 0;
    const tick = () => {
      const s = r.current,
        now = performance.now();
      if (s.phase === "holding" && now - s.holdStart >= options.current.hold)
        change("ready");
      if (s.inspecting) {
        const time = now - s.inspectionStart;
        setElapsed(Math.floor(time / 1000) * 1000);
        const cue = time >= 12000 ? 2 : time >= 8000 ? 1 : 0;
        if (cue > s.cue) {
          s.cue = cue;
          if (options.current.sound) {
            try {
              const context = audio.current;
              if (!context) throw Error("Audio unavailable");
              const osc = context.createOscillator(),
                gain = context.createGain();
              osc.frequency.value = cue === 1 ? 660 : 880;
              gain.gain.value = 0.08;
              osc.connect(gain);
              gain.connect(context.destination);
              osc.start();
              osc.stop(context.currentTime + 0.15);
            } catch {
              /* Audio can be unavailable until a user gesture. */
            }
          }
        }
      }
      if (s.phase === "holding" || s.inspecting) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);
  useEffect(() => {
    return () => {
      void audio.current?.close();
      audio.current = undefined;
    };
  }, []);
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    let gone = false;
    if (phase === "running" && "wakeLock" in navigator)
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (gone) void l.release();
          else lock = l;
        })
        .catch(() => {});
    return () => {
      gone = true;
      void lock?.release();
    };
  }, [phase]);
  return {
    phase,
    elapsed,
    startedAt: r.current.start,
    parts,
    down,
    up,
    cancelHold,
    reset,
    inspecting: r.current.inspecting,
    active: ["holding", "ready", "inspection", "running"].includes(phase),
  };
}
