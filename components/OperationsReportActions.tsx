"use client";

import { useEffect, useRef } from "react";
import { getActiveTenantId } from "@/lib/apiClient";
import type { OperationsRow } from "@/lib/operationsCommands";
import { exportOperationsReport } from "@/lib/operationsReport";
import { CommunicationActions } from "./CommunicationActions";
import type { DataColumn } from "./OperationsDataTable";

export type ReportColumn = DataColumn & { exportValue?: (row: OperationsRow) => string | number };

export function OperationsReportActions({ title, subtitle, language, scope, columns, filters, loadRows, disabled }: {
  title: string; subtitle: string; language: "de" | "sv" | "en"; scope: string;
  columns: ReportColumn[]; filters: Record<string, string>;
  loadRows: (signal: AbortSignal) => Promise<OperationsRow[]>; disabled: boolean;
}) {
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), [scope]);
  async function document(format: "pdf" | "xlsx") {
    const tenant = getActiveTenantId();
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const rows = (await loadRows(controller.signal)).filter(row => columns.every(column => column.value(row).toLocaleLowerCase().includes((filters[column.key] ?? "").trim().toLocaleLowerCase())));
      controller.signal.throwIfAborted();
      if (getActiveTenantId() !== tenant) throw new Error("REPORT_TENANT_CHANGED");
      const blob = await exportOperationsReport(title, subtitle, columns.map(column => column.label), rows.map(row => columns.map(column => column.exportValue?.(row) ?? column.value(row))), format);
      controller.signal.throwIfAborted();
      if (getActiveTenantId() !== tenant) throw new Error("REPORT_TENANT_CHANGED");
      return { blob, name: `WorkCore-${scope.startsWith("bookings") ? "Buchungen" : "Inventuren"}-${new Date().toISOString().slice(0, 10)}.${format}` };
    } finally { window.clearTimeout(timeout); if (request.current === controller) request.current = null; }
  }
  async function download(format: "pdf" | "xlsx") {
    const file = await document(format);
    const url = URL.createObjectURL(file.blob), link = window.document.createElement("a");
    link.href = url; link.download = file.name; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return <CommunicationActions key={scope} title={title} text={`${title}\n${subtitle}`} language={language} disabled={disabled}
    document={() => document("pdf")} downloads={[{ label: "PDF", run: () => download("pdf") }, { label: "Excel", run: () => download("xlsx") }]} />;
}
