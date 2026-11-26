import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { ChevronUp, Pencil, Trash2 } from "lucide-react";
import { formatResult, type Settings, type Solve } from "../../lib/model";

type Props = {
  solve: Solve;
  precision: Settings["precision"];
  timed: boolean;
  patch: (s: Solve, p: Partial<Solve>) => Promise<void>;
  edit: (s: Solve) => void;
  remove: (s: Solve) => Promise<void>;
};

export function LastSolveActions({ solve, precision, timed, patch, edit, remove }: Props) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const actionsId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const plusTwoButton = useRef<HTMLButtonElement>(null);
  const dnfButton = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    offset: number;
    travel: number;
    lastY: number;
    lastTime: number;
    velocity: number;
    vertical: boolean;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const desktop = matchMedia("(min-width: 761px) and (hover: hover) and (pointer: fine)");
    function applyPenaltyShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      const key = event.key.toLowerCase();
      const button = key === "p" ? plusTwoButton.current : key === "d" ? dnfButton.current : null;
      if (!button || !desktop.matches || document.querySelector("dialog[open], :popover-open")) return;
      if (event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.closest("input, textarea, select"))) return;

      event.preventDefault();
      button.click();
    }
    window.addEventListener("keydown", applyPenaltyShortcut);
    return () => window.removeEventListener("keydown", applyPenaltyShortcut);
  }, []);

  function setExpanded(next: boolean) {
    setOpen(next);
    if (!next) setConfirm(false);
  }

  function startDrag(e: PointerEvent<HTMLButtonElement>) {
    if (!e.isPrimary || e.button !== 0 || !sheet.current) return;
    const panel = sheet.current;
    const offset = new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42;
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      offset,
      travel: panel.offsetHeight - e.currentTarget.offsetHeight,
      lastY: e.clientY,
      lastTime: e.timeStamp,
      velocity: 0,
      vertical: false,
      moved: false,
    };
    panel.style.transform = `translateY(${offset}px)`;
    panel.toggleAttribute("data-tracking", true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: PointerEvent<HTMLButtonElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== e.pointerId || !sheet.current) return;
    const dy = e.clientY - drag.y;
    const dx = e.clientX - drag.x;
    if (!drag.vertical) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.moved = true;
      if (Math.abs(dy) <= Math.abs(dx) * 1.25) return;
      drag.vertical = true;
      sheet.current.toggleAttribute("data-dragging", true);
    }
    const position = drag.offset + dy;
    const edge = Math.max(0, Math.min(drag.travel, position));
    sheet.current.style.transform = `translateY(${edge + (position - edge) * 0.18}px)`;
    const dt = e.timeStamp - drag.lastTime;
    if (dt > 0 && e.clientY !== drag.lastY) {
      drag.velocity = (e.clientY - drag.lastY) / dt;
      drag.lastY = e.clientY;
      drag.lastTime = e.timeStamp;
    }
  }

  function endDrag(e: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = gesture.current;
    if (!drag || drag.id !== e.pointerId || !sheet.current) return;
    gesture.current = null;
    if (!cancelled && drag.vertical) {
      const distance = (e.clientY - drag.y) * (open ? 1 : -1);
      const velocity = (e.timeStamp - drag.lastTime < 90 ? drag.velocity : 0) * (open ? 1 : -1);
      if (distance >= 24 || (distance >= 12 && velocity >= 0.55)) setExpanded(!open);
    }
    if (!cancelled && !drag.moved) setExpanded(!open);
    sheet.current.removeAttribute("data-tracking");
    sheet.current.removeAttribute("data-dragging");
    sheet.current.style.removeProperty("transform");
  }

  return (
    <div className="last-solve-tray">
      <div
        ref={sheet}
        className="last-solve-sheet"
        data-open={open || undefined}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !open) return;
          e.stopPropagation();
          setExpanded(false);
          handle.current?.focus();
        }}
      >
        <button
          ref={handle}
          className="last-solve-handle"
          type="button"
          aria-label="直前の記録の追加操作"
          aria-expanded={open}
          aria-controls={actionsId}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={(e) => endDrag(e)}
          onPointerCancel={(e) => endDrag(e, true)}
          onLostPointerCapture={(e) => endDrag(e, true)}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            // Keyboard and assistive activation do not send pointer events.
            if (e.detail === 0) setExpanded(!open);
          }}
        >
          <ChevronUp size={20} aria-hidden="true" />
        </button>
        <div className="last-actions" id={actionsId}>
          <span><span className="sr-only">直前の記録 </span>{formatResult(solve, precision)}</span>
          {confirm ? (
            <>
              <button type="button" disabled={deleting} onClick={() => setConfirm(false)}>
                キャンセル
              </button>
              <button
                type="button"
                className="danger"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await remove(solve);
                  } catch {
                    setDeleting(false);
                  }
                }}
              >
                削除する
              </button>
            </>
          ) : (
            <>
              {timed && (
                <button
                  ref={plusTwoButton}
                  type="button"
                  className={solve.penalty === "+2" ? "selected" : ""}
                  aria-pressed={solve.penalty === "+2"}
                  onClick={() => void patch(solve, { penalty: solve.penalty === "+2" ? "OK" : "+2" })}
                >
                  +2 <kbd className="shortcut-hint" aria-hidden="true">P</kbd>
                </button>
              )}
              <button
                ref={dnfButton}
                type="button"
                className={solve.penalty === "DNF" ? "selected" : ""}
                aria-pressed={solve.penalty === "DNF"}
                onClick={() => void patch(solve, { penalty: solve.penalty === "DNF" ? "OK" : "DNF" })}
              >
                DNF <kbd className="shortcut-hint" aria-hidden="true">D</kbd>
              </button>
              <button type="button" aria-label="直前の記録を編集" title="直前の記録を編集" onClick={() => edit(solve)}>
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button type="button" className="last-solve-delete danger" aria-label="削除" title="削除"
                onClick={() => setConfirm(true)}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
