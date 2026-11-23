import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal confirmation using the native <dialog> (focus trap and Escape handling built in). */
export function ConfirmDialog({ title, children, confirmLabel, pending, error, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <h2>{title}</h2>
      <div>{children}</div>
      {error && <p className="notice error">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="button" className="danger" onClick={onConfirm} disabled={pending}>
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
