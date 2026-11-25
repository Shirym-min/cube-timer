import { Box, ChartNoAxesCombined, Keyboard, Layers, Settings2, Timer, Wrench } from "lucide-react";
import { isToolPage, pageURL, type FollowPage, type Page } from "../navigation";

const destinations = [
  ["timer", "タイマー", Timer, "1"],
  ["stats", "統計", ChartNoAxesCombined, "2"],
  ["sessions", "セッション", Layers, "3"],
  ["practice", "ツール", Wrench, "4"],
] as const;

export function Sidebar({ page, locked, followPage, openHelp, openSettings }: {
  page: Page;
  locked: boolean;
  followPage: FollowPage;
  openHelp: () => void;
  openSettings: () => void;
}) {
  return (
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
        {destinations.map(([key, label, Icon, shortcut]) => {
          const active = page === key ||
            (key === "stats" && page === "stats-records") ||
            (key === "practice" && isToolPage(page));
          return (
            <a
              key={key}
              href={locked ? undefined : pageURL(key)}
              aria-disabled={locked || undefined}
              aria-label={label}
              title={label}
              aria-current={active ? "page" : undefined}
              className={active ? "active" : ""}
              onClick={(e) => followPage(e, key)}
            >
              <Icon size={19} />
              <span>{label}</span>
              <kbd className="shortcut-hint nav-shortcut" aria-hidden="true">{shortcut}</kbd>
            </a>
          );
        })}
      </nav>
      <div className="rail-bottom">
        <button aria-label="操作ガイド" disabled={locked} onClick={openHelp}>
          <Keyboard size={19} />
          <span>操作ガイド</span>
        </button>
        <button aria-label="設定" disabled={locked} onClick={openSettings}>
          <Settings2 size={19} />
          <span>設定</span>
        </button>
        <div className="rail-caption">
          CUBE TIMER <span>v1.0</span>
        </div>
      </div>
    </aside>
  );
}
