export const EVENTS = [
  ["333", "3×3×3", "3x3x3"],
  ["222", "2×2×2", "2x2x2"],
  ["444", "4×4×4", "4x4x4"],
  ["555", "5×5×5", "5x5x5"],
  ["666", "6×6×6", "6x6x6"],
  ["777", "7×7×7", "7x7x7"],
  ["333oh", "3×3×3 片手", "3x3x3"],
  ["333bf", "3×3×3 目隠し", "3x3x3"],
  ["444bf", "4×4×4 目隠し", "4x4x4"],
  ["555bf", "5×5×5 目隠し", "5x5x5"],
  ["333fm", "3×3×3 最少手数", "3x3x3"],
  ["333mbf", "3×3×3 複数目隠し", "3x3x3"],
  ["clock", "クロック", "clock"],
  ["minx", "メガミンクス", "megaminx"],
  ["pyram", "ピラミンクス", "pyraminx"],
  ["skewb", "スキューブ", "skewb"],
  ["sq1", "スクエア1", "square1"],
] as const;
export type EventId = (typeof EVENTS)[number][0];
export type Penalty = "OK" | "+2" | "DNF";
export type Session = {
  id: string;
  name: string;
  event: EventId;
  createdAt: number;
  deleted?: boolean;
};
export type Solve = {
  id: string;
  sessionId: string;
  practice?: { algorithm: string; pattern: string };
  event: EventId;
  ms: number;
  penalty: Penalty;
  scramble: string;
  createdAt: number;
  comment: string;
  splits: number[];
  moves?: number;
  solved?: number;
  attempted?: number;
  deleted?: boolean;
};
export type Settings = {
  theme: "light" | "dark" | "system";
  accent: string;
  inspection: boolean;
  hold: number;
  precision: 2 | 3;
  hideRunning: boolean;
  sound: boolean;
  showDiagram: boolean;
  phases: number;
  hintFace: "D" | "U" | "F" | "B" | "R" | "L";
  hintType: "cross" | "xcross";
};
export const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  accent: "#2459e0",
  inspection: false,
  hold: 300,
  precision: 3,
  hideRunning: false,
  sound: false,
  showDiagram: true,
  phases: 1,
  hintFace: "D",
  hintType: "cross",
};
export type Operation = {
  id: string;
  entityId: string;
  kind: "session" | "solve" | "settings";
  value: Session | Solve | Settings;
  stamp: number;
};
export type State = {
  sessions: Session[];
  solves: Solve[];
  settings: Settings;
};
export function materialize(ops: Operation[]): State {
  const latest = new Map<string, Operation>();
  for (const op of ops) {
    const key = `${op.kind}:${op.entityId}`,
      old = latest.get(key);
    if (
      !old ||
      op.stamp > old.stamp ||
      (op.stamp === old.stamp && op.id > old.id)
    )
      latest.set(key, op);
  }
  const values = [...latest.values()];
  return {
    sessions: values
      .filter((o) => o.kind === "session")
      .map((o) => o.value as Session)
      .filter((s) => !s.deleted)
      .sort((a, b) => a.createdAt - b.createdAt),
    solves: values
      .filter((o) => o.kind === "solve")
      .map((o) => o.value as Solve)
      .filter((s) => !s.deleted)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    settings: {
      ...DEFAULT_SETTINGS,
      ...(values.find((o) => o.kind === "settings")?.value as
        Settings | undefined),
    },
  };
}
export function effective(s: Solve): number {
  return s.penalty === "DNF"
    ? Infinity
    : s.event === "333fm"
      ? (s.moves ?? Infinity)
      : s.ms + (s.penalty === "+2" ? 2000 : 0);
}
export function average(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const values = solves
    .slice(-n)
    .map(effective)
    .sort((a, b) => a - b);
  const trim = n === 3 ? 0 : Math.ceil(n * 0.05);
  const kept = values.slice(trim, n - trim);
  return kept.reduce((a, b) => a + b, 0) / kept.length;
}
export const WINDOWS = [5, 12, 50, 100, 500, 1000];
export function summary(solves: Solve[], n: number) {
  let best: number | null = null;
  for (let i = n; i <= solves.length; i++) {
    const a = average(solves.slice(i - n, i), n)!;
    if (best === null || a < best) best = a;
  }
  return { current: average(solves, n), best };
}
export function formatTime(ms: number | null, precision: 2 | 3 = 3): string {
  if (ms === null) return "—";
  if (!Number.isFinite(ms)) return "DNF";
  const units = Math.floor(Math.max(0, ms) / (precision === 3 ? 1 : 10));
  const base = 10 ** precision,
    seconds = Math.floor(units / base),
    fraction = String(units % base).padStart(precision, "0");
  return `${seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : seconds}.${fraction}`;
}
export function formatResult(s: Solve, precision: 2 | 3 = 3): string {
  if (s.penalty === "DNF") return "DNF";
  if (s.event === "333fm") return `${s.moves ?? "—"} 手`;
  if (s.event === "333mbf")
    return `${s.solved ?? 0}/${s.attempted ?? 0} · ${formatTime(s.ms, precision)}`;
  return formatTime(effective(s), precision) + (s.penalty === "+2" ? "+" : "");
}
export function parseTime(raw: string): number {
  if (!/^(?:\d{1,3}:)?\d{1,5}(?:\.\d{1,3})?$/.test(raw.trim()))
    throw Error("秒数、または 分:秒.ミリ秒 で入力してください。");
  const parts = raw.trim().split(":").map(Number);
  if (parts.length === 2 && parts[1] >= 60)
    throw Error("秒の部分は60未満にしてください。");
  const ms = Math.round(
    (parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0]) * 1000,
  );
  if (ms <= 0 || ms > 24 * 3600 * 1000)
    throw Error("0秒より大きく、24時間以内で入力してください。");
  return ms;
}
export function inspectionPenalty(elapsed: number): Penalty {
  return elapsed >= 17000 ? "DNF" : elapsed >= 15000 ? "+2" : "OK";
}
const finite = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x) && x >= 0;
const id = (x: unknown) =>
  typeof x === "string" && x.length > 0 && x.length <= 100;
export function validOperation(x: unknown): x is Operation {
  if (!x || typeof x !== "object") return false;
  const o = x as Operation,
    v = o.value;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      o.id,
    ) ||
    !id(o.entityId) ||
    !finite(o.stamp) ||
    !v ||
    typeof v !== "object"
  )
    return false;
  if (o.kind === "session") {
    const s = v as Session;
    return (
      s.id === o.entityId &&
      typeof s.name === "string" &&
      s.name.length > 0 &&
      s.name.length <= 80 &&
      EVENTS.some((e) => e[0] === s.event) &&
      finite(s.createdAt) &&
      (s.deleted === undefined || typeof s.deleted === "boolean")
    );
  }
  if (o.kind === "solve") {
    const s = v as Solve;
    return (
      s.id === o.entityId &&
      id(s.sessionId) &&
      (s.practice === undefined || (s.practice != null && id(s.practice.algorithm) && id(s.practice.pattern))) &&
      EVENTS.some((e) => e[0] === s.event) &&
      finite(s.ms) &&
      s.ms <= 86400000 &&
      ["OK", "+2", "DNF"].includes(s.penalty) &&
      typeof s.scramble === "string" &&
      s.scramble.length <= 30000 &&
      typeof s.comment === "string" &&
      s.comment.length <= 2000 &&
      finite(s.createdAt) &&
      Array.isArray(s.splits) &&
      s.splits.length <= 20 &&
      s.splits.every(
        (v, i) => finite(v) && v <= s.ms && (i === 0 || v >= s.splits[i - 1]),
      ) &&
      (s.event !== "333fm" || Number.isInteger(s.moves)) &&
      (s.event !== "333mbf" ||
        (Number.isInteger(s.solved) && Number.isInteger(s.attempted))) &&
      (s.deleted === undefined || typeof s.deleted === "boolean") &&
      (s.moves === undefined ||
        (Number.isInteger(s.moves) && s.moves >= 0 && s.moves <= 999)) &&
      (s.solved === undefined ||
        (Number.isInteger(s.solved) && s.solved >= 0)) &&
      (s.attempted === undefined ||
        (Number.isInteger(s.attempted) &&
          s.attempted >= 2 &&
          s.attempted <= 100 &&
          (s.solved ?? 0) <= s.attempted))
    );
  }
  if (o.kind === "settings") {
    const s = v as Settings;
    return (
      o.entityId === "settings" &&
      ["light", "dark", "system"].includes(s.theme) &&
      (s.hintFace === undefined ||
        ["D", "U", "F", "B", "R", "L"].includes(s.hintFace)) &&
      (s.hintType === undefined || ["cross", "xcross"].includes(s.hintType)) &&
      /^#[a-f\d]{6}$/i.test(s.accent) &&
      [0, 300, 550].includes(s.hold) &&
      [2, 3].includes(s.precision) &&
      Number.isInteger(s.phases) &&
      s.phases >= 1 &&
      s.phases <= 10 &&
      ["inspection", "hideRunning", "sound", "showDiagram"].every(
        (k) => typeof s[k as keyof Settings] === "boolean",
      )
    );
  }
  return false;
}

export function compareMultiBlind(a: Solve, b: Solve): number {
  if (a.penalty === "DNF" || b.penalty === "DNF")
    return Number(a.penalty === "DNF") - Number(b.penalty === "DNF");
  const points = (s: Solve) => 2 * (s.solved ?? 0) - (s.attempted ?? 0);
  return (
    points(b) - points(a) ||
    a.ms - b.ms ||
    (a.attempted ?? 0) -
      (a.solved ?? 0) -
      ((b.attempted ?? 0) - (b.solved ?? 0))
  );
}
