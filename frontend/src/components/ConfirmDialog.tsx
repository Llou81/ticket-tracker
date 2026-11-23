import type { ReactNode } from "react";
import { Modal } from "./Modal";

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Explicit confirmation for destructive actions. */
export function ConfirmDialog({ title, children, confirmLabel, pending, error, onConfirm, onCancel }: Props) {
  return (
    <Modal title={title} onClose={onCancel} busy={pending}>
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
    </Modal>
  );
}
