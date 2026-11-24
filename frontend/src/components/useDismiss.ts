import { useEffect, type RefObject } from "react";

/** While `active`, calls `onDismiss` on Escape or on a mouse press outside `ref`. */
export function useDismiss(ref: RefObject<HTMLElement>, active: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!active) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [ref, active, onDismiss]);
}
