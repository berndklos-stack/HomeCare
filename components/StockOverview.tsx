"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, FileSpreadsheet, FileText, History, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId } from "@/lib/syncQueue";
import { exportStockOverview, stockOverviewRows, type StockBalance, type StockMaterial } from "@/lib/stockOverview";
import { OperationsDataTable } from "./OperationsDataTable";
import { TripDialog } from "./TripDialog";
import { StockInventoryHistory } from "./StockInventoryHistory";
import styles from "./OperationsWorkspace.module.css";

const labels = {
  de: { title: "Lagerbestandsübersicht", zero: "Materialien ohne Bestand anzeigen", archived: "Archivierte Materialien anzeigen", number: "Materialnummer", name: "Bezeichnung", location: "Lagerort", quantity: "Bestand", unit: "Einheit", status: "Status", active: "Aktiv", archive: "Archiviert", loading: "Wird geladen", empty: "Keine Bestände für diese Auswahl", filter: "Filter", actions: "Aktionen", refresh: "Aktualisieren", count: "Inventur", expected: "Sollbestand", counted: "Gezählt", difference: "Differenz", reason: "Inventurgrund", save: "Inventur abschließen", cancel: "Abbrechen", error: "Nicht gespeichert. Bitte erneut versuchen.", changed: "Der Bestand wurde inzwischen geändert. Inventur schließen, Bestände aktualisieren und neu zählen.", success: "Inventur gespeichert", close: "Schließen", pending: "Ausstehende Lagerbuchungen zuerst synchronisieren.", retry: "Übertragung erneut versuchen", exportError: "Ausgabe fehlgeschlagen. Bitte erneut versuchen." },
  sv: { title: "Lageröversikt", zero: "Visa material utan saldo", archived: "Visa arkiverat material", number: "Materialnummer", name: "Benämning", location: "Lagerplats", quantity: "Saldo", unit: "Enhet", status: "Status", active: "Aktiv", archive: "Arkiverad", loading: "Laddar", empty: "Inga saldon för detta urval", filter: "Filter", actions: "Åtgärder", refresh: "Uppdatera", count: "Inventering", expected: "Förväntat saldo", counted: "Räknat", difference: "Differens", reason: "Inventeringsorsak", save: "Slutför inventering", cancel: "Avbryt", error: "Inte sparat. Försök igen.", changed: "Saldot har ändrats. Stäng inventeringen, uppdatera och räkna igen.", success: "Inventering sparad", close: "Stäng", pending: "Synkronisera väntande lagerbokningar först.", retry: "Försök överföra igen", exportError: "Exporten misslyckades. Försök igen." },
  en: { title: "Stock overview", zero: "Show materials without stock", archived: "Show archived materials", number: "Material number", name: "Designation", location: "Location", quantity: "Stock", unit: "Unit", status: "Status", active: "Active", archive: "Archived", loading: "Loading", empty: "No stock for this selection", filter: "Filter", actions: "Actions", refresh: "Refresh", count: "Stocktake", expected: "Expected stock", counted: "Counted", difference: "Difference", reason: "Stocktake reason", save: "Complete stocktake", cancel: "Cancel", error: "Not saved. Please try again.", changed: "Stock has changed. Close the count, refresh stock and count again.", success: "Stocktake saved", close: "Close", pending: "Synchronize pending stock movements first.", retry: "Retry transfer", exportError: "Export failed. Please try again." },
};

export function StockOverview({ language, materials, locations, settled, pending, onBooked, onSelect }: {
  language: "de" | "sv" | "en"; materials: StockMaterial[]; locations: { id: string; name: string }[];
  settled: string; pending: boolean; onBooked: () => void; onSelect: (id: string) => void;
}) {
  const t = labels[language];
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [capturedAt, setCapturedAt] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), [zero, setZero] = useState(false), [archived, setArchived] = useState(false);
  const [exporting, setExporting] = useState(false), [inventory, setInventory] = useState(false);
  const [history, setHistory] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [locationId, setLocationId] = useState(""), [counts, setCounts] = useState<Record<string, string>>({}), [note, setNote] = useState("");
  const [snapshot, setSnapshot] = useState<StockBalance[]>([]);
  const [busy, setBusy] = useState(false), [inventoryError, setInventoryError] = useState(""), [success, setSuccess] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const request = useRef<{ id: string; location_id: string; note: string; items: { material_id: string; expected: number; counted: number }[] } | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true); setError("");
      const response = await apiFetch("/api/operations?entity=stock_summary", { signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!controller.signal.aborted) { setBalances(result.rows); setCapturedAt(result.capturedAt); }
    }
    void load().catch(() => { if (!controller.signal.aborted) setError(t.error); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh, settled, t.error]);
  const rows = useMemo(() => stockOverviewRows(materials, locations, balances, language).filter((row) => (archived || !row.archived) && (zero || row.quantity !== 0)), [materials, locations, balances, language, archived, zero]);
  const columns = [
    { key: "sku", label: t.number, value: (row: Record<string, unknown>) => String(row.sku) },
    { key: "designation", label: t.name, value: (row: Record<string, unknown>) => String(row.designation) },
    { key: "location", label: t.location, value: (row: Record<string, unknown>) => String(row.location) },
    { key: "quantity", label: t.quantity, value: (row: Record<string, unknown>) => Number(row.quantity).toLocaleString(language, { maximumFractionDigits: 3 }) },
    { key: "unit", label: t.unit, value: (row: Record<string, unknown>) => String(row.unit) },
    { key: "archived", label: t.status, value: (row: Record<string, unknown>) => row.archived ? t.archive : t.active },
  ];
  const inventoryRows = stockOverviewRows(materials.filter((material) => !material.archived), locations, snapshot, language)
    .filter((row) => row.location_id === locationId);
  const countRows = materials.filter((material) => !material.archived).map((material) => ({
    material, expected: inventoryRows.find((row) => row.material_id === material.id)?.quantity ?? 0,
  })).sort((a, b) => a.material.name.localeCompare(b.material.name, language, { numeric: true }));
  const selectedCounts = countRows.filter(({ material }) => counts[material.id]?.trim());
  const blocked = loading || Boolean(error) || pending;
  async function output(format: "xlsx" | "pdf") {
    setExporting(true); setError("");
    try {
      const stamp = new Date(capturedAt).toLocaleString(language, { timeZone: "Europe/Stockholm" });
      const exportRows = rows.filter((row) => columns.every((column) => column.value(row).toLocaleLowerCase().includes((filters[column.key] ?? "").trim().toLocaleLowerCase())));
      const blob = await exportStockOverview(exportRows, columns.map((column) => column.label), t.title, stamp, format, [t.active, t.archive]);
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `WorkCore-Lagerbestand-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError(t.exportError); } finally { setExporting(false); }
  }
  return <section className="panel">
    <header className="panel-title"><div><p>Lager &amp; Material</p><h2>{t.title}</h2></div><div className={styles.toolbar}>
      <button disabled={blocked || exporting} onClick={() => void output("xlsx")}><FileSpreadsheet size={18} />Excel</button>
      <button disabled={blocked || exporting} onClick={() => void output("pdf")}><FileText size={18} />PDF</button>
      <button disabled={blocked} title={pending ? t.pending : undefined} onClick={() => { request.current = null; setAttempted(false); setSnapshot(balances); setCounts({}); setLocationId(""); setNote(""); setInventoryError(""); setSuccess(false); setInventory(true); }}><ClipboardList size={18} />{t.count}</button>
      <button onClick={() => setHistory(true)}><History size={18} />{language === "de" ? "Inventuren" : language === "sv" ? "Inventeringar" : "Stocktakes"}</button>
      <button aria-label={t.refresh} title={t.refresh} disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={18} /></button>
    </div></header>
    <div className={styles.stockOptions}><label><input type="checkbox" checked={zero} onChange={(event) => setZero(event.target.checked)} />{t.zero}</label><label><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />{t.archived}</label></div>
    {capturedAt && <p>{new Date(capturedAt).toLocaleString(language, { timeZone: "Europe/Stockholm" })}</p>}
    {error && <p role="alert">{error}</p>}{pending && <p role="status">{t.pending}</p>}{success && <p role="status">{t.success}</p>}
    <OperationsDataTable rows={loading || error ? [] : rows} columns={columns} label={t.title} filterLabel={t.filter} emptyLabel={loading ? t.loading : t.empty} actionsLabel={t.actions} onFiltersChange={setFilters} onRowActivate={(row) => onSelect(String(row.material_id))} />
    {history && <StockInventoryHistory language={language} materials={materials} locations={locations} onClose={() => setHistory(false)} />}
    {inventory && <TripDialog labelledBy="inventory-title" onClose={() => { if (!busy) setInventory(false); }} className={styles.dialog}>
      <form onSubmit={async (event) => {
        event.preventDefault(); if (lock.current || pending || !locationId || !note.trim() || !selectedCounts.length) return;
        if (selectedCounts.length > 500) { setInventoryError(t.error); return; }
        if (!request.current) request.current = { id: createStableId(), location_id: locationId, note: note.trim(), items: selectedCounts.map(({ material, expected }) => ({ material_id: material.id, expected, counted: Number(counts[material.id]) })) };
        lock.current = true; setBusy(true); setAttempted(true); setInventoryError("");
        try {
          const response = await apiFetch("/api/stock-inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.current) });
          if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
          setInventory(false); setSuccess(true); setRefresh((value) => value + 1); onBooked();
        } catch (failure) { setInventoryError(failure instanceof Error && failure.message === "INVENTORY_STOCK_CHANGED" ? t.changed : t.error); }
        finally { lock.current = false; setBusy(false); }
      }}>
        <header className={styles.dialogHeader}><h2 id="inventory-title">{t.count}</h2><button type="button" aria-label={t.close} disabled={busy} onClick={() => setInventory(false)}><X size={18} /></button></header>
        <fieldset disabled={busy || attempted} className={styles.inventoryFields}>
          <div className={styles.fields}><label className={styles.field}>{t.location}<select required aria-label={t.location} value={locationId} onChange={(event) => { setLocationId(event.target.value); setCounts({}); }}><option value="">—</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label className={styles.field}>{t.reason}<input required aria-label={t.reason} maxLength={9000} value={note} onChange={(event) => setNote(event.target.value)} /></label></div>
          {locationId && <div className="analytics-table"><table className={styles.balanceTable}><thead><tr><th>{t.name}</th><th>{t.expected}</th><th>{t.counted}</th><th>{t.difference}</th></tr></thead><tbody>{countRows.map(({ material, expected }) => <tr key={material.id}><td>{material.sku ? `${material.sku} · ` : ""}{material.name}<small> {material.unit}</small></td><td>{expected.toLocaleString(language)}</td><td><input className={styles.countInput} aria-label={`${t.counted}: ${material.name}`} type="number" min="0" step="0.001" value={counts[material.id] ?? ""} onChange={(event) => setCounts({ ...counts, [material.id]: event.target.value })} /></td><td>{counts[material.id]?.trim() ? (Number(counts[material.id]) - expected).toLocaleString(language, { maximumFractionDigits: 3 }) : "—"}</td></tr>)}</tbody></table></div>}
        </fieldset>
        {inventoryError && <p role="alert">{inventoryError}</p>}{pending && <p role="alert">{t.pending}</p>}
        <footer className={styles.actions}><button type="button" disabled={busy} onClick={() => setInventory(false)}>{t.cancel}</button><button type="submit" className={styles.primaryAction} disabled={busy || pending || !locationId || !note.trim() || !selectedCounts.length}>{attempted ? t.retry : t.save}</button></footer>
      </form>
    </TripDialog>}
  </section>;
}
