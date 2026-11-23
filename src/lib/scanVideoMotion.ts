import { CAPTURE_FPS, pixelChange, regionBounds, type Interval, type Region, type Sample } from "./solveVideo";
import { readStickerPixels, type Point, type RGB } from "./cubeVideoTracking";

export async function scanVideoMotion(
  video: HTMLVideoElement,
  { start, end }: Interval,
  slowdown: number,
  region: Region,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
  stickers: Point[],
  onStickers: (time: number, colors: (RGB | null)[]) => void,
): Promise<Sample[]> {
  if (typeof video.requestVideoFrameCallback !== "function") {
    throw Error("このブラウザでは停止候補を検出できません。");
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw Error("動画のフレームを読み取れませんでした。");
  const cubeCanvas = document.createElement("canvas");
  const scale = 360 / Math.max(video.videoWidth, video.videoHeight);
  cubeCanvas.width = Math.max(3, Math.round(video.videoWidth * scale));
  cubeCanvas.height = Math.max(3, Math.round(video.videoHeight * scale));
  const cubeContext = cubeCanvas.getContext("2d", { willReadFrequently: true });
  if (!cubeContext) throw Error("キューブの色を読み取れませんでした。");

  const { left, top, side } = regionBounds(region, video.videoWidth, video.videoHeight);
  const playbackTime = video.currentTime;
  const playbackRate = video.playbackRate;
  const muted = video.muted;
  const samples: Sample[] = [];
  // Keep a 120 fps source below the typical display refresh rate during the scan.
  const frameSpacing = slowdown / CAPTURE_FPS;
  video.pause();
  video.muted = true;
  video.playbackRate = Math.min(1, 30 * frameSpacing);
  try {
    return await new Promise<Sample[]>((resolve, reject) => {
      let previous: Uint8ClampedArray | undefined;
      let frameId = 0;
      let watchdog: ReturnType<typeof setTimeout>;
      let active = true;

      const cleanUp = () => {
        active = false;
        clearTimeout(watchdog);
        video.cancelVideoFrameCallback(frameId);
        video.removeEventListener("seeked", play);
        video.removeEventListener("ended", finish);
        video.removeEventListener("error", fail);
        signal.removeEventListener("abort", abort);
      };
      const finish = () => {
        cleanUp();
        if (samples.length < 2) reject(Error("解析に必要なフレームを読み取れませんでした。"));
        else resolve(samples);
      };
      const fail = (error?: unknown) => {
        if (!active) return;
        cleanUp();
        reject(error instanceof Error ? error : Error("動画の読み取りが中断されました。"));
      };
      const abort = () => fail(new DOMException("Abort", "AbortError"));
      const resetWatchdog = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => fail(Error("動画の読み取りが止まりました。動画を表示した状態でもう一度お試しください。")), 8000);
      };
      const readFrame = (time: number) => {
        const last = samples.at(-1);
        if (last && time <= last.time) return;
        context.drawImage(video, left, top, side, side, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        // A missing stretch is unknown, even if the frames on either side match.
        const change = previous && last && time - last.time <= frameSpacing * 2.5
          ? pixelChange(previous, pixels)
          : null;
        samples.push({ time, change });
        previous = pixels;
        cubeContext.drawImage(video, 0, 0, cubeCanvas.width, cubeCanvas.height);
        onStickers(time, readStickerPixels(cubeContext, stickers));
        onProgress((time - start) / (end - start));
      };
      const capture: VideoFrameRequestCallback = (_, { mediaTime }) => {
        try {
          if (mediaTime > end) return finish();
          if (mediaTime >= start - 0.0001) readFrame(Math.max(start, mediaTime));
          resetWatchdog();
          frameId = video.requestVideoFrameCallback(capture);
        } catch (error) {
          fail(error);
        }
      };
      function play() {
        try {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) readFrame(start);
          frameId = video.requestVideoFrameCallback(capture);
          void video.play().catch(fail);
        } catch (error) {
          fail(error);
        }
      }
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) return abort();
      video.addEventListener("ended", finish);
      video.addEventListener("error", fail);
      resetWatchdog();
      if (video.currentTime === start && !video.seeking) play();
      else {
        video.addEventListener("seeked", play, { once: true });
        video.currentTime = start;
      }
    });
  } finally {
    video.pause();
    video.muted = muted;
    video.playbackRate = playbackRate;
    // The caller may have left the workspace and detached the video.
    if (video.isConnected && Number.isFinite(video.duration)) video.currentTime = playbackTime;
  }
}
