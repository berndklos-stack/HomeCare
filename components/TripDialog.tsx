"use client";

import { type ReactNode, useEffect, useRef } from "react";

export function TripDialog({ children, className = "", labelledBy, onClose, active = true }: {
  children: ReactNode;
  className?: string;
  labelledBy: string;
  onClose: () => void;
  active?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!active) return;
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
  }, [active]);

  return <dialog ref={dialog} className={`modal trip-dialog ${className}`} aria-labelledby={labelledBy} style={active ? undefined : { display: "none" }}
    onCancel={(event) => { event.preventDefault(); close.current(); }}>
    {children}
  </dialog>;
}
