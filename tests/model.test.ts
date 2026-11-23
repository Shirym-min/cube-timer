import { describe, it, expect } from "vitest";
import {
  average,
  summary,
  formatTime,
  parseTime,
  inspectionPenalty,
  materialize,
  validOperation,
  DEFAULT_SETTINGS,
  type Solve,
  type Operation,
} from "../src/lib/model";
import { csvCell, parseImport } from "../src/lib/import";
const solve = (ms: number, penalty: Solve["penalty"] = "OK"): Solve => ({
  id: crypto.randomUUID(),
  sessionId: "s",
  event: "333",
  ms,
  penalty,
  scramble: "R U",
  createdAt: 1,
  comment: "",
  splits: [],
});
describe("statistics", () => {
  it("trims extremes, includes +2 and handles DNF", () => {
    expect(
      average(
        [solve(1000), solve(2000), solve(3000), solve(4000), solve(5000)],
        5,
      ),
    ).toBe(3000);
    expect(
      average(
        [
          solve(1000),
          solve(2000, "+2"),
          solve(3000),
          solve(4000),
          solve(5000, "DNF"),
        ],
        5,
      ),
    ).toBe(11000 / 3);
    expect(
      average(
        [
          solve(1000, "DNF"),
          solve(2000, "DNF"),
          solve(3000),
          solve(4000),
          solve(5000),
        ],
        5,
      ),
    ).toBe(Infinity);
    expect(average([solve(1000), solve(2000), solve(3000, "DNF")], 3)).toBe(
      Infinity,
    );
  });
  it("uses ceil 5% trimming and rolling best for every requested window", () => {
    for (const n of [5, 12, 50, 100, 500, 1000]) {
      const s = Array.from({ length: n }, (_, i) => solve((i + 1) * 1000));
      expect(average(s, n)).toBe((n + 1) * 500);
      expect(summary([...s, solve(1)], n).best).toBeLessThanOrEqual(
        average(s, n)!,
      );
    }
    expect(average([], 5)).toBeNull();
  });
  it("truncates display instead of rounding a time up", () => {
    expect(formatTime(59999.9)).toBe("59.999");
    expect(formatTime(60001)).toBe("1:00.001");
    expect(formatTime(12349, 2)).toBe("12.34");
    expect(formatTime(Infinity)).toBe("DNF");
  });
  it("validates time inputs and inspection boundaries", () => {
    expect(parseTime("1:23.456")).toBe(83456);
    for (const s of ["", "-1", "1:60", "abc", "0", "1.1234"])
      expect(() => parseTime(s)).toThrow();
    expect(inspectionPenalty(14999)).toBe("OK");
    expect(inspectionPenalty(15000)).toBe("+2");
    expect(inspectionPenalty(16999)).toBe("+2");
    expect(inspectionPenalty(17000)).toBe("DNF");
  });
});
describe("persistence and import", () => {
  it("merges edits deterministically regardless of arrival order, including tombstones", () => {
    const s = solve(12345),
      a: Operation = {
        id: "a",
        entityId: s.id,
        kind: "solve",
        stamp: 1,
        value: s,
      },
      b: Operation = {
        ...a,
        id: "b",
        stamp: 2,
        value: { ...s, penalty: "+2" },
      },
      c: Operation = {
        ...a,
        id: "c",
        stamp: 3,
        value: { ...s, deleted: true },
      };
    expect(materialize([b, a]).solves[0].penalty).toBe("+2");
    expect(materialize([c, a, b]).solves).toHaveLength(0);
    expect(materialize([a, b]).solves).toEqual(materialize([b, a]).solves);
  });
  it("rejects malformed imports before writing anything", () => {
    expect(() =>
      parseImport('{"format":"split-v1","operations":[{}]}'),
    ).toThrow();
    const op = {
      id: crypto.randomUUID(),
      entityId: "settings",
      kind: "settings",
      stamp: 1,
      value: DEFAULT_SETTINGS,
    };
    expect(validOperation(op)).toBe(true);
    expect(
      validOperation({
        ...op,
        value: { ...DEFAULT_SETTINGS, accent: "url(evil)" },
      }),
    ).toBe(false);
    expect(
      validOperation({ ...op, value: { ...DEFAULT_SETTINGS, phases: 100 } }),
    ).toBe(false);
  });
  it("imports csTimer penalties and timestamps", () => {
    const out = parseImport(
      JSON.stringify({
        properties: {
          sessionData: JSON.stringify({
            "1": { name: "Practice", opt: { scrType: "333" } },
          }),
        },
        session1: [[[2000, 12345], "R U", "note", 1700000000]],
      }),
    );
    expect(out).toHaveLength(2);
    expect(out[1].value).toMatchObject({
      ms: 12345,
      penalty: "+2",
      comment: "note",
      createdAt: 1700000000000,
    });
  });
});

it("escapes spreadsheet formulas in text without changing numeric values", () => {
  expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
  expect(csvCell(12.3)).toBe('"12.3"');
});

import { compareMultiBlind } from "../src/lib/model";
it("ranks multi-blind by points, time, then misses, with DNF last", () => {
  const a = {
      ...solve(600000),
      event: "333mbf" as const,
      solved: 4,
      attempted: 5,
    },
    b = { ...a, ms: 700000 },
    c = { ...a, solved: 5, attempted: 7 };
  expect(compareMultiBlind(a, b)).toBeLessThan(0);
  expect(compareMultiBlind(a, c)).toBeLessThan(0);
  expect(compareMultiBlind({ ...a, penalty: "DNF" }, b)).toBeGreaterThan(0);
});

it("defaults legacy hint settings and rejects unknown hint types", () => {
  const { hintFace, hintType, ...legacy } = DEFAULT_SETTINGS;
  const operation = {
    id: crypto.randomUUID(),
    entityId: "settings",
    kind: "settings",
    stamp: 1,
    value: legacy,
  };
  expect(validOperation(operation)).toBe(true);
  if (validOperation(operation))
    expect(materialize([operation]).settings).toMatchObject({
      hintFace: "D",
      hintType: "cross",
    });
  expect(
    validOperation({
      ...operation,
      value: { ...DEFAULT_SETTINGS, hintType: "all" },
    }),
  ).toBe(false);
});
