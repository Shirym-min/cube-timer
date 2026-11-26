import { CircleHelp, ChevronRight, CircleUserRound, LogIn, RefreshCw } from "lucide-react";
import { pageTitles, type Page } from "../../navigation";

export function TopBar({
  page, sessionName, locked, hasAccount, hasDrive, syncing, canSync, sync, openAccount, openHelp,
}: {
  page: Page;
  sessionName: string | undefined;
  locked: boolean;
  hasAccount: boolean;
  hasDrive: boolean;
  syncing: boolean;
  canSync: boolean;
  sync: () => Promise<void>;
  openAccount: () => void;
  openHelp: () => void;
}) {
  const accountLabel = hasAccount || hasDrive ? "アカウント" : "ログイン";
  const syncLabel = syncing ? "同期中" : "同期";
  return (
    <header className="topbar" data-page={page}>
      <div className="breadcrumb">
        <span>{pageTitles[page]}</span>
        {(page === "timer" || page === "stats") && (
          <>
            <ChevronRight size={14} />
            <span className="current-session">
              {sessionName ?? "読み込み中"}
            </span>
          </>
        )}
      </div>
      <div className="topbar-actions">
        <button className="icon-button account-button mobile-help" aria-label="操作ガイド"
          onClick={openHelp} disabled={locked}><CircleHelp size={19} /></button>
        {hasDrive && page !== "video" && (
          <button
            type="button"
            className="icon-button account-button"
            aria-label={syncLabel}
            title={syncLabel}
            aria-busy={syncing}
            onClick={() => void sync()}
            disabled={locked || !canSync || syncing}
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="icon-button account-button"
          aria-label={accountLabel}
          title={accountLabel}
          onClick={openAccount}
          disabled={locked}
        >
          {hasAccount || hasDrive
            ? <CircleUserRound size={20} aria-hidden="true" />
            : <LogIn size={20} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
