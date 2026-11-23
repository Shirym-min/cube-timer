import { useEffect, useId, useRef, useState } from "react";
import { Lightbulb, Play, X } from "lucide-react";
import { TwistyPlayer } from "cubing/twisty";
import type { Settings } from "../lib/model";
export function Hint({
  scramble,
  face,
  kind,
  disabled,
}: {
  scramble: string;
  face: Settings["hintFace"];
  kind: Settings["hintType"];
  disabled: boolean;
}) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    popover = useRef<HTMLDivElement>(null),
    preview = useRef<HTMLDivElement>(null),
    pointerOffset = useRef<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{ alg: string; depth: number } | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [showPreview, setShowPreview] = useState(false);
  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "KeyH" || event.defaultPrevented || event.repeat ||
        event.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
        event.shiftKey || document.querySelector("dialog[open]")
      ) return;
      if (event.target instanceof HTMLElement &&
          (event.target.isContentEditable || event.target.closest("input, textarea, select"))) return;
      const button = trigger.current;
      if (!button?.getClientRects().length || getComputedStyle(button).visibility !== "visible") return;
      event.preventDefault();
      popover.current?.removeAttribute("data-pointer-motion");
      if (popover.current?.matches(":popover-open")) {
        popover.current.hidePopover();
      } else {
        button.scrollIntoView({ block: "nearest", inline: "nearest" });
        button.click();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled]);
  function position() {
    const b = trigger.current?.getBoundingClientRect(),
      p = popover.current;
    if (!b || !p) return;
    const width = Math.min(360, innerWidth - 32);
    const above = b.top >= 240;
    p.style.width = `${width}px`;
    const left = Math.max(16, Math.min(b.right - width, innerWidth - width - 16));
    p.style.left = `${left}px`;
    const x = b.left + (pointerOffset.current?.x ?? b.width / 2) - left;
    const y = pointerOffset.current?.y ?? b.height / 2;
    p.style.transformOrigin = above
      ? `${x}px calc(100% + ${8 + y}px)`
      : `${x}px ${y - b.height - 8}px`;
    p.style.top = above ? "auto" : `${b.bottom + 8}px`;
    p.style.bottom = above ? `${innerHeight - b.top + 8}px` : "auto";
    p.style.maxHeight = `${Math.max(120, above ? b.top - 24 : innerHeight - b.bottom - 24)}px`;
  }
  useEffect(() => {
    const p = popover.current;
    if (p?.matches(":popover-open")) p.hidePopover();
    setOpen(false);
    setResult(null);
    setShowPreview(false);
  }, [scramble, face, kind, disabled]);
  useEffect(() => {
    if (!open) return;
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError("");
    setBusy(true);
    setShowPreview(false);
    const worker = new Worker(
      new URL("../lib/hint.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e) => {
      setBusy(false);
      if (e.data.error) setError(e.data.error);
      else setResult(e.data.result);
      worker.terminate();
    };
    worker.onerror = () => {
      setBusy(false);
      setError("探索を開始できませんでした。再試行してください。");
      worker.terminate();
    };
    worker.postMessage({ scramble, face, xcross: kind === "xcross" });
    return () => worker.terminate();
  }, [open, scramble, face, kind, retry]);
  useEffect(() => {
    if (!showPreview || !result || !preview.current) return;
    const p = new TwistyPlayer({
      puzzle: "3x3x3",
      experimentalSetupAlg: scramble,
      alg: result.alg,
      background: "none",
      controlPanel: "bottom-row",
      hintFacelets: "floating",
    });
    preview.current.replaceChildren(p);
    return () => p.remove();
  }, [showPreview, result, scramble]);
  return (
    <>
      <button
        ref={trigger}
        className="hint-button"
        disabled={disabled}
        popoverTarget={id}
        aria-expanded={open}
        aria-controls={id}
        aria-keyshortcuts="H"
        onClick={(e) => {
          const pointer = e.detail > 0;
          popover.current?.toggleAttribute("data-pointer-motion", pointer);
          const rect = e.currentTarget.getBoundingClientRect();
          pointerOffset.current = pointer
            ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
            : null;
          position();
          if (!open) {
            setBusy(true);
            setResult(null);
          }
        }}
      >
        <Lightbulb size={15} />
        ヒント
        <kbd className="shortcut-hint" aria-hidden="true">H</kbd>
      </button>
      <div
        ref={popover}
        id={id}
        popover="auto"
        className="hint-popover"
        role="region"
        aria-label="クロスのヒント"
        onToggle={(e) => setOpen(e.newState === "open")}
      >
        <header className="hint-popover-header">
          <h3>
            {face}面 {kind === "xcross" ? "X-cross" : "クロス"}
          </h3>
          <button
            className="icon-button"
            aria-label="ヒントを閉じる"
            popoverTarget={id}
            popoverTargetAction="hide"
          >
            <X size={16} />
          </button>
        </header>
        <div className="hint-popover-body" aria-live="polite" aria-busy={busy}>
          {busy && <p className="muted">探索中…</p>}
          {error && (
            <>
              <p className="error-text">{error}</p>
              <button onClick={() => setRetry((n) => n + 1)}>再試行</button>
            </>
          )}
          {result && (
            <>
              <div className="hint-result">
                <span>{result.depth}手</span>
                <strong>{result.alg || "すでに揃っています"}</strong>
              </div>
              {kind === "xcross" && (
                <p className="muted">
                  {
                    {
                      D: "DFRコーナーとFRエッジ",
                      U: "UFRコーナーとFRエッジ",
                      F: "UFRコーナーとURエッジ",
                      B: "URBコーナーとURエッジ",
                      R: "UFRコーナーとUFエッジ",
                      L: "ULFコーナーとUFエッジ",
                    }[face]
                  }
                </p>
              )}
              <button
                className="text-button"
                aria-expanded={showPreview}
                onClick={() => setShowPreview(!showPreview)}
              >
                <Play size={14} />
                {showPreview ? "手順を閉じる" : "手順を見る"}
              </button>
              {showPreview && <div className="hint-preview" ref={preview} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}
