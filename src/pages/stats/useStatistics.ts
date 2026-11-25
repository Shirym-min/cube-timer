import { useMemo, useState, type ComponentProps } from "react";
import type { Chart } from "../../components/Chart/Chart";
import { compareMultiBlind, effective, formatTime, summary, WINDOWS, type EventId, type Solve } from "../../lib/model";
import type { Page } from "../../navigation";

export function useStatistics(solves: Solve[], event: EventId, precision: 2 | 3, page: Page) {
  const [chartLimit, setChartLimit] = useState("100");
  const [chartEnd, setChartEnd] = useState("");
  const [chartMetric, setChartMetric] = useState<NonNullable<ComponentProps<typeof Chart>["metric"]>>("ao5");
  const [statsFrom, setStatsFrom] = useState("");
  const [statsTo, setStatsTo] = useState("");

  const statsRangeInvalid = !!statsFrom && !!statsTo && statsFrom > statsTo;
  const analysisSolves = useMemo(() => {
    if ((page !== "stats" && page !== "stats-records") || (!statsFrom && !statsTo)) return solves;
    if (statsRangeInvalid) return [];
    const start = statsFrom ? new Date(`${statsFrom}T00:00:00`).getTime() : -Infinity;
    const nextDay = statsTo ? new Date(`${statsTo}T00:00:00`) : null;
    // Advance the local calendar, including days that are shorter or longer than 24 hours.
    const end = nextDay ? nextDay.setDate(nextDay.getDate() + 1) : Infinity;
    return solves.filter(({ createdAt }) => createdAt >= start && createdAt < end);
  }, [page, solves, statsFrom, statsTo, statsRangeInvalid]);
  const statsRecords = useMemo(() => {
    if (page !== "stats" && page !== "stats-records") return [];
    return event === "333mbf" ? [...analysisSolves].sort(compareMultiBlind) : [...analysisSolves].reverse();
  }, [analysisSolves, event, page]);
  const measures = useMemo(
    () => [3, ...WINDOWS].map((n) => ({ n, ...summary(analysisSolves, n) })),
    [analysisSolves],
  );
  const statsFormat = (n: number | null) =>
    event === "333fm"
      ? n === null
        ? "—"
        : Number.isFinite(n)
          ? n.toFixed(2)
          : "DNF"
      : formatTime(n, precision);
  const bestMulti =
    event === "333mbf"
      ? [...analysisSolves]
          .filter((s) => s.penalty !== "DNF")
          .sort(compareMultiBlind)[0]
      : undefined;
  const finite = analysisSolves.map(effective).filter(Number.isFinite),
    best = finite.length ? Math.min(...finite) : null,
    mean = finite.length ? finite.reduce((sum, time) => sum + time, 0) / finite.length : null;
  const currentAverage = (window: number) =>
    statsFormat(measures.find(({ n }) => n === window)?.current ?? null);

  return {
    analysisSolves, statsRecords, statsRangeInvalid, measures, statsFormat,
    bestMulti, finite, best, mean, currentAverage,
    statsFrom, setStatsFrom, statsTo, setStatsTo,
    chartLimit, setChartLimit, chartEnd, setChartEnd, chartMetric, setChartMetric,
  };
}

export type Statistics = ReturnType<typeof useStatistics>;
