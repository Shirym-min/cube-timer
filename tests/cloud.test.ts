import { beforeEach, expect, it, vi } from "vitest";
import type { Operation } from "../src/lib/model";
const mock = vi.hoisted(() => ({
  remote: [] as Operation[],
  uploaded: [] as { id: string; user_id: string; operation: Operation }[],
  scopes: [] as string[],
  error: null as null | { message: string },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_key: string, user: string) => {
          mock.scopes.push(user);
          return {
            order: () => ({
              range: async (from: number, to: number) => ({
                data: mock.remote
                  .slice(from, to + 1)
                  .map((operation) => ({ operation })),
                error: mock.error,
              }),
            }),
          };
        },
      }),
      upsert: async (rows: typeof mock.uploaded) => {
        mock.uploaded.push(...rows);
        return { error: mock.error };
      },
    }),
  }),
}));
vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-test-key");
const { syncOps } = await import("../src/lib/cloud");
function op(): Operation {
  const sid = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    entityId: sid,
    kind: "session",
    stamp: 1,
    value: { id: sid, name: "Practice", event: "333", createdAt: 1 },
  };
}
beforeEach(() => {
  mock.remote = [];
  mock.uploaded = [];
  mock.scopes = [];
  mock.error = null;
});
it("retrieves paginated remote operations and uploads only missing local operations scoped to the user", async () => {
  mock.remote = Array.from({ length: 1001 }, op);
  const local = op();
  const result = await syncOps("user-a", [mock.remote[0], local]);
  expect(result).toHaveLength(1002);
  expect(mock.scopes).toEqual(["user-a", "user-a"]);
  expect(mock.uploaded).toEqual([
    { id: local.id, user_id: "user-a", operation: local },
  ]);
});
it("does not upload after a failed pull or malformed remote data", async () => {
  mock.error = { message: "offline" };
  await expect(syncOps("user-a", [op()])).rejects.toEqual({
    message: "offline",
  });
  expect(mock.uploaded).toHaveLength(0);
  mock.error = null;
  mock.remote = [{} as Operation];
  await expect(syncOps("user-a", [op()])).rejects.toThrow();
  expect(mock.uploaded).toHaveLength(0);
});
