import { effective, type Solve } from "./model";

const reviewInterval = 7 * 24 * 60 * 60 * 1000;
const recentAttempts = 5;

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = (sorted.length - 1) / 2;
  return (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
}

export function analyzePractice(patterns: readonly { name: string }[], records: Solve[]) {
  const byPattern = new Map(patterns.map(({ name }) => [name, [] as Solve[]]));
  for (const solve of records) {
    if (solve.practice) byPattern.get(solve.practice.pattern)?.push(solve);
  }

  const recent = [...byPattern].flatMap(([name, solves]) => {
    if (solves.length < 3) return [];
    const times = solves.slice(-recentAttempts).map(effective);
    const valid = times.filter(Number.isFinite);
    return [{
      name,
      attempts: times.length,
      dnf: times.length - valid.length,
      median: valid.length >= 3 ? median(valid) : null,
    }];
  });
  const medians = recent.flatMap(({ median }) => median === null ? [] : [median]);
  const baseline = medians.length >= 2 ? median(medians) : null;
  const weak = recent.flatMap((pattern) => {
    const slow = baseline !== null && pattern.median !== null &&
      pattern.median > baseline && pattern.median >= 1.2 * baseline;
    if (pattern.dnf < 2 && !slow) return [];
    return [{ ...pattern, slow }];
  }).sort((a, b) =>
    b.dnf / b.attempts - a.dnf / a.attempts || (b.median ?? 0) - (a.median ?? 0)
  );
  const practiced = [...byPattern.values()].filter(solves => solves.length > 0).length;

  return { byPattern, baseline, weak, practiced };
}

export function choosePracticePattern<T extends { name: string }>(
  patterns: readonly T[],
  previous: string | undefined,
  learning?: ReturnType<typeof analyzePractice>,
  now = Date.now(),
  random = Math.random,
): T {
  const alternatives = patterns.filter(({ name }) => name !== previous);
  const available = alternatives.length ? alternatives : patterns;
  const pick = (pool: readonly T[]) => pool[Math.floor(random() * pool.length)];
  if (!learning) return pick(available);

  const roll = random();
  if (roll < 0.5) {
    const weakNames = new Set(learning.weak.map(({ name }) => name));
    const weak = available.filter(({ name }) => weakNames.has(name));
    if (weak.length) return pick(weak);
  }
  if (roll < 0.8) {
    const review = available.filter(({ name }) => {
      const solves = learning.byPattern.get(name);
      const latest = solves?.at(-1);
      return solves && latest && (solves.length < 3 || now - latest.createdAt >= reviewInterval);
    });
    if (review.length) return pick(review);
  }
  const untried = available.filter(({ name }) => !learning.byPattern.get(name)?.length);
  return pick(untried.length ? untried : available);
}
