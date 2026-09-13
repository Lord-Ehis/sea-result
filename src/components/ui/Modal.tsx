"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: number;
};

export function Modal({ open, onClose, title, description, children, width = 440 }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto rounded-md border border-border bg-bg-card p-0 backdrop:bg-[#172c3d77]"
      style={{ width: `min(${width}px, calc(100vw - 24px))` }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
        <div>
          <h2 className="m-0 text-heading font-medium text-text-primary">{title}</h2>
          {description && <p className="mt-1.5 text-caption text-text-muted">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="grid h-6 place-items-center border-0 bg-transparent p-0 text-text-secondary"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
