export function timeDistribution(values: readonly number[]) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / count;
  const deviation = Math.sqrt(
    sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count,
  );
  const percentile = (p: number) => {
    const index = (count - 1) * p;
    const low = Math.floor(index);
    return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
  };

  const spread = deviation ? 3 * deviation : Math.max(10, mean * 0.01);
  const start = Math.max(0, Math.min(sorted[0], mean - spread));
  const end = Math.max(sorted[count - 1], mean + spread);
  const target = Math.max(100, (end - start) / 4);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const tickStep = ([1, 2, 5, 10].find(n => n * magnitude >= target) ?? 10) * magnitude;
  const lower = Math.floor(start / tickStep) * tickStep;
  const upper = Math.max(lower + tickStep, Math.ceil(end / tickStep) * tickStep);
  const timeTicks = Array.from({ length: (upper - lower) / tickStep + 1 }, (_, i) => lower + i * tickStep);
  const binCount = Math.max(5, Math.min(16, Math.ceil(Math.sqrt(count))));
  const binWidth = (upper - lower) / binCount;
  const bins = Array<number>(binCount).fill(0);
  for (const value of sorted) {
    bins[Math.min(binCount - 1, Math.floor((value - lower) / binWidth))]++;
  }

  // Scale the density to the same count-per-bin units as the histogram.
  const curve = deviation === 0 ? [] : Array.from({ length: 121 }, (_, i) => {
    const value = lower + (i / 120) * (upper - lower);
    return (count * binWidth * Math.exp(-0.5 * ((value - mean) / deviation) ** 2))
      / (deviation * Math.sqrt(2 * Math.PI));
  });

  return {
    lower, upper, timeTicks, bins, curve, deviation,
    q1: percentile(0.25),
    median: percentile(0.5),
    q3: percentile(0.75),
    p90: percentile(0.9),
  };
}
