import { expect, it } from "vitest";
import { analyzePractice, choosePracticePattern } from "../src/lib/algorithmPractice";
import type { Solve } from "../src/lib/model";

const cases = ["fast", "average", "slow", "dnf", "review", "new"].map(name => ({ name }));
const now = Date.UTC(2026, 10, 26);
const day = 86400000;

function record(pattern: string, ms: number, penalty: Solve["penalty"] = "OK", createdAt = now): Solve {
  return {
    id: crypto.randomUUID(), sessionId: "algorithm-practice", event: "333",
    ms, penalty, createdAt, scramble: "", splits: [], comment: "",
    practice: { algorithm: "PLL", pattern },
  };
}

function fixture() {
  return analyzePractice(cases, [
    record("fast", 1000), record("fast", 1000), record("fast", 1000),
    record("average", 2000), record("average", 2000), record("average", 2000),
    record("slow", 50000),
    ...Array.from({ length: 5 }, () => record("slow", 1500, "+2")),
    record("dnf", 1000), record("dnf", 1000, "DNF"), record("dnf", 1000, "DNF"),
    ...Array.from({ length: 3 }, () => record("review", 2000, "OK", now - 8 * day)),
  ]);
}

it("compares recent successful medians and identifies repeated DNFs", () => {
  const learning = fixture();
  expect(learning.baseline).toBe(2000);
  expect(learning.weak.map(({ name, median, dnf }) => ({ name, median, dnf }))).toEqual([
    { name: "dnf", median: null, dnf: 2 },
    { name: "slow", median: 3500, dnf: 0 },
  ]);
  expect(learning.practiced).toBe(5);
  expect(analyzePractice(cases, [record("slow", 9000)]).weak).toEqual([]);
});

it("selects weak, overdue or new patterns and skips the previous pattern", () => {
  const learning = fixture();
  expect(choosePracticePattern(cases, "slow", learning, now, () => 0.2).name).toBe("dnf");
  expect(choosePracticePattern(cases, undefined, learning, now, () => 0.6).name).toBe("review");
  expect(choosePracticePattern(cases, undefined, learning, now, () => 0.9).name).toBe("new");
  expect(choosePracticePattern(cases, "fast", undefined, now, () => 0).name).toBe("average");
});
