import { useEffect, useMemo, useState } from "react";
import { EVENTS, type EventId, type Session } from "./model";
import type { useStore } from "./useStore";

export function useSession(store: ReturnType<typeof useStore>) {
  const [selected, setSelectedState] = useState("");
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
  const session = store.sessions.find((s) => s.id === selected) ?? store.sessions[0];
  const event = session?.event ?? "333";
  const solves = useMemo(
    () => store.solves.filter((s) => s.sessionId === session?.id),
    [store.solves, session?.id],
  );
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

  return { session, event, solves, setSelected, changeEvent };
}
