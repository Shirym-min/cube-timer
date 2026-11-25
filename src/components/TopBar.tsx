import { ChevronRight, Cloud, RefreshCw } from "lucide-react";
import { pageTitles, type Page } from "../navigation";

export function TopBar({
  page, sessionName, locked, hasAccount, hasDrive, syncing, canSync, sync, openAccount,
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
}) {
  return (
    <header className="topbar">
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
        {hasDrive && page !== "video" && (
          <button
            className="account-button"
            onClick={() => void sync()}
            disabled={locked || !canSync || syncing}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{syncing ? "同期中" : "同期"}</span>
          </button>
        )}
        <button
          className="account-button"
          onClick={openAccount}
          disabled={locked}
        >
          <Cloud size={17} />
          <span>{hasAccount || hasDrive ? "アカウント" : "ログイン"}</span>
        </button>
      </div>
    </header>
  );
}
