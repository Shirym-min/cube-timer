import { lazy, Suspense, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { randomScrambleForEvent } from "cubing/scramble";
import {
  Box,
  Timer,
  ChartNoAxesCombined,
  Layers,
  Settings2,
  Cloud,
  ChevronRight,
  RefreshCw,
  Plus,
  Keyboard,
  Maximize2,
  Lightbulb,
  ArrowUpRight,
  Trophy,
  Download,
  X,
  Check,
  MoreHorizontal,
  Trash2,
  GraduationCap,
  BookOpen,
  Film,
} from "lucide-react";
import { useStore } from "./lib/useStore";
import { TimerStage } from "./components/TimerStage";
import type { Phase } from "./lib/useTimer";
import {
  average,
  compareMultiBlind,
  effective,
  EVENTS,
  formatResult,
  formatTime,
  summary,
  WINDOWS,
  type EventId,
  type Session,
  type Solve,
  type Penalty,
} from "./lib/model";
import { download, csvCell } from "./lib/import";
import { accentColors } from "./lib/theme";
import { Modal } from "./components/Modal";
import { Chart } from "./components/Chart";
import { TimeDistribution } from "./components/TimeDistribution";
import { Settings } from "./components/Settings";
import { Account } from "./components/Account";
import { DriveSync } from "./components/DriveSync";
import { auth, useAuth } from "./lib/auth";
import { googleClientId } from "./lib/cloud";
import { SolveForm } from "./components/SolveForm";
const Diagram = lazy(() =>
  import("./components/Diagram").then((m) => ({ default: m.Diagram })),
);
const Hint = lazy(() =>
  import("./components/Hint").then((m) => ({ default: m.Hint })),
);
const RecallTrainer = lazy(() =>
  import("./components/RecallTrainer").then((m) => ({
    default: m.RecallTrainer,
  })),
);
const BldTrainer = lazy(() => import("./components/BldTrainer").then((m) => ({ default: m.BldTrainer })));
const BldGuide = lazy(() => import("./components/BldGuide").then((m) => ({ default: m.BldGuide })));
const SolveVideo = lazy(() =>
  import("./components/SolveVideo").then((m) => ({ default: m.SolveVideo })),
);
const AlgorithmLibrary = lazy(() =>
  import("./components/AlgorithmLibrary").then((m) => ({ default: m.AlgorithmLibrary })),
);
type ModalKind =
  "settings" | "account" | "manual" | "help" | "newSession" | null;
const pages = ["timer", "stats", "sessions", "practice", "recall", "algorithms", "video", "bld", "bld-guide"] as const;
type Page = (typeof pages)[number];

function pageFromURL(): Page {
  const value = new URLSearchParams(location.search).get("page");
  return pages.find((page) => page === value) ?? "timer";
}

function pageURL(page: Page) {
  const url = new URL(location.href);
  if (page === "timer") url.searchParams.delete("page");
  else url.searchParams.set("page", page);
  if (url.hash === "#main-content") url.hash = "";
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function App() {
  const account = useAuth();
  const store = useStore(account.user?.id, account.ready);
  const [selected, setSelectedState] = useState(""),
    [page, setPage] = useState(pageFromURL),
    [manualMode, setManualMode] = useState(false),
    [manualCount, setManualCount] = useState(0),
    [mobileTab, setMobileTab] = useState<"timer" | "records">("timer"),
    [modal, setModal] = useState<ModalKind>(null),
    [accountPanel, setAccountPanel] = useState<"login" | "drive">("login"),
    [editing, setEditing] = useState<Solve | null>(null),
    [scrambles, setScrambles] = useState<string[]>([]),
    [scrambleBusy, setScrambleBusy] = useState(true),
    [scrambleError, setScrambleError] = useState(""),
    [multiCount, setMultiCount] = useState(2),
    [multiIndex, setMultiIndex] = useState(0),
    [toast, setToast] = useState({ text: "", visible: false }),
    [focus, setFocus] = useState(false),
    [pending, setPending] = useState<Solve | null>(null),
    [search, setSearch] = useState(""),
    [chartLimit, setChartLimit] = useState("100"),
    [chartEnd, setChartEnd] = useState(""),
    [chartMetric, setChartMetric] = useState<"best" | "ao5" | "ao12" | "ao50" | "ao100" | "ao500" | "ao1000">("ao5"),
    [statsFrom, setStatsFrom] = useState(""),
    [statsTo, setStatsTo] = useState("");
  function setSelected(id: string) {
    setSelectedState(id);
    try {
      localStorage.setItem(`split-session:${store.storageScope}`, id);
    } catch {}
  }
  useEffect(() => {
    try {
      setSelectedState(
        localStorage.getItem(`split-session:${store.storageScope}`) ??
          "",
      );
    } catch {
      setSelectedState("");
    }
  }, [store.storageScope]);
  useEffect(() => {
    if (account.recovery) {
      setAccountPanel("login");
      setModal("account");
    }
  }, [account.recovery]);
  function openAccount() {
    setAccountPanel(auth ? "login" : "drive");
    setModal("account");
  }
  const generation = useRef(0),
    session =
      store.sessions.find((s) => s.id === selected) ?? store.sessions[0],
    event = session?.event ?? "333",
    scramble = scrambles[multiIndex] ?? "",
    allScrambles = scrambles.join("\n");
  const solves = useMemo(
    () => store.solves.filter((s) => s.sessionId === session?.id),
    [store.solves, session?.id],
  );
  const statsRangeInvalid = !!statsFrom && !!statsTo && statsFrom > statsTo;
  const analysisSolves = useMemo(() => {
    if (page !== "stats" || (!statsFrom && !statsTo)) return solves;
    if (statsRangeInvalid) return [];
    const start = statsFrom ? new Date(`${statsFrom}T00:00:00`).getTime() : -Infinity;
    const nextDay = statsTo ? new Date(`${statsTo}T00:00:00`) : null;
    // Advance the local calendar, including days that are shorter or longer than 24 hours.
    const end = nextDay ? nextDay.setDate(nextDay.getDate() + 1) : Infinity;
    return solves.filter(({ createdAt }) => createdAt >= start && createdAt < end);
  }, [page, solves, statsFrom, statsTo, statsRangeInvalid]);
  const timed = !["333fm", "333mbf"].includes(event),
    latest = solves.at(-1),
    precision = store.settings.precision;
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
  async function generate() {
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
  }
  const [timerPhase, setTimerPhase] = useState<Phase>("idle");
  const timer = {
    phase: timerPhase,
    active: ["holding", "ready", "inspection", "running"].includes(timerPhase),
  };
  function newSolve(ms: number, penalty: Penalty, splits: number[]): Solve {
    return {
      id: crypto.randomUUID(),
      sessionId: session.id,
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
    await store.commit("solve", s.id, s);
    setPending(null);
    void generate();
  }
  function finish(ms: number, penalty: Penalty, splits: number[]) {
    if (!session) return;
    const s = newSolve(ms, penalty, splits);
    setPending(s);
    if (!timed) {
      setModal("manual");
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
  }, [session?.id, event, multiCount]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const el = document.documentElement;
      el.dataset.theme = store.settings.theme;
      el.style.setProperty("--accent", store.settings.accent);
      const colors = accentColors(
        store.settings.accent,
        store.settings.theme === "dark" ||
          (store.settings.theme === "system" && media.matches),
      );
      el.style.setProperty("--accent-ink", colors.ink);
      el.style.setProperty("--accent-foreground", colors.foreground);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [store.settings]);
  useEffect(() => {
    if (!toast.visible) return;
    const t = setTimeout(() => setToast({ ...toast, visible: false }), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const locked = timer.active || !!pending;
  function navigate(next: Page) {
    if (pageFromURL() !== next) history.pushState(null, "", pageURL(next));
    setPage(next);
    setFocus(false);
    if (next === "timer") setMobileTab("timer");
  }

  function followPage(e: MouseEvent<HTMLAnchorElement>, next: Page) {
    if (locked || modal || editing) {
      e.preventDefault();
      return;
    }
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(next);
  }

  useEffect(() => {
    const onPopState = () => {
      const next = pageFromURL();
      if (next === page) return;
      if (locked || modal || editing) {
        history.replaceState(history.state, "", pageURL(page));
        return;
      }
      setFocus(false);
      setPage(next);
      if (next === "timer") setMobileTab("timer");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [page, locked, modal, editing]);

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.shiftKey ||
        locked ||
        modal ||
        editing ||
        document.querySelector("dialog[open], :popover-open")
      )
        return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      const destinations = {
        Digit1: "timer",
        Digit2: "stats",
        Digit3: "sessions",
        Digit4: "practice",
      } as const;
      const destination = destinations[e.code as keyof typeof destinations];
      if (destination) {
        e.preventDefault();
        navigate(destination);
      } else if (
        e.code === "KeyR" &&
        page === "timer" &&
        !scrambleBusy &&
        store.loaded
      ) {
        e.preventDefault();
        void generate();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [
    locked,
    modal,
    editing,
    page,
    scrambleBusy,
    store.loaded,
    event,
    multiCount,
  ]);

  const notify = (text: string) => setToast({ text, visible: true });
  async function patch(s: Solve, change: Partial<Solve>) {
    try {
      await store.commit("solve", s.id, { ...s, ...change });
    } catch {}
  }
  async function removeSolve(s: Solve) {
    await store.commit("solve", s.id, { ...s, deleted: true });
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
  async function changeEvent(next: EventId) {
    const existing = store.sessions.find((s) => s.event === next);
    if (existing) {
      setSelected(existing.id);
      return;
    }
    const s: Session = {
      id: crypto.randomUUID(),
      name: EVENTS.find((e) => e[0] === next)![1],
      event: next,
      createdAt: Date.now(),
    };
    try {
      await store.commit("session", s.id, s);
      setSelected(s.id);
    } catch {}
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else setFocus(!focus);
    } catch {
      setFocus(!focus);
    }
  }
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
  const records = solves
    .map((s, i) => ({ s, index: i + 1 }))
    .reverse()
    .filter(
      ({ s, index }) =>
        !search ||
        `${index} ${formatResult(s, precision)} ${s.comment}`.includes(search),
    );
  return (
    <div
      className={`app ${focus ? "focus-mode" : ""} ${timer.phase === "running" ? "is-running" : ""}`}
      onClickCapture={(e) =>
        e.currentTarget.toggleAttribute("data-pointer-motion", e.detail > 0)
      }
      onKeyDownCapture={(e) => e.currentTarget.removeAttribute("data-pointer-motion")}
    >
      {!locked && <a className="skip-link" href="#main-content">本文へ移動</a>}
      <aside className="rail">
        <a
          href={locked ? undefined : pageURL("timer")}
          className="brand"
          aria-label="SPLIT タイマー"
          aria-disabled={locked || undefined}
          onClick={(e) => followPage(e, "timer")}
        >
          <span className="brand-icon">
            <Box size={24} strokeWidth={1.7} />
          </span>
          <span>
            SPLIT<span className="brand-dot">.</span>
          </span>
        </a>
        <nav aria-label="メインナビゲーション">
          {(
            [
              ["timer", "タイマー", Timer],
              ["stats", "統計", ChartNoAxesCombined],
              ["sessions", "セッション", Layers],
              ["practice", "練習", GraduationCap],
            ] as const
          ).map(([key, label, Icon]) => (
            <a
              key={key}
              href={locked ? undefined : pageURL(key)}
              aria-disabled={locked || undefined}
              aria-label={label}
              title={label}
              aria-current={
                page === key || (key === "practice" && ["recall", "algorithms", "video", "bld", "bld-guide"].includes(page))
                  ? "page"
                  : undefined
              }
              className={
                page === key || (key === "practice" && ["recall", "algorithms", "video", "bld", "bld-guide"].includes(page))
                  ? "active"
                  : ""
              }
              onClick={(e) => followPage(e, key)}
            >
              <Icon size={19} />
              <span>{label}</span>
              <kbd className="shortcut-hint nav-shortcut" aria-hidden="true">{{timer:"1",stats:"2",sessions:"3",practice:"4"}[key]}</kbd>
            </a>
          ))}
        </nav>
        <div className="rail-bottom">
          <button aria-label="操作ガイド" disabled={locked} onClick={() => setModal("help")}>
            <Keyboard size={19} />
            <span>操作ガイド</span>
          </button>
          <button aria-label="設定" disabled={locked} onClick={() => setModal("settings")}>
            <Settings2 size={19} />
            <span>設定</span>
          </button>
          <div className="rail-caption">
            CUBE TIMER <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>
              {page === "timer"
                ? "タイマー"
                : page === "stats"
                  ? "統計"
                  : page === "sessions"
                    ? "セッション"
                    : page === "recall"
                      ? "Recall Trainer"
                      : page === "video"
                        ? "動画解析"
                        : page === "algorithms"
                          ? "アルゴリズム集"
                          : page === "bld" ? "BLD トレーナー"
                            : page === "bld-guide" ? "BLD ガイド" : "練習"}
            </span>
            {(page === "timer" || page === "stats") && (
              <>
                <ChevronRight size={14} />
                <span className="current-session">
                  {session?.name ?? "読み込み中"}
                </span>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {store.driveUser && page !== "video" && (
              <button
                className="account-button"
                onClick={() => void store.sync()}
                disabled={locked || !store.loaded || store.syncStatus === "同期中"}
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span>{store.syncStatus === "同期中" ? "同期中" : "同期"}</span>
              </button>
            )}
            <button
              className="account-button"
              onClick={openAccount}
              disabled={locked}
            >
              <Cloud size={17} />
              <span>{account.user || store.driveUser ? "アカウント" : "ログイン"}</span>
            </button>
          </div>
        </header>
        {store.error && (modal !== "account" || accountPanel !== "drive") && (
          <div className="error-banner" role="alert">
            <span>{store.error}</span>
            <button
              onClick={() => store.setError("")}
              aria-label="通知を閉じる"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {!store.loaded ? (
          <main id="main-content" tabIndex={-1} className="loading-screen">
            <Box size={32} />
            <p>記録を読み込んでいます…</p>
            {store.error && (
              <button onClick={() => location.reload()}>再読み込み</button>
            )}
          </main>
        ) : !session ? (
          <main id="main-content" tabIndex={-1} className="loading-screen">
            <p>セッションがありません。</p>
            <button className="primary" onClick={() => setModal("newSession")}>
              セッションを作成
            </button>
          </main>
        ) : page === "timer" ? (
          <>
            <div className="mobile-tabs">
              <button
                aria-pressed={mobileTab === "timer"}
                className={mobileTab === "timer" ? "selected" : ""}
                onClick={() => setMobileTab("timer")}
              >
                計測
              </button>
              <button
                disabled={locked}
                aria-pressed={mobileTab === "records"}
                className={mobileTab === "records" ? "selected" : ""}
                onClick={() => setMobileTab("records")}
              >
                記録 <span>{solves.length}</span>
              </button>
            </div>
            <main id="main-content" tabIndex={-1} className={`timer-layout mobile-${mobileTab}`}>
              <h1 className="sr-only">タイマー</h1>
              <div className="timer-workspace">
                <section className="scramble-panel" aria-label="スクランブル">
                  <div className="scramble-main">
                    <div className="scramble-toolbar">
                      <div className="event-selector">
                        <Box size={17} />
                        <label className="sr-only" htmlFor="event">
                          種目
                        </label>
                        <select
                          id="event"
                          value={event}
                          onChange={(e) =>
                            void changeEvent(e.target.value as EventId)
                          }
                          disabled={locked}
                        >
                          {EVENTS.map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {event === "333mbf" && (
                      <div className="multi-controls">
                        <label>
                          個数{" "}
                          <input
                            type="number"
                            min="2"
                            max="100"
                            value={multiCount}
                            disabled={locked || scrambleBusy}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (n >= 2 && n <= 100) setMultiCount(n);
                            }}
                          />
                        </label>
                        <label>
                          表示{" "}
                          <select
                            value={multiIndex}
                            onChange={(e) => setMultiIndex(+e.target.value)}
                          >
                            {scrambles.map((_, i) => (
                              <option key={i} value={i}>
                                {i + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                    <div className="scramble-row">
                      <div className="scramble-viewport">
                        <div
                          className={`scramble-text ${scrambleBusy ? "loading" : ""}`}
                          aria-live="polite"
                          aria-busy={scrambleBusy}
                        >
                          {scrambleError ? (
                            <span role="alert">{scrambleError}</span>
                          ) : scramble ? (
                            <button
                              className="scramble-copy"
                              title="スクランブルをコピー"
                              aria-label="スクランブルをコピー"
                              aria-describedby="current-scramble"
                              disabled={scrambleBusy || locked}
                              onClick={(e) => {
                                if (e.detail) e.currentTarget.blur();
                                void copyScramble();
                              }}
                            >
                              <ScrambleSequence value={scramble} busy={scrambleBusy} />
                            </button>
                          ) : null}
                        </div>
                        <span className="scramble-progress" role="status">
                          {scrambleBusy ? "生成中…" : ""}
                        </span>
                      </div>
                      <button
                        className="icon-button scramble-refresh"
                        data-generating={scrambleBusy || undefined}
                        title={scrambleError ? "再試行" : "次のスクランブル"}
                        aria-label={scrambleError ? "再試行" : "次のスクランブル"}
                        disabled={scrambleBusy || locked}
                        onClick={(e) => {
                          if (e.detail) e.currentTarget.blur();
                          void generate();
                        }}
                      >
                        <span className="scramble-refresh-icon" aria-hidden="true">
                          <RefreshCw size={17} />
                        </span>
                      </button>
                    </div>
                  </div>
                  {store.settings.showDiagram && (
                    <div className="diagram-panel">
                      <div className="panel-heading">
                        {["333", "333oh", "333fm"].includes(event) && (
                          <Suspense
                            fallback={
                              <button className="hint-button" disabled>
                                <Lightbulb size={15} />
                                ヒント
                              </button>
                            }
                          >
                            <Hint
                              scramble={scramble}
                              face={store.settings.hintFace}
                              kind={store.settings.hintType}
                              disabled={
                                locked || scrambleBusy || !!scrambleError
                              }
                            />
                          </Suspense>
                        )}
                      </div>
                      <Suspense
                        fallback={
                          <div className="diagram-placeholder">
                            展開図を読み込み中…
                          </div>
                        }
                      >
                        {scrambleBusy || !scramble ? (
                          <div className="diagram-placeholder" aria-hidden="true" />
                        ) : (
                          <Diagram event={event} scramble={scramble} />
                        )}
                      </Suspense>
                    </div>
                  )}
                </section>
                {manualMode ? (
                  <section className="timer-stage manual-stage" aria-label="手入力">
                    <div className="timer-tools">
                      <button type="button" className="text-button" onClick={() => setManualMode(false)}>
                        タイマー
                      </button>
                    </div>
                    <div className="manual-form">
                      <SolveForm
                        key={`${session?.id}:${event}:${manualCount}`}
                        event={event}
                        autoFocus={false}
                        disabled={!store.loaded || !session || scrambleBusy || !!scrambleError}
                        save={async (data) => {
                          await persistSolve({ ...newSolve(0, "OK", []), ...data });
                          setManualCount((count) => count + 1);
                        }}
                      />
                    </div>
                  </section>
                ) : <TimerStage
                  key={`${session?.id}:${multiCount}`}
                  settings={store.settings}
                  event={event}
                  enabled={
                    store.loaded &&
                    page === "timer" &&
                    !modal &&
                    !editing &&
                    !scrambleBusy &&
                    !scrambleError &&
                    !pending
                  }
                  onFinish={finish}
                  onPhase={setTimerPhase}
                  pending={pending}
                  retry={() =>
                    pending ? persistSolve(pending) : Promise.resolve()
                  }
                  latest={latest}
                  patch={patch}
                  edit={setEditing}
                  remove={removeSolve}
                  solves={solves}
                  best={best}
                  focus={focus}
                  setFocus={setFocus}
                  manualMode={() => { setFocus(false); setManualMode(true); }}
                />}
                <dl className="mobile-quick-stats" aria-label="セッションの統計">
                  {(timed
                    ? [
                        ["ao5", currentAverage(5)],
                        ["平均", statsFormat(mean)],
                        ["ao12", currentAverage(12)],
                        ["ベスト", statsFormat(best)],
                        ["ao50", currentAverage(50)],
                        ["ワースト", statsFormat(finite.length ? Math.max(...finite) : null)],
                        ["ao100", currentAverage(100)],
                        ["記録数", String(solves.length)],
                      ]
                    : event === "333fm"
                      ? [
                          ["mo3", currentAverage(3)],
                          ["ベスト", statsFormat(best)],
                          ["記録数", String(solves.length)],
                        ]
                      : [["記録数", String(solves.length)]]
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <section className="trend-panel">
                  <div className="panel-heading">
                    <h2>タイムの推移</h2>
                    <a
                      className="action-link text-button"
                      href={locked ? undefined : pageURL("stats")}
                      aria-disabled={locked || undefined}
                      onClick={(e) => followPage(e, "stats")}
                    >
                      統計 <ArrowUpRight size={14} />
                    </a>
                  </div>
                  {timed ? (
                    <>
                      <Chart solves={solves} />
                      <div className="chart-legend">
                        <span>
                          <i />
                          タイム
                        </span>
                        <span>
                          <i />
                          ao5
                        </span>
                        <span className="muted">直近100回</span>
                      </div>
                    </>
                  ) : (
                    <p className="muted">
                      {event === "333fm"
                        ? "最少手数は手数とmo3で集計します。"
                        : "複数目隠しは成功数・挑戦数・時間を記録します。"}
                      統計画面で確認できます。
                    </p>
                  )}
                </section>
              </div>
              <aside className="records-pane" aria-label="計測記録">
                <div className="session-toolbar">
                  <label className="sr-only" htmlFor="session">
                    セッション
                  </label>
                  <select
                    id="session"
                    value={session?.id}
                    disabled={locked}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {store.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-button"
                    aria-label="新しいセッション"
                    disabled={locked}
                    onClick={() => setModal("newSession")}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="records-heading">
                  <h2>
                    記録 <span>{solves.length}</span>
                  </h2>
                  <button
                    className="icon-button"
                    aria-label="タイムを手入力"
                    disabled={locked || scrambleBusy}
                    onClick={() => setModal("manual")}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {solves.length > 10 && (
                  <input
                    className="record-search"
                    aria-label="記録を検索"
                    placeholder="タイム・コメントを検索"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                )}
                <div className="records-scroll">
                  {records.length ? (
                    <table className="records-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>タイム</th>
                          <th>{timed ? "ao5" : "判定"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.slice(0, 1000).map(({ s, index }) => (
                          <tr
                            key={s.id}
                            className={index === solves.length ? "latest" : ""}
                          >
                            <td>{index.toString().padStart(2, "0")}</td>
                            <td>
                              <button
                                disabled={locked}
                                onClick={() => setEditing(s)}
                              >
                                {formatResult(s, precision)}
                                {effective(s) === best && (
                                  <Trophy size={12} aria-label="ベスト" />
                                )}
                                {s.comment && (
                                  <span
                                    className="comment-mark"
                                    aria-label="コメントあり"
                                  />
                                )}
                              </button>
                            </td>
                            <td>
                              {timed
                                ? formatTime(
                                    average(solves.slice(0, index), 5),
                                    precision,
                                  )
                                : s.penalty}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-records">
                      <Timer size={26} strokeWidth={1.3} />
                      <p>
                        {search
                          ? "該当する記録がありません"
                          : "まだ記録がありません"}
                      </p>
                      {!search && (
                        <button
                          className="text-button"
                          disabled={locked || scrambleBusy}
                          onClick={() => setModal("manual")}
                        >
                          タイムを入力する <Plus size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            </main>
          </>
        ) : page === "stats" ? (
          <main key="stats" id="main-content" tabIndex={-1} className="page-content">
            <header className="page-heading">
              <div>
                <h1>統計</h1>
                <p className="muted">
                  {EVENTS.find((e) => e[0] === event)![1]}
                </p>
              </div>
              <select
                aria-label="集計するセッション"
                value={session?.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {store.sessions.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </header>
            <div className="stats-period" role="group" aria-label="集計期間">
              <label>
                開始日
                <input type="date" value={statsFrom} onChange={(e) => setStatsFrom(e.target.value)} />
              </label>
              <label>
                終了日
                <input type="date" value={statsTo} onChange={(e) => setStatsTo(e.target.value)}
                  aria-invalid={statsRangeInvalid || undefined}
                  aria-describedby={statsRangeInvalid ? "stats-period-error" : undefined} />
              </label>
              {(statsFrom || statsTo) && (
                <button onClick={() => { setStatsFrom(""); setStatsTo(""); }}>全期間に戻す</button>
              )}
              {statsRangeInvalid && (
                <p className="error-text" id="stats-period-error" role="alert">
                  終了日は開始日以降を指定してください。
                </p>
              )}
            </div>
            <div className="summary-strip">
              <div>
                <span>記録数</span>
                <strong>{analysisSolves.length}</strong>
              </div>
              <div>
                <span>ベスト</span>
                <strong>
                  {event === "333mbf"
                    ? bestMulti
                      ? `${2 * (bestMulti.solved ?? 0) - (bestMulti.attempted ?? 0)}点`
                      : "—"
                    : statsFormat(best)}
                </strong>
              </div>
              <div>
                <span>平均（DNFを除く）</span>
                <strong>
                  {event === "333mbf"
                    ? "—"
                    : statsFormat(
                        finite.length
                          ? finite.reduce((a, b) => a + b, 0) / finite.length
                          : null,
                      )}
                </strong>
              </div>
              <div>
                <span>DNF</span>
                <strong>
                  {analysisSolves.filter((s) => s.penalty === "DNF").length}
                </strong>
              </div>
            </div>
            {event !== "333mbf" && (
              <table className="statistics-table">
                <thead>
                  <tr>
                    <th>指標</th>
                    <th>現在</th>
                    <th>ベスト</th>
                  </tr>
                </thead>
                <tbody>
                  {measures
                    .filter((m) => event !== "333fm" || m.n === 3)
                    .map((m) => (
                      <tr key={m.n}>
                        <th>{m.n === 3 ? "Mean of 3" : `Average of ${m.n}`}</th>
                        <td>{statsFormat(m.current)}</td>
                        <td>{statsFormat(m.best)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            {timed && (
              <div className="stats-visuals">
                <section className="stats-chart">
                  <div className="panel-heading">
                    <h2>タイムの推移</h2>
                  </div>
                  <div className="trend-controls">
                    <label>
                      表示する記録数
                      <input type="number" min="1" max="1000000" inputMode="numeric"
                        value={chartLimit} onChange={(e) => setChartLimit(e.target.value)} />
                    </label>
                    <label>
                      最後の記録番号
                      <input type="number" min="1" max={Math.max(1, analysisSolves.length)} inputMode="numeric"
                        placeholder={String(analysisSolves.length)} value={chartEnd}
                        onChange={(e) => setChartEnd(e.target.value)} />
                    </label>
                    <label>
                      推移
                      <select value={chartMetric} onChange={(e) => setChartMetric(e.target.value as typeof chartMetric)}>
                        <option value="best">ベストタイム</option>
                        {[5, 12, 50, 100, 500, 1000].map((n) => (
                          <option key={n} value={`ao${n}`}>ao{n}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <Chart solves={analysisSolves} large
                    limit={Math.max(1, Math.min(1000000, Number(chartLimit) || 100))}
                    end={chartEnd ? Math.min(analysisSolves.length, Math.max(1, Number(chartEnd) || analysisSolves.length)) : analysisSolves.length}
                    metric={chartMetric} />
                  <div className="chart-legend">
                    <span><i />タイム</span>
                    <span><i />{chartMetric === "best" ? "ベストタイム" : chartMetric}</span>
                  </div>
                </section>
                <TimeDistribution times={finite} precision={precision} />
              </div>
            )}
            <div className="panel-heading">
              <h2>記録</h2>
              <button
                onClick={() => {
                  const rows = [
                    [
                      "date",
                      "event",
                      "time_ms",
                      "penalty",
                      "moves",
                      "solved",
                      "attempted",
                      "scramble",
                      "comment",
                    ],
                    ...analysisSolves.map((s) => [
                      new Date(s.createdAt).toISOString(),
                      s.event,
                      s.ms,
                      s.penalty,
                      s.moves ?? "",
                      s.solved ?? "",
                      s.attempted ?? "",
                      s.scramble,
                      s.comment,
                    ]),
                  ];
                  download(
                    "split-records.csv",
                    "\ufeff" +
                      rows.map((row) => row.map(csvCell).join(",")).join("\n"),
                    "text/csv;charset=utf-8",
                  );
                }}
              >
                <Download size={16} />
                CSV
              </button>
            </div>
            <div className="full-records">
              {(event === "333mbf"
                ? [...analysisSolves].sort(compareMultiBlind)
                : [...analysisSolves].reverse()
              ).map((s) => (
                <button key={s.id} onClick={() => setEditing(s)}>
                  <span>
                    {new Date(s.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                  <strong>{formatResult(s, precision)}</strong>
                  {event === "333mbf" && (
                    <span>{2 * (s.solved ?? 0) - (s.attempted ?? 0)}点</span>
                  )}
                  <span>{s.comment}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!analysisSolves.length && (
                <p className="muted">{statsFrom || statsTo ? "指定期間の記録はありません。" : "まだ記録がありません。"}</p>
              )}
            </div>
          </main>
        ) : page === "practice" ? (
          <main key="practice" id="main-content" tabIndex={-1} className="page-content practice-page">
            <header className="page-heading">
              <h1>練習</h1>
            </header>
            <div className="practice-options">
              <a
                className="action-link practice-item"
                href={pageURL("recall")}
                onClick={(e) => followPage(e, "recall")}
              >
                <span className="practice-icon">
                  <GraduationCap size={23} />
                </span>
                <span>
                  <strong>Recall Trainer</strong>
                  <small>パターンを見て手順を練習</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </a>
              <a
                className="action-link practice-item"
                href={pageURL("bld")}
                onClick={(e) => followPage(e, "bld")}
              >
                <span className="practice-icon"><GraduationCap size={23} /></span>
                <span><strong>BLD トレーナー</strong></span>
                <ChevronRight size={18} aria-hidden="true" />
              </a>
              <a
                className="action-link practice-item"
                href={pageURL("algorithms")}
                onClick={(e) => followPage(e, "algorithms")}
              >
                <span className="practice-icon"><BookOpen size={23} /></span>
                <span><strong>アルゴリズム集</strong></span>
                <ChevronRight size={18} aria-hidden="true" />
              </a>
              <a
                className="action-link practice-item"
                href={pageURL("video")}
                onClick={(e) => followPage(e, "video")}
              >
                <span className="practice-icon"><Film size={23} /></span>
                <span><strong>動画解析</strong></span>
                <ChevronRight size={18} aria-hidden="true" />
              </a>
            </div>
          </main>
        ) : page === "recall" ? (
          <Suspense
            fallback={<main id="main-content" tabIndex={-1} className="loading-screen">読み込み中…</main>}
          >
            <RecallTrainer onBack={() => navigate("practice")} />
          </Suspense>
        ) : page === "algorithms" ? (
          <Suspense fallback={<main id="main-content" tabIndex={-1} className="loading-screen">読み込み中…</main>}>
            <AlgorithmLibrary
              practiceURL={pageURL("practice")}
              onBack={(e) => followPage(e, "practice")}
            />
          </Suspense>
        ) : page === "bld" || page === "bld-guide" ? (
          <Suspense fallback={<main id="main-content" tabIndex={-1} className="loading-screen">読み込み中…</main>}>
            <BldTrainer active={page === "bld"}
              backURL={pageURL("practice")} onBack={(e) => followPage(e, "practice")}
              guideURL={pageURL("bld-guide")} onGuide={(e) => followPage(e, "bld-guide")} />
            {page === "bld-guide" && (
              <BldGuide backURL={pageURL("bld")} onBack={(e) => followPage(e, "bld")} />
            )}
          </Suspense>
        ) : page === "video" ? (
          <Suspense fallback={<main id="main-content" tabIndex={-1} className="loading-screen">読み込み中…</main>}>
            <SolveVideo onBack={() => navigate("practice")} />
          </Suspense>
        ) : (
          <main key="sessions" id="main-content" tabIndex={-1} className="page-content">
            <header className="page-heading">
              <h1>セッション</h1>
              <button
                className="primary"
                onClick={() => setModal("newSession")}
              >
                <Plus size={16} />
                新規セッション
              </button>
            </header>
            <div className="session-list">
              {store.sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  count={
                    store.solves.filter((x) => x.sessionId === s.id).length
                  }
                  current={s.id === session?.id}
                  select={() => {
                    setSelected(s.id);
                    navigate("timer");
                  }}
                  save={async (value) => {
                    await store.commit("session", s.id, value);
                  }}
                  canDelete={store.sessions.length > 1}
                />
              ))}
            </div>
          </main>
        )}
      </div>
      <div className="sr-only" role="status">{toast.visible ? toast.text : ""}</div>
      <div className="toast" aria-hidden="true" data-visible={toast.visible}>
        <Check size={16} />
        {toast.text}
      </div>
      {modal === "settings" && (
        <Modal title="設定" onClose={() => setModal(null)}>
          <Settings
            value={store.settings}
            save={(s) => store.commit("settings", "settings", s)}
            ops={store.ops}
            importOps={store.importOps}
          />
        </Modal>
      )}
      {modal === "account" && (
        <Modal title="アカウントと同期" onClose={() => setModal(null)}>
          <div className="stack">
            {auth && googleClientId && (
              <div className="segmented" role="group" aria-label="アカウントと同期">
                <button
                  type="button"
                  className={accountPanel === "login" ? "selected" : ""}
                  aria-pressed={accountPanel === "login"}
                  onClick={() => setAccountPanel("login")}
                >
                  アカウント
                </button>
                <button
                  type="button"
                  className={accountPanel === "drive" ? "selected" : ""}
                  aria-pressed={accountPanel === "drive"}
                  onClick={() => setAccountPanel("drive")}
                >
                  Google Drive
                </button>
              </div>
            )}
            {accountPanel === "login" ? (
              <Account
                user={account.user}
                ready={account.ready}
                recovery={account.recovery}
                doneRecovery={() => account.setRecovery(false)}
              />
            ) : (
              <DriveSync
                user={store.driveUser}
                signIn={store.signIn}
                signOut={store.signOut}
                loaded={store.loaded}
                error={store.error}
                importGuest={store.importGuest}
                sync={store.sync}
                status={store.syncStatus}
              />
            )}
          </div>
        </Modal>
      )}
      {(modal === "manual" || editing) && (
        <Modal
          title={
            editing ? "記録を編集" : pending ? "結果を記録" : "タイムを入力"
          }
          onClose={() => {
            setModal(null);
            setEditing(null);
          }}
        >
          <SolveForm
            key={editing?.id ?? pending?.id ?? "new"}
            event={editing?.event ?? event}
            solve={editing ?? pending ?? undefined}
            save={async (data) => {
              const s = {
                ...(editing ?? pending ?? newSolve(0, "OK", [])),
                ...data,
              };
              if (editing) {
                await store.commit("solve", s.id, s);
              } else await persistSolve(s);
              setModal(null);
              setEditing(null);
            }}
            remove={
              editing
                ? async () => {
                    await removeSolve(editing);
                    setEditing(null);
                  }
                : undefined
            }
          />
        </Modal>
      )}
      {pending && !timed && !modal && (
        <div className="pending-result">
          <span>結果の入力が必要です。</span>
          <button onClick={() => setModal("manual")}>結果を入力</button>
        </div>
      )}
      {modal === "newSession" && (
        <Modal title="新規セッション" onClose={() => setModal(null)}>
          <SessionForm
            initialEvent={event}
            onSave={async (s) => {
              await store.commit("session", s.id, s);
              setSelected(s.id);
              setModal(null);
            }}
          />
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="操作ガイド" onClose={() => setModal(null)}>
          <div className="help-content">
            <dl>
              <dt>
                <kbd>Space</kbd> / タップ
              </dt>
              <dd>
                長押しして準備完了を待ち、離すと計測を開始します。計測中に押すと停止します。
              </dd>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>
                計測中はDNFとして保存します。インスペクション中は中止します。
              </dd>
              <dt>ショートカット</dt>
              <dd>
                1〜4でタイマー・統計・セッション・練習を開きます。タイマーではRでスクランブルを再生成し、Hでヒントを開閉します。Recall
                TrainerではSpaceで開始・一時停止、Nまたは右矢印で次のケース、Aで答えを表示・非表示にします。
              </dd>
              <dt>インスペクション</dt>
              <dd>
                設定で有効にできます。15秒以上で+2、17秒以上でDNFになります。目隠し種目と最少手数には適用しません。
              </dd>
              <dt>区間計測</dt>
              <dd>
                区間数を設定すると、押すたびに区間を記録し、最後の区間で停止します。
              </dd>
              <dt>平均</dt>
              <dd>
                ao5・ao12などは上下5%を切り上げて除外します。mo3は3回すべての平均です。残った記録にDNFがある場合は平均もDNFです。
              </dd>
              <dt>スクランブル</dt>
              <dd>
                cubing.jsのWCA種目別生成を使用しています。公式大会のスクランブル配布・認定を代替するものではありません。
              </dd>
              <dt>タイマーの精度</dt>
              <dd>
                小数点以下3桁で保存します。ブラウザと入力機器の遅延があるため、公式計測機器と同じ精度を保証するものではありません。
              </dd>
            </dl>
            <button onClick={() => void fullscreen()}>
              <Maximize2 size={16} />
              全画面表示
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function SessionForm({
  initialEvent,
  onSave,
}: {
  initialEvent: EventId;
  onSave: (s: Session) => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [event, setEvent] = useState(initialEvent),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
          await onSave({
            id: crypto.randomUUID(),
            name: name.trim(),
            event,
            createdAt: Date.now(),
          });
        } catch {
          setError("保存できませんでした。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        名前
        <input
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: クロス練習"
        />
      </label>
      <label>
        種目
        <select
          value={event}
          onChange={(e) => setEvent(e.target.value as EventId)}
        >
          {EVENTS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="primary" disabled={busy}>
        作成
      </button>
    </form>
  );
}
function ScrambleSequence({ value, busy }: { value: string; busy: boolean }) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState("");
  if (current !== value) {
    setPrevious(current);
    setCurrent(value);
  }
  return (
    <span className="scramble-frames" translate="no">
      {[previous, value].filter(Boolean).map((sequence, index, frames) => {
        const outgoing = index < frames.length - 1;
        return (
          <span
            key={sequence}
            id={outgoing ? undefined : "current-scramble"}
            className={outgoing ? "scramble-outgoing" : "scramble-sequence"}
            aria-hidden={outgoing || busy || undefined}
          >
            {sequence}
          </span>
        );
      })}
    </span>
  );
}

function SessionRow({
  session,
  count,
  current,
  select,
  save,
  canDelete,
}: {
  session: Session;
  count: number;
  current: boolean;
  select: () => void;
  save: (s: Session) => Promise<void>;
  canDelete: boolean;
}) {
  const [rename, setRename] = useState(false),
    [name, setName] = useState(session.name),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  return (
    <div className={`session-row ${current ? "current" : ""}`}>
      <button className="session-open" onClick={select}>
        <Layers size={22} />
        <span>
          <strong>{session.name}</strong>
          <small>
            {EVENTS.find((e) => e[0] === session.event)![1]} · {count}回
          </small>
        </span>
        {current && <span className="session-current">選択中</span>}
        <ChevronRight size={16} />
      </button>
      <div className="session-row-actions">
        {rename ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              try {
                await save({ ...session, name: name.trim() });
                setRename(false);
              } catch {
                setError("保存できません。");
              }
            }}
          >
            <input
              aria-label="新しいセッション名"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
            <button>保存</button>
          </form>
        ) : (
          <button onClick={() => setRename(true)}>名前を変更</button>
        )}
        <button
          className="danger"
          disabled={!canDelete}
          onClick={async () => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            try {
              await save({ ...session, deleted: true });
            } catch {
              setError("削除できません。");
            }
          }}
        >
          <Trash2 size={15} />
          {confirm ? "セッションを削除する" : "削除"}
        </button>
      </div>
      {confirm && (
        <p className="muted">
          セッションとその記録を一覧から除きます。バックアップには履歴が残ります。
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
