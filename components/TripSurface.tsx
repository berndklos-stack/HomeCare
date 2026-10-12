"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { TripDialog } from "@/components/TripDialog";

type Props = { children: ReactNode; className?: string; labelledBy: string; onClose: () => void; inline?: boolean };

function TripPage({ children, className, labelledBy }: Props) {
  const section = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = section.current;
    if (!returnFocus.current && document.activeElement instanceof HTMLElement) returnFocus.current = document.activeElement;
    const heading = element?.querySelector<HTMLElement>("h2");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
    return () => queueMicrotask(() => {
      if (!element?.isConnected && returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
    });
  }, []);
  return <section ref={section} className={`trip-page ${className ?? ""}`} aria-labelledby={labelledBy}>{children}</section>;
}

export function TripSurface(props: Props) {
  return props.inline ? <TripPage {...props} /> : <TripDialog className={props.className} labelledBy={props.labelledBy} onClose={props.onClose}>{props.children}</TripDialog>;
}
