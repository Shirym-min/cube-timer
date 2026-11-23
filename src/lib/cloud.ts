import { createClient } from "@supabase/supabase-js";
import { validOperation, type Operation } from "./model";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloud = url && key ? createClient(url, key) : null;
export async function syncOps(
  userId: string,
  local: Operation[],
): Promise<Operation[]> {
  if (!cloud) throw Error("同期先が設定されていません。");
  const remote: Operation[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await cloud
      .from("timer_operations")
      .select("operation")
      .eq("user_id", userId)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    for (const row of data) {
      if (!validOperation(row.operation))
        throw Error("クラウドのデータ形式を確認できません。");
      remote.push(row.operation);
    }
    if (data.length < 1000) break;
  }
  const ids = new Set(remote.map((o) => o.id)),
    pending = local.filter((o) => !ids.has(o.id));
  for (let i = 0; i < pending.length; i += 100) {
    const { error } = await cloud.from("timer_operations").upsert(
      pending
        .slice(i, i + 100)
        .map((operation) => ({ id: operation.id, user_id: userId, operation })),
      { onConflict: "user_id,id", ignoreDuplicates: true },
    );
    if (error) throw error;
  }
  return [...remote, ...pending];
}
