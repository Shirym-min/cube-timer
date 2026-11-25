import { useEffect, useRef, useId, type PointerEvent, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const swipe = useRef<{ id: number; start: number }>(null);

  function startSwipe(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest("button")) return;
    swipe.current = { id: event.pointerId, start: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSwipe(event: PointerEvent<HTMLElement>) {
    const drag = swipe.current;
    if (drag?.id !== event.pointerId) return;
    ref.current?.setAttribute("data-dragging", "");
    ref.current?.style.setProperty("--sheet-drag", `${Math.max(0, event.clientY - drag.start)}px`);
  }

  function finishSwipe(event: PointerEvent<HTMLElement>, cancelled = false) {
    const drag = swipe.current;
    if (drag?.id !== event.pointerId) return;
    swipe.current = null;
    ref.current?.removeAttribute("data-dragging");
    if (!cancelled && event.clientY - drag.start >= 64) dismiss();
    else ref.current?.style.removeProperty("--sheet-drag");
  }

  function dismiss() {
    const el = ref.current;
    if (!el || el.hasAttribute("data-closing")) return;
    el.setAttribute("data-closing", "");
    el.inert = true;
    void getComputedStyle(el).transform;
    void Promise.allSettled(el.getAnimations().map((animation) => animation.finished))
      .then(() => {
        if (ref.current !== el || !el.open) return;
        el.close();
        onClose();
      });
  }
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal-sheet ${wide ? "wide" : ""} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            dismiss();
        }
      }}
    >
      <header className="modal-header" onPointerDown={startSwipe} onPointerMove={moveSwipe}
        onPointerUp={finishSwipe} onLostPointerCapture={(event) => finishSwipe(event, true)}>
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="閉じる" onClick={dismiss}>
          <X size={20} />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
