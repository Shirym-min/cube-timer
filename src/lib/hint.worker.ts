import { solveHint } from "./solver";
self.onmessage = async (
  e: MessageEvent<{ scramble: string; face: string; xcross: boolean }>,
) => {
  try {
    self.postMessage({
      result: await solveHint(e.data.scramble, e.data.face, e.data.xcross),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "探索に失敗しました。",
    });
  }
};
