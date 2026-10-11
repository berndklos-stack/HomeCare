"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { operationLabel } from "@/lib/operationsUi";
import { OperationsDataTable } from "./OperationsDataTable";
import styles from "./OperationsWorkspace.module.css";

type Receipt = { id: string; delivery_number: string; created_at: string; actor_name?: string; supplier?: { company: string }; location?: { name: string } };
type Item = { material_id: string; quantity: number; material: { name: string; sku?: string; scan_code?: string; unit?: string } };
export function GoodsReceiptHistory({ language, refresh, onSelectionChange }: { language: "de" | "sv" | "en"; refresh: number; onSelectionChange?: (selected: boolean) => void }) {
 const t = (key: string) => operationLabel(key, language);
 const [rows, setRows] = useState<Receipt[]>([]), [selected, setSelected] = useState<Receipt | null>(null), [items, setItems] = useState<Item[]>([]);
 const [page, setPage] = useState(0), [count, setCount] = useState(0), [loading, setLoading] = useState(false), [error, setError] = useState("");
 const id = selected?.id;
 useEffect(() => {
  const controller = new AbortController(); setLoading(true); setError(""); setItems([]);
  void apiFetch(`/api/goods-receipts?${id ? `id=${encodeURIComponent(id)}` : `page=${page}`}`, { signal: controller.signal }).then(async (response) => {
   if (!response.ok) throw new Error();
   const data = await response.json(); if (controller.signal.aborted) return;
   if (id) { if (!data.rows[0]) throw new Error(); setSelected(data.rows[0]); setItems(data.items ?? []); }
   else { setRows(data.rows); setCount(data.count); }
  }).catch(() => { if (!controller.signal.aborted) setError("OPERATIONS_UNAVAILABLE"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [id, page, refresh]);
 const date = (value: string) => new Date(value).toLocaleString(language, { timeZone: "Europe/Stockholm" });
 function close() { setSelected(null); onSelectionChange?.(false); }
 return <section className={`panel ${styles.scanSurface}`} aria-labelledby={selected ? "goods-history-title" : undefined} aria-busy={loading}>
  {!selected && <>
  <div className="panel-title"><div><p>{t("purchasingSection")}</p><h2>{t("receiptsWithoutOrder")}</h2></div></div>
  {loading && <p role="status">{t("loading")}</p>}{error && <p role="alert">{t(error)}</p>}
  <OperationsDataTable rows={rows} columns={[
   { key: "delivery_number", label: t("deliveryNumber"), value: (row) => String(row.delivery_number) },
   { key: "supplier", label: t("supplier_id"), value: (row) => (row as Receipt).supplier?.company ?? "" },
   { key: "created_at", label: t("bookedAt"), value: (row) => date(String(row.created_at)) },
   { key: "actor_name", label: t("bookedBy"), value: (row) => String(row.actor_name ?? "") },
   { key: "location", label: t("destination_id"), value: (row) => (row as Receipt).location?.name ?? "" },
  ]} label={t("receiptsWithoutOrder")} filterLabel={t("filter")} emptyLabel={t("empty")} actionsLabel={t("actions")} onRowActivate={(row) => { setSelected(row as Receipt); onSelectionChange?.(true); }} />
  {count > 50 && <footer className={styles.actions}><button aria-label={t("previous")} disabled={!page} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button><span>{page + 1} / {Math.ceil(count / 50)}</span><button aria-label={t("next")} disabled={(page + 1) * 50 >= count} onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button></footer>}
  </>}
  {selected && <>
   <header className={styles.dialogHeader}><div><h2 id="goods-history-title">{t("deliveryNumber")}: {selected.delivery_number}</h2><p>{selected.supplier?.company}</p></div><button aria-label={t("scanBack")} title={t("scanBack")} onClick={close}><ChevronLeft size={18} /></button></header>
   <p>{t("bookedAt")}: {date(selected.created_at)} · {t("bookedBy")}: {selected.actor_name || "—"}</p><p>{t("destination_id")}: {selected.location?.name}</p>
   {loading && <p role="status">{t("loading")}</p>}{error && <p role="alert">{t(error)}</p>}
   <OperationsDataTable rows={items.map((item) => ({ ...item, id: item.material_id }))} columns={[
    { key: "name", label: t("designation"), value: (row) => (row as unknown as Item).material.name },
    { key: "sku", label: t("materialSkuColumn"), value: (row) => (row as unknown as Item).material.sku ?? "" },
    { key: "scan_code", label: t("materialScanCode"), value: (row) => (row as unknown as Item).material.scan_code ?? "" },
    { key: "quantity", label: t("quantity"), value: (row) => `${row.quantity} ${(row as unknown as Item).material.unit ?? ""}` },
   ]} label={t("purchase_order_items")} filterLabel={t("filter")} emptyLabel={t("empty")} actionsLabel={t("actions")} />
  </>}
 </section>;
}
