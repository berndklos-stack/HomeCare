"use client";

import { type ReactNode, useEffect, useRef } from "react";

export function TripDialog({ children, className = "", labelledBy, onClose }: {
  children: ReactNode;
  className?: string;
  labelledBy: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      // WebKit finishes its native dialog focus restoration after close().
      queueMicrotask(() => {
        if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
      });
    };
  }, []);

  return <dialog ref={dialog} className={`modal trip-dialog ${className}`} aria-labelledby={labelledBy}
    onCancel={(event) => { event.preventDefault(); close.current(); }}>
    {children}
  </dialog>;
}
