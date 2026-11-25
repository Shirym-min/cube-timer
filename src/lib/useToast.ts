import { useEffect, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState({ text: "", visible: false });
  useEffect(() => {
    if (!toast.visible) return;
    const t = setTimeout(() => setToast({ ...toast, visible: false }), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = (text: string) => setToast({ text, visible: true });
  return { toast, notify };
}
