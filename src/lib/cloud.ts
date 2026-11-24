import { validOperation, type Operation } from "./model";

const driveURL = "https://www.googleapis.com/drive/v3";
const driveScope = "https://www.googleapis.com/auth/drive.appdata";
const batchName = "cube-timer-operations-v1.json";
export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

export type DriveUser = { id: string; email: string };
type DriveToken = { value: string; expiresAt: number };
type TokenResponse = {
  access_token?: string;
  expires_in: string;
  scope: string;
};
type GoogleOAuth = {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    include_granted_scopes: boolean;
    login_hint?: string;
    callback: (response: TokenResponse) => void;
    error_callback: (error: { type: string }) => void;
  }): { requestAccessToken(config: { prompt: string }): void };
};
const googleOAuth = () =>
  (window as Window & { google?: { accounts?: { oauth2?: GoogleOAuth } } })
    .google?.accounts?.oauth2;

let loading: Promise<void> | undefined;
export function loadGoogle() {
  if (googleOAuth()) return Promise.resolve();
  return (loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    const fail = () => {
      script.remove();
      reject(Error("Google ログインを読み込めません。通信状況を確認してください。"));
    };
    script.onerror = fail;
    script.onload = () => (googleOAuth() ? resolve() : fail());
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  }));
}

export class DriveAuthorizationError extends Error {}

async function driveRequest(url: string, token: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401)
    throw new DriveAuthorizationError("もう一度 Google で認証してください。");
  if (!response.ok)
    throw Error(`Google Drive に接続できませんでした（${response.status}）。`);
  return response;
}

export async function authorizeDrive(expected?: DriveUser) {
  const oauth = googleOAuth();
  if (!oauth || !googleClientId)
    throw Error("Google ログインの準備ができていません。もう一度お試しください。");
  const token = await new Promise<DriveToken>((resolve, reject) => {
    oauth.initTokenClient({
      client_id: googleClientId,
      scope: driveScope,
      include_granted_scopes: false,
      login_hint: expected?.email,
      callback: (response) => {
        if (!response.access_token || !response.scope?.split(/\s+/).includes(driveScope)) {
          reject(Error("同期するには Google Drive へのアクセスを許可してください。"));
          return;
        }
        resolve({
          value: response.access_token,
          expiresAt: Date.now() + Number(response.expires_in) * 1000,
        });
      },
      error_callback: ({ type }) => {
        reject(Error(type === "popup_failed_to_open"
          ? "Google ログインを開けません。ポップアップを許可してください。"
          : "Google ログインが完了しませんでした。"));
      },
    }).requestAccessToken({ prompt: expected?.email ? "" : "select_account" });
  });
  const response = await driveRequest(
    `${driveURL}/about?fields=user(permissionId,emailAddress)`,
    token.value,
  );
  const { user } = await response.json();
  if (typeof user?.permissionId !== "string" || !user.permissionId)
    throw Error("Google アカウントを確認できませんでした。");
  if (expected && expected.id !== user.permissionId)
    throw Error("同期に使っている Google アカウントを選んでください。");
  const account: DriveUser = {
    id: user.permissionId,
    email: typeof user.emailAddress === "string" ? user.emailAddress : "",
  };
  return { user: account, token };
}

export async function syncOps(token: string, local: Operation[]): Promise<Operation[]> {
  const remote = new Map<string, Operation>();
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${batchName}' and trashed = false`,
    fields: "nextPageToken,files(id)",
    pageSize: "100",
  });
  do {
    const result = await driveRequest(`${driveURL}/files?${params}`, token);
    const { files = [], nextPageToken } = await result.json() as {
      files?: { id: string }[];
      nextPageToken?: string;
    };
    for (let i = 0; i < files.length; i += 8) {
      const batches = await Promise.all(files.slice(i, i + 8).map(async ({ id }) => {
        const file = await driveRequest(`${driveURL}/files/${encodeURIComponent(id)}?alt=media`, token);
        const ops: unknown = await file.json();
        if (!Array.isArray(ops) || !ops.every(validOperation))
          throw Error("Google Drive の履歴を読み込めませんでした。");
        return ops;
      }));
      for (const batch of batches)
        for (const op of batch) remote.set(op.id, op);
    }
    if (!nextPageToken) break;
    params.set("pageToken", nextPageToken);
  } while (true);

  const pending = local.filter((op) => !remote.has(op.id));
  const encoder = new TextEncoder();
  const byteLimit = 4_000_000;
  let batch: string[] = [];
  let bytes = 2;
  for (const op of pending) {
    const serialized = JSON.stringify(op);
    const size = encoder.encode(serialized).length + 1;
    if (size + 2 > byteLimit)
      throw Error("Google Drive に同期できるサイズを超えた記録があります。");
    if (bytes + size > byteLimit) {
      await uploadBatch(token, batch);
      batch = [];
      bytes = 2;
    }
    batch.push(serialized);
    bytes += size;
  }
  if (batch.length) await uploadBatch(token, batch);
  return [...remote.values(), ...pending];
}

async function uploadBatch(token: string, serializedOps: string[]) {
  // Each sync creates a new file so concurrent uploads cannot overwrite one another.
  const boundary = crypto.randomUUID();
  const metadata = { name: batchName, parents: ["appDataFolder"], mimeType: "application/json" };
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    `[${serializedOps.join(",")}]`,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  await driveRequest("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", token, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}
