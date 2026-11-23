import { useEffect, useRef, useId, type ReactNode } from "react";
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

  function dismiss() {
    const el = ref.current;
    if (!el || el.hasAttribute("data-closing")) return;
    el.setAttribute("data-closing", "");
    el.inert = true;
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
      className={wide ? `wide ${className}` : className}
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
      <header className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="閉じる" onClick={dismiss}>
          <X size={20} />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
