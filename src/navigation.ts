import type { MouseEvent } from "react";

const pages = ["timer", "stats", "stats-records", "sessions", "practice", "recall", "algorithms", "video", "bld", "bld-guide", "virtual"] as const;
export type Page = (typeof pages)[number];

export function pageFromURL(): Page {
  const value = new URLSearchParams(location.search).get("page");
  return pages.find((page) => page === value) ?? "timer";
}

export function pageURL(page: Page) {
  const url = new URL(location.href);
  if (page === "timer") url.searchParams.delete("page");
  else url.searchParams.set("page", page);
  if (url.hash === "#main-content") url.hash = "";
  return `${url.pathname}${url.search}${url.hash}`;
}


export type FollowPage = (event: MouseEvent<HTMLAnchorElement>, page: Page) => void;

export const pageTitles: Record<Page, string> = {
  timer: "タイマー",
  stats: "統計",
  "stats-records": "統計の記録",
  sessions: "セッション",
  practice: "ツール",
  recall: "Recall Trainer",
  algorithms: "アルゴリズム集",
  video: "動画解析",
  bld: "BLD トレーナー",
  "bld-guide": "BLD トレーナー",
  virtual: "バーチャルキューブ",
};

export function isToolPage(page: Page) {
  return page === "recall" || page === "algorithms" || page === "video" ||
    page === "bld" || page === "bld-guide" || page === "virtual";
}
