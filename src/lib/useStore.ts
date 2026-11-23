import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { cloud, syncOps } from "./cloud";
import { readOps, writeOps } from "./db";
import { materialize, validOperation, type Operation } from "./model";
export function useStore() {
  const [user, setUser] = useState<User | null>(null),
    [ops, setOps] = useState<Operation[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [syncStatus, setSyncStatus] = useState("端末に保存"),
    [recovery, setRecovery] = useState(false);
  const scope = useRef("guest"),
    opsRef = useRef(ops),
    busy = useRef(false),
    channel = useRef<BroadcastChannel | null>(null);
  const update = (next: Operation[]) => {
    opsRef.current = next;
    setOps(next);
  };
  const merge = (incoming: Operation[]) => {
    const m = new Map(opsRef.current.map((o) => [o.id, o]));
    incoming.forEach((o) => m.set(o.id, o));
    update([...m.values()]);
  };
  useEffect(() => {
    if (!cloud) {
      setReady(true);
      return;
    }
    const { data } = cloud.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const name = user?.id ?? "guest";
    scope.current = name;
    update([]);
    setLoaded(false);
    setError("");
    setSyncStatus(user ? "同期待ち" : "端末に保存");
    let active = true;
    readOps(name)
      .then(async (data) => {
        if (!active) return;
        if (!data.length) {
          const now = 0,
            sid = "00000000-0000-4000-8000-000000000001";
          data = [
            {
              id: "00000000-0000-4000-8000-000000000002",
              entityId: sid,
              kind: "session",
              stamp: now,
              value: {
                id: sid,
                name: "メインセッション",
                event: "333",
                createdAt: now,
              },
            },
          ];
          await writeOps(name, data);
        }
        if (active) {
          update(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "端末に保存できません。ブラウザのストレージ設定と空き容量を確認してください。",
          );
      });
    return () => {
      active = false;
    };
  }, [user?.id, ready]);
  const sync = useCallback(async () => {
    if (!user || !loaded || busy.current) return;
    const name = user.id;
    busy.current = true;
    setSyncStatus("同期中");
    try {
      const all = await syncOps(name, opsRef.current);
      await writeOps(name, all);
      if (scope.current === name) {
        merge(all);
        const syncedIds = new Set(all.map((o) => o.id));
        setSyncStatus(
          opsRef.current.every((o) => syncedIds.has(o.id))
            ? "同期済み"
            : "同期待ち",
        );
        setError("");
        channel.current?.postMessage(name);
      }
    } catch (e) {
      if (scope.current === name) {
        setSyncStatus("同期を再試行");
        setError(
          `同期できません。端末の記録は残っています。${e instanceof Error ? e.message : ""}`,
        );
      }
    } finally {
      busy.current = false;
    }
  }, [user, loaded]);
  useEffect(() => {
    if (!loaded) return;
    void sync();
    const t = setInterval(() => void sync(), 30000);
    const online = () => void sync();
    window.addEventListener("online", online);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", online);
    };
  }, [sync, loaded]);
  useEffect(() => {
    if (!loaded || !user) return;
    const t = setTimeout(() => void sync(), 1500);
    return () => clearTimeout(t);
  }, [ops.length, user, loaded, sync]);
  useEffect(() => {
    const c = new BroadcastChannel("split-storage");
    channel.current = c;
    c.onmessage = () => {
      const name = scope.current;
      readOps(name)
        .then((data) => {
          if (scope.current === name) merge(data);
        })
        .catch(() => setError("別タブの記録を読み込めません。"));
    };
    return () => c.close();
  }, []);
  async function commit(
    kind: Operation["kind"],
    entityId: string,
    value: Operation["value"],
  ) {
    if (!loaded) throw Error("記録の読み込み中です。");
    const name = scope.current;
    const stamp = opsRef.current.reduce(
      (n, o) => Math.max(n, o.stamp + 1),
      Date.now(),
    );
    const op: Operation = {
      id: crypto.randomUUID(),
      entityId,
      kind,
      value,
      stamp,
    };
    if (!validOperation(op)) throw Error("入力内容を確認してください。");
    try {
      await writeOps(name, [op]);
      if (scope.current === name) {
        merge([op]);
        setSyncStatus(user ? "同期待ち" : "端末に保存");
      }
      channel.current?.postMessage(name);
    } catch (e) {
      setError(
        "記録を保存できません。空き容量を確認して、もう一度保存してください。",
      );
      throw e;
    }
  }
  async function importOps(incoming: Operation[]) {
    if (!incoming.every(validOperation))
      throw Error("読み込めないデータが含まれています。");
    const name = scope.current;
    await writeOps(name, incoming);
    if (name === scope.current) {
      merge(incoming);
      setSyncStatus(user ? "同期待ち" : "端末に保存");
    }
    channel.current?.postMessage(name);
  }
  const state = useMemo(() => materialize(ops), [ops]);
  return {
    ...state,
    ops,
    user,
    loaded: loaded && scope.current === (user?.id ?? "guest"),
    error,
    setError,
    syncStatus,
    sync,
    commit,
    importOps,
    recovery,
    setRecovery,
    importGuest: async () => importOps(await readOps("guest")),
  };
}
