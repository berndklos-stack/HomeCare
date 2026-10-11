import type { ReactNode } from "react";
import { TripDialog } from "./TripDialog";
import styles from "./OperationsWorkspace.module.css";

export function ScanSurface({ inline, labelledBy, onClose, className, children }: {
  inline?: boolean; labelledBy: string; onClose: () => void; className?: string; children: ReactNode;
}) {
  return inline
    ? <section className={`panel ${styles.scanSurface}`} aria-labelledby={labelledBy}>{children}</section>
    : <TripDialog labelledBy={labelledBy} onClose={onClose} className={className}>{children}</TripDialog>;
}
