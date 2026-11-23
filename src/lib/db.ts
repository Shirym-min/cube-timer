import type { Operation } from "./model";
let db: Promise<IDBDatabase> | undefined;
function open() {
  return (db ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("split-timer", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("operations", { keyPath: "key" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function readOps(scope: string): Promise<Operation[]> {
  const d = await open();
  return new Promise((resolve, reject) => {
    const r = d
      .transaction("operations")
      .objectStore("operations")
      .getAll(IDBKeyRange.bound(`${scope}:`, `${scope}:\uffff`));
    r.onsuccess = () => resolve(r.result.map(({ op }) => op));
    r.onerror = () => reject(r.error);
  });
}
export async function writeOps(scope: string, ops: Operation[]) {
  const d = await open();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction("operations", "readwrite");
    for (const op of ops)
      t.objectStore("operations").put({ key: `${scope}:${op.id}`, op });
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? Error("保存が中断されました"));
  });
}
