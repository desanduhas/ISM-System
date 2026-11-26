"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface OperationDialogProps {
  children: ReactNode;
  className: string;
  titleId: string;
  onDismiss: () => void;
}

export default function OperationDialog({ children, className, titleId, onDismiss }: OperationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`operations-dialog ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
