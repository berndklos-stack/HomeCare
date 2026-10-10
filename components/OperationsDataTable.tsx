"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { OperationsRow } from "@/lib/operationsCommands";
import styles from "./OperationsWorkspace.module.css";

export type DataColumn = { key: string; label: string; value: (row: OperationsRow) => string; render?: (row: OperationsRow) => ReactNode };

export function OperationsDataTable({ rows, columns, actions, label, filterLabel, emptyLabel, actionsLabel, onRowActivate, canActivate }: {
  rows: OperationsRow[]; columns: DataColumn[]; actions?: (row: OperationsRow) => ReactNode;
  label: string; filterLabel: string; emptyLabel: string; actionsLabel: string;
  onRowActivate?: (row: OperationsRow) => void; canActivate?: (row: OperationsRow) => boolean;
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const filtered = rows.filter((row) => columns.every((column) => column.value(row).toLocaleLowerCase().includes((filters[column.key] ?? "").trim().toLocaleLowerCase())));
  const current = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  return <>
    <div className={styles.itemsScroll}><table className={styles.dataTable} aria-label={label}>
      <thead><tr>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}{actions && <th scope="col">{actionsLabel}</th>}</tr>
        <tr>{columns.map((column) => <td key={column.key}><input type="search" aria-label={`${filterLabel}: ${column.label}`} value={filters[column.key] ?? ""} onChange={(event) => { setFilters((old) => ({ ...old, [column.key]: event.target.value })); setPage(0); }} /></td>)}{actions && <td />}</tr>
      </thead>
      <tbody>{filtered.slice(current * 50, current * 50 + 50).map((row) => {
        const enabled = Boolean(onRowActivate && (canActivate?.(row) ?? true));
        return <tr key={row.id} tabIndex={enabled ? 0 : undefined} className={enabled ? styles.clickableRow : undefined}
          onClick={(event) => {
            if (enabled && !(event.target as HTMLElement).closest("button, a, input, select, textarea, [role=button]")) onRowActivate?.(row);
          }}
          onKeyDown={(event) => {
            if (enabled && event.target === event.currentTarget && ["Enter", " "].includes(event.key)) { event.preventDefault(); onRowActivate?.(row); }
          }}>{columns.map((column) => <td key={column.key}>{column.render?.(row) ?? (column.value(row) || "—")}</td>)}{actions && <td><div className={styles.actions}>{actions(row)}</div></td>}</tr>;
      })}
        {!filtered.length && <tr><td colSpan={columns.length + (actions ? 1 : 0)}>{emptyLabel}</td></tr>}
      </tbody>
    </table></div>
    {filtered.length > 50 && <div className={styles.toolbar}><button aria-label="Previous" disabled={!current} onClick={() => setPage(current - 1)}><ChevronLeft size={18} /></button><span>{current + 1} / {Math.ceil(filtered.length / 50)}</span><button aria-label="Next" disabled={(current + 1) * 50 >= filtered.length} onClick={() => setPage(current + 1)}><ChevronRight size={18} /></button></div>}
  </>;
}
