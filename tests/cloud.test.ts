import { afterEach, expect, it, vi } from "vitest";
import { DriveAuthorizationError, syncOps } from "../src/lib/cloud";
import { materialize, type Operation } from "../src/lib/model";

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

function drive(initial: unknown[][] = []) {
  const files = new Map(initial.map((batch, i) => [String(i), batch]));
  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token");
    if (init?.method === "POST") {
      expect(url.searchParams.get("uploadType")).toBe("multipart");
      const parts = String(init.body).split("\r\n");
      expect(JSON.parse(parts[3]).parents).toEqual(["appDataFolder"]);
      const id = String(files.size);
      files.set(id, JSON.parse(parts[7]));
      return Response.json({ id });
    }
    if (url.searchParams.has("alt"))
      return Response.json(files.get(url.pathname.split("/").at(-1)!));
    expect(url.searchParams.get("spaces")).toBe("appDataFolder");
    const index = Number(url.searchParams.get("pageToken") ?? 0);
    const id = [...files.keys()][index];
    return Response.json({
      files: id === undefined ? [] : [{ id }],
      nextPageToken: index + 1 < files.size ? String(index + 1) : undefined,
    });
  });
  vi.stubGlobal("fetch", fetch);
  return { files, fetch };
}

afterEach(() => vi.unstubAllGlobals());

it("restores the algorithm and pattern with a practice result on a second device", async () => {
  drive();
  const entityId = crypto.randomUUID();
  const solve: Operation = {
    id: crypto.randomUUID(), entityId, kind: "solve", stamp: 1,
    value: {
      id: entityId, sessionId: "algorithm-practice", event: "333",
      practice: { algorithm: "PLL", pattern: "Ja Perm" },
      ms: 1980, penalty: "OK", splits: [], scramble: "R U R'", createdAt: 1, comment: "",
    },
  };
  await syncOps("token", [solve]);
  expect(materialize(await syncOps("token", [])).solves).toEqual([solve.value]);
});

it("reads every page and uploads only missing operations", async () => {
  const first = op(), second = op(), local = op();
  const { files } = drive([[first], [second, first]]);
  expect(await syncOps("token", [first, local])).toEqual([first, second, local]);
  expect(files.get("2")).toEqual([local]);
  expect(await syncOps("token", [first, local])).toEqual([first, second, local]);
  expect(files.size).toBe(3);
});

it("preserves simultaneous uploads from two devices and converges after the next sync", async () => {
  const base = op(), onA = op(), onB = op();
  const edit = { ...base, id: crypto.randomUUID(), stamp: 2, value: { ...base.value, name: "Edited" } };
  const deletion = { ...base, id: crypto.randomUUID(), stamp: 3, value: { ...base.value, deleted: true } };
  const { files } = drive([[base]]);
  await Promise.all([
    syncOps("token", [base, edit, onA]),
    syncOps("token", [base, deletion, onB]),
  ]);
  expect(files.size).toBe(3);
  const a = await syncOps("token", [base, edit, onA]);
  const b = await syncOps("token", [base, deletion, onB]);
  expect(a).toEqual(b);
  expect(a).toHaveLength(5);
  expect(new Set(materialize(a).sessions.map(({ id }) => id))).toEqual(new Set([onA.entityId, onB.entityId]));
});

it("does not upload when authentication fails or a batch cannot be read", async () => {
  const { fetch, files } = drive([[{}]]);
  fetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
  await expect(syncOps("token", [op()])).rejects.toBeInstanceOf(DriveAuthorizationError);
  await expect(syncOps("token", [op()])).rejects.toThrow("履歴を読み込めませんでした");
  expect(files.size).toBe(1);
  expect(fetch.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
});
