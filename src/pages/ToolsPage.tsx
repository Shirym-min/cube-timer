import { Timer, BookOpen, Box, ScanEye, ChevronRight, Film, GraduationCap } from "lucide-react";
import { pageURL, type FollowPage } from "../navigation";

export function ToolsPage({ followPage }: { followPage: FollowPage }) {
  return (
    <main id="main-content" tabIndex={-1} className="page-content practice-page">
      <header className="page-heading">
        <h1>ツール</h1>
      </header>
      <div className="practice-options">
        <a className="action-link practice-item" href={pageURL("algorithm-timer")}
          onClick={(e) => followPage(e, "algorithm-timer")}>
          <span className="practice-icon"><Timer size={23} /></span>
          <strong>アルゴリズム計測</strong>
          <ChevronRight size={18} aria-hidden="true" />
        </a>
        <a className="action-link practice-item" href={pageURL("virtual")}
          onClick={(e) => followPage(e, "virtual")}>
          <span className="practice-icon"><Box size={23} /></span>
          <span><strong>バーチャルキューブ</strong><small>キーやタッチで3×3を回す</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </a>
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
          <span className="practice-icon"><ScanEye size={23} /></span>
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
  );
}
