import { generateCommutator, type Orbit } from "./bld";

self.onmessage = async (event: MessageEvent<{ id?: number; orbit: Orbit; letters: string[] }>) => {
  const { id, orbit, letters } = event.data;
  try {
    self.postMessage({ id, result: await generateCommutator(orbit, letters) });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "手順を生成できませんでした。",
    });
  }
};
