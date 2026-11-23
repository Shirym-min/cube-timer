import {
  EVENTS,
  validOperation,
  type Operation,
  type Solve,
  type EventId,
} from "./model";
export function parseImport(text: string): Operation[] {
  const data = JSON.parse(text);
  if (
    data?.format === "split-v1" &&
    Array.isArray(data.operations) &&
    data.operations.length <= 200000 &&
    data.operations.every(validOperation)
  )
    return data.operations;
  if (!data || typeof data !== "object")
    throw Error("SPLITまたはcsTimerのJSONを選んでください。");
  const out: Operation[] = [];
  let metadata: Record<string, { name?: string; opt?: { scrType?: string } }> =
    {};
  if (data.properties?.sessionData)
    metadata = JSON.parse(data.properties.sessionData);
  const map: Record<string, EventId> = {
    "333": "333",
    "333ni": "333bf",
    "333oh": "333oh",
    "333fm": "333fm",
    "222so": "222",
    "444wca": "444",
    "555wca": "555",
    "666wca": "666",
    "777wca": "777",
    pyrso: "pyram",
    skbso: "skewb",
    sqrs: "sq1",
    clkwca: "clock",
    mgmp: "minx",
    "444bld": "444bf",
    "555bld": "555bf",
  };
  for (const [key, raw] of Object.entries(data)) {
    if (!/^session\d+$/.test(key)) continue;
    const rows = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(rows))
      throw Error("セッションの形式が正しくありません。");
    const meta = metadata[key.slice(7)],
      scrType = meta?.opt?.scrType ?? "333";
    const event =
      map[scrType] ??
      (EVENTS.some((e) => e[0] === scrType) ? (scrType as EventId) : undefined);
    if (!event)
      throw Error(`csTimerの種目 ${scrType} は読み込みに対応していません。`);
    if (event === "333mbf")
      throw Error("csTimerの複数目隠し記録は取り込みに対応していません。");
    const sid = crypto.randomUUID(),
      now = Date.now();
    out.push({
      id: crypto.randomUUID(),
      entityId: sid,
      kind: "session",
      stamp: now,
      value: {
        id: sid,
        name: (meta?.name ?? key).slice(0, 80),
        event,
        createdAt: now,
      },
    });
    for (const row of rows) {
      if (
        !Array.isArray(row) ||
        !Array.isArray(row[0]) ||
        ![-1, 0, 2000].includes(row[0][0])
      )
        throw Error("csTimerの記録形式を確認してください。");
      const id = crypto.randomUUID(),
        s: Solve = {
          id,
          sessionId: sid,
          event,
          ms: event === "333fm" ? 0 : row[0][1],
          ...(event === "333fm" ? { moves: row[0][1] / 1000 } : {}),
          penalty: row[0][0] === -1 ? "DNF" : row[0][0] === 2000 ? "+2" : "OK",
          scramble: row[1] ?? "",
          comment: row[2] ?? "",
          createdAt: (row[3] ?? now / 1000) * 1000,
          splits: [],
        };
      out.push({
        id: crypto.randomUUID(),
        entityId: id,
        kind: "solve",
        stamp: now,
        value: s,
      });
    }
  }
  if (!out.length || !out.every(validOperation))
    throw Error("有効な記録が見つかりません。元のファイルは変更していません。");
  return out;
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

export function csvCell(value: unknown): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
