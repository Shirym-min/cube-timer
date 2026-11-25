import { useEffect } from "react";
import { pageFromURL, pageURL, type FollowPage, type Page } from "./navigation";

export function usePageNavigation({
  page, setPage, resetTimerView, locked, blocked, loaded, scrambleBusy, generate,
}: {
  page: Page;
  setPage: (page: Page) => void;
  resetTimerView: (page: Page) => void;
  locked: boolean;
  blocked: boolean;
  loaded: boolean;
  scrambleBusy: boolean;
  generate: () => Promise<void>;
}) {
  function navigate(next: Page) {
    if (pageFromURL() !== next) history.pushState(null, "", pageURL(next));
    setPage(next);
    resetTimerView(next);
  }

  const followPage: FollowPage = (e, next) => {
    if (locked || blocked) {
      e.preventDefault();
      return;
    }
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(next);
  };

  useEffect(() => {
    const onPopState = () => {
      const next = pageFromURL();
      if (next === page) return;
      if (locked || blocked) {
        history.replaceState(history.state, "", pageURL(page));
        return;
      }
      resetTimerView(next);
      setPage(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [page, locked, blocked, resetTimerView, setPage]);

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        page === "virtual" ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.shiftKey ||
        locked ||
        blocked ||
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
        loaded
      ) {
        e.preventDefault();
        void generate();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [
    locked,
    blocked,
    page,
    scrambleBusy,
    loaded,
    generate,
    resetTimerView,
    setPage,
  ]);

  return { navigate, followPage };
}
