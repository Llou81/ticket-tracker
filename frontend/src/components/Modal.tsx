import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  /** Ignored while `busy`, so an in-flight save can't be abandoned via Escape. */
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}

/** Modal built on the native <dialog>: focus trapping, Escape and backdrop come for free. */
export function Modal({ title, children, onClose, busy, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={wide ? "dialog wide" : "dialog"}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
