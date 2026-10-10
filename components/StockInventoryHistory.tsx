"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { operationLabel } from "@/lib/operationsUi";
import type { OperationsRow } from "@/lib/operationsCommands";
import { OperationsDataTable } from "./OperationsDataTable";
import { TripDialog } from "./TripDialog";
import styles from "./OperationsWorkspace.module.css";

export function StockInventoryHistory({ language, materials, locations, onClose }: {
  language: "de" | "sv" | "en"; materials: { id: string; name: string; unit?: string }[]; locations: { id: string; name: string }[]; onClose: () => void;
}) {
  const t = (key: string) => operationLabel(key, language);
  const title = language === "de" ? "Inventuren" : language === "sv" ? "Inventeringar" : "Stocktakes";
  const countLabels = language === "de" ? ["Sollbestand", "Gezählt", "Differenz"] : language === "sv" ? ["Förväntat saldo", "Räknat", "Differens"] : ["Expected stock", "Counted", "Difference"];
  const [selected, setSelected] = useState<OperationsRow | null>(null), [rows, setRows] = useState<OperationsRow[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [page, setPage] = useState(0), [count, setCount] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      await Promise.resolve(); if (controller.signal.aborted) return;
      setLoading(true); setError(false); setRows([]);
      const loaded: OperationsRow[] = [];
      for (let index = selected ? 0 : page; ; index++) {
        const response = await apiFetch(`/api/operations?entity=${selected ? `stock_inventory_items&parent=${encodeURIComponent(selected.id)}` : "stock_inventories"}&page=${index}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const result = await response.json(); loaded.push(...result.rows);
        if (!selected || loaded.length >= result.count || result.rows.length < 50) {
          if (!controller.signal.aborted) { setRows(loaded.map((row) => ({ ...row, id: selected ? String(row.material_id) : row.id }))); setCount(result.count); }
          return;
        }
      }
    }
    void load().catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, page]);
  const columns = selected ? [
    { key: "material_id", label: t("designation"), value: (row: OperationsRow) => materials.find((material) => material.id === row.material_id)?.name ?? String(row.material_id) },
    ...["expected_quantity", "counted_quantity", "difference"].map((key, index) => ({ key, label: countLabels[index], value: (row: OperationsRow) => `${Number(key === "difference" ? Number(row.counted_quantity) - Number(row.expected_quantity) : row[key]).toLocaleString(language, { maximumFractionDigits: 3 })} ${materials.find((material) => material.id === row.material_id)?.unit ?? ""}` })),
  ] : [
    { key: "created_at", label: t("bookedAt"), value: (row: OperationsRow) => new Date(String(row.created_at)).toLocaleString(language, { dateStyle: "medium", timeStyle: "medium", timeZone: "Europe/Stockholm" }) },
    { key: "location_id", label: t("location"), value: (row: OperationsRow) => locations.find((location) => location.id === row.location_id)?.name ?? t("unknownLocation") },
    { key: "actor_name", label: t("bookedBy"), value: (row: OperationsRow) => String(row.actor_name || t("unknownActor")) },
    { key: "note", label: t("note"), value: (row: OperationsRow) => String(row.note ?? "") },
  ];
  return <TripDialog labelledBy="inventory-history-title" onClose={onClose} className={styles.dialog}>
    <header className={styles.dialogHeader}><div><h2 id="inventory-history-title">{title}</h2>{selected && <p>{String(selected.note)} · {String(selected.actor_name || t("unknownActor"))} · {new Date(String(selected.created_at)).toLocaleString(language, { timeZone: "Europe/Stockholm" })}</p>}</div><button aria-label={t("close")} onClick={onClose}><X size={18} /></button></header>
    {error && <p role="alert">{t("unavailable")}</p>}
    <OperationsDataTable rows={rows} columns={columns} label={title} filterLabel={t("filter")} emptyLabel={t(loading ? "loading" : "empty")} actionsLabel={t("actions")} onRowActivate={selected ? undefined : (row) => setSelected(row)} />
    {!selected && count > 50 && <div className={styles.toolbar}><button disabled={!page || loading} aria-label={t("previous")} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button><span>{page + 1} / {Math.ceil(count / 50)}</span><button disabled={loading || (page + 1) * 50 >= count} aria-label={t("next")} onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button></div>}
    <footer className={styles.actions}>{selected && <button onClick={() => setSelected(null)}><ChevronLeft size={18} />{title}</button>}<button onClick={onClose}>{t("close")}</button></footer>
  </TripDialog>;
}
