import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Check, X } from "lucide-react";
import { AppDialogs, type AccountPanel, type ModalKind } from "./components/AppDialogs/AppDialogs";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TopBar } from "./components/TopBar/TopBar";
import { auth, useAuth } from "./lib/auth";
import type { Session, Solve } from "./lib/model";
import { useSession } from "./lib/useSession";
import { useStore } from "./lib/useStore";
import { useTheme } from "./lib/useTheme";
import { useToast } from "./lib/useToast";
import { pageFromURL, pageTitles, type Page } from "./navigation";
import { SessionsPage } from "./pages/SessionsPage";
import { ToolPage } from "./pages/ToolPage";
import { ToolsPage } from "./pages/ToolsPage";
import { StatsPage } from "./pages/stats/StatsPage";
import { StatsRecordsPage } from "./pages/stats/StatsRecordsPage";
import { useStatistics } from "./pages/stats/useStatistics";
import { TimerPage, type MobileTimerTab } from "./pages/timer/TimerPage";
import { useTimerSession } from "./pages/timer/useTimerSession";
import { usePageNavigation } from "./usePageNavigation";

export default function App() {
  const account = useAuth();
  const store = useStore(account.user?.id, account.ready);
  const { session, event, solves, setSelected, changeEvent } = useSession(store);
  const [page, setPage] = useState(pageFromURL);
  const [modal, setModal] = useState<ModalKind>(null);
  const [accountPanel, setAccountPanel] = useState<AccountPanel>("login");
  const [editing, setEditing] = useState<Solve | null>(null);
  const [focus, setFocus] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTimerTab>("timer");
  // These values survive navigation away from the timer.
  const [manualMode, setManualMode] = useState(false);
  const [manualCount, setManualCount] = useState(0);
  const [search, setSearch] = useState("");
  const precision = store.settings.precision;
  const blocked = !!(modal || editing);
  const openManual = () => setModal("manual");
  const openNewSession = () => setModal("newSession");

  useEffect(() => {
    if (account.recovery) {
      setAccountPanel("login");
      setModal("account");
    }
  }, [account.recovery]);

  const previousPage = useRef(page);
  useEffect(() => {
    document.title = `${pageTitles[page]} · SPLIT`;
    if (previousPage.current === page) return;
    previousPage.current = page;
    const focusPage = () => {
      const main = document.querySelector<HTMLElement>("main#main-content:not(.loading-screen)");
      if (!main?.getClientRects().length) return false;
      main.scrollTop = 0;
      main.focus({ preventScroll: true });
      return true;
    };
    window.scrollTo({ top: 0, behavior: "instant" });
    if (focusPage()) return;
    // Lazy-loaded tools replace the loading screen after the route changes.
    const observer = new MutationObserver(() => {
      if (focusPage()) observer.disconnect();
    });
    observer.observe(document.querySelector(".app-main")!, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [page]);

  const { toast, notify } = useToast();
  // Keep the period and chart controls between the statistics and records pages.
  const stats = useStatistics(solves, event, precision, page);
  const timer = useTimerSession(session, event, store.commit, openManual, notify);
  const { locked } = timer;
  useTheme(store.settings);

  const resetTimerView = useCallback((next: Page) => {
    setFocus(false);
    if (next === "timer") setMobileTab("timer");
  }, []);
  const { navigate, followPage } = usePageNavigation({
    page, setPage, resetTimerView, locked, blocked, loaded: store.loaded,
    scrambleBusy: timer.scramble.scrambleBusy, generate: timer.scramble.generate,
  });

  function openAccount() {
    setAccountPanel(auth ? "login" : "drive");
    setModal("account");
  }

  async function saveSession(value: Session) {
    await store.commit("session", value.id, value);
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

  function renderPage() {
    if (!store.loaded) {
      return (
        <main id="main-content" tabIndex={-1} className="loading-screen">
          <Box size={32} />
          <p>記録を読み込んでいます…</p>
          {store.error && (
            <button onClick={() => location.reload()}>再読み込み</button>
          )}
        </main>
      );
    }
    if (!session) {
      return (
        <main id="main-content" tabIndex={-1} className="loading-screen">
          <p>セッションがありません。</p>
          <button className="primary" onClick={openNewSession}>
            セッションを作成
          </button>
        </main>
      );
    }

    switch (page) {
      case "timer":
        return (
          <TimerPage
            session={session} sessions={store.sessions} event={event}
            solves={solves} settings={store.settings} setSelected={setSelected}
            changeEvent={changeEvent} timer={timer} stats={stats}
            mobileTab={mobileTab} setMobileTab={setMobileTab}
            focus={focus} setFocus={setFocus} blocked={blocked}
            manualMode={manualMode} setManualMode={setManualMode} manualCount={manualCount}
            incrementManualCount={() => setManualCount((count) => count + 1)}
            search={search} setSearch={setSearch} followPage={followPage}
            openManual={openManual} openNewSession={openNewSession} setEditing={setEditing}
          />
        );
      case "stats":
        return (
          <StatsPage
            session={session} sessions={store.sessions} event={event}
            precision={precision} timed={timer.timed} stats={stats}
            setSelected={setSelected} setEditing={setEditing}
            showRecords={() => navigate("stats-records")}
          />
        );
      case "stats-records":
        return (
          <StatsRecordsPage
            session={session} event={event} precision={precision}
            stats={stats} followPage={followPage} setEditing={setEditing}
          />
        );
      case "sessions":
        return (
          <SessionsPage
            sessions={store.sessions} solves={store.solves} selectedId={session.id}
            openNewSession={openNewSession} saveSession={saveSession}
            selectSession={(id) => {
              setSelected(id);
              navigate("timer");
            }}
          />
        );
      case "practice":
        return <ToolsPage followPage={followPage} />;
      default:
        return <ToolPage page={page} followPage={followPage} navigate={navigate} />;
    }
  }

  return (
    <div
      className={`app ${focus ? "focus-mode" : ""} ${timer.phase === "running" || timer.phase === "inspection" ? "is-running" : ""}`}
      onClickCapture={(e) =>
        e.currentTarget.toggleAttribute("data-pointer-motion", e.detail > 0)
      }
      onKeyDownCapture={(e) => e.currentTarget.removeAttribute("data-pointer-motion")}
    >
      {!locked && <a className="skip-link" href="#main-content">本文へ移動</a>}
      <Sidebar
        page={page} locked={locked} followPage={followPage}
        openHelp={() => setModal("help")} openSettings={() => setModal("settings")}
      />
      <div className="app-main">
        <TopBar
          page={page} sessionName={session?.name} locked={locked}
          hasAccount={!!account.user} hasDrive={!!store.driveUser}
          syncing={store.syncStatus === "同期中"} canSync={store.loaded}
          sync={store.sync} openAccount={openAccount} openHelp={() => setModal("help")}
        />
        {store.error && (modal !== "account" || accountPanel !== "drive") && (
          <div className="error-banner" role="alert">
            <span>{store.error}</span>
            <button onClick={() => store.setError("")} aria-label="通知を閉じる">
              <X size={16} />
            </button>
          </div>
        )}
        {renderPage()}
      </div>
      <div className="sr-only" role="status">{toast.visible ? toast.text : ""}</div>
      <div className="toast" aria-hidden="true" data-visible={toast.visible}>
        <Check size={16} />
        {toast.text}
      </div>
      <AppDialogs
        store={store} account={account} modal={modal} setModal={setModal}
        accountPanel={accountPanel} setAccountPanel={setAccountPanel}
        editing={editing} setEditing={setEditing} event={event} timer={timer}
        setSelected={setSelected} fullscreen={fullscreen}
      />
    </div>
  );
}
