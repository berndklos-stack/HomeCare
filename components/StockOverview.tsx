"use client";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { exportStockOverview, stockOverviewRows, type StockBalance, type StockMaterial } from "@/lib/stockOverview";
import { OperationsDataTable } from "./OperationsDataTable";
import { StockInventoryHistory } from "./StockInventoryHistory";
import { InventoryPlanner } from "./InventoryPlanner";
import styles from "./OperationsWorkspace.module.css";

const labels = {
  de: { title: "Lagerbestandsübersicht", zero: "Materialien ohne Bestand anzeigen", archived: "Archivierte Materialien anzeigen", number: "Materialnummer", name: "Bezeichnung", location: "Lagerort", quantity: "Bestand", unit: "Einheit", status: "Status", active: "Aktiv", archive: "Archiviert", loading: "Wird geladen", empty: "Keine Bestände für diese Auswahl", filter: "Filter", actions: "Aktionen", refresh: "Aktualisieren", count: "Inventur", expected: "Sollbestand", counted: "Gezählt", difference: "Differenz", reason: "Inventurgrund", save: "Inventur abschließen", cancel: "Abbrechen", error: "Nicht gespeichert. Bitte erneut versuchen.", changed: "Der Bestand wurde inzwischen geändert. Inventur schließen, Bestände aktualisieren und neu zählen.", success: "Inventur gespeichert", close: "Schließen", pending: "Ausstehende Lagerbuchungen zuerst synchronisieren.", retry: "Übertragung erneut versuchen", exportError: "Ausgabe fehlgeschlagen. Bitte erneut versuchen." },
  sv: { title: "Lageröversikt", zero: "Visa material utan saldo", archived: "Visa arkiverat material", number: "Materialnummer", name: "Benämning", location: "Lagerplats", quantity: "Saldo", unit: "Enhet", status: "Status", active: "Aktiv", archive: "Arkiverad", loading: "Laddar", empty: "Inga saldon för detta urval", filter: "Filter", actions: "Åtgärder", refresh: "Uppdatera", count: "Inventering", expected: "Förväntat saldo", counted: "Räknat", difference: "Differens", reason: "Inventeringsorsak", save: "Slutför inventering", cancel: "Avbryt", error: "Inte sparat. Försök igen.", changed: "Saldot har ändrats. Stäng inventeringen, uppdatera och räkna igen.", success: "Inventering sparad", close: "Stäng", pending: "Synkronisera väntande lagerbokningar först.", retry: "Försök överföra igen", exportError: "Exporten misslyckades. Försök igen." },
  en: { title: "Stock overview", zero: "Show materials without stock", archived: "Show archived materials", number: "Material number", name: "Designation", location: "Location", quantity: "Stock", unit: "Unit", status: "Status", active: "Active", archive: "Archived", loading: "Loading", empty: "No stock for this selection", filter: "Filter", actions: "Actions", refresh: "Refresh", count: "Stocktake", expected: "Expected stock", counted: "Counted", difference: "Difference", reason: "Stocktake reason", save: "Complete stocktake", cancel: "Cancel", error: "Not saved. Please try again.", changed: "Stock has changed. Close the count, refresh stock and count again.", success: "Stocktake saved", close: "Close", pending: "Synchronize pending stock movements first.", retry: "Retry transfer", exportError: "Export failed. Please try again." },
};

export function StockOverview({ language, materials, locations, settled, pending, onBooked, onSelect, mode = "overview" }: {
  language: "de" | "sv" | "en"; materials: StockMaterial[]; locations: { id: string; name: string }[];
  settled: string; pending: boolean; onBooked: () => void; onSelect: (id: string) => void;
  mode?: "overview" | "inventory";
}) {
  const t = labels[language];
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [capturedAt, setCapturedAt] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), [zero, setZero] = useState(false), [archived, setArchived] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
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
    <header className="panel-title"><div><p>Lager &amp; Material</p><h2>{mode === "inventory" ? t.count : t.title}</h2></div><div className={styles.toolbar}>
      {mode === "overview" && <><button disabled={blocked || exporting} onClick={() => void output("xlsx")}><FileSpreadsheet size={18} />Excel</button>
      <button disabled={blocked || exporting} onClick={() => void output("pdf")}><FileText size={18} />PDF</button></>}
      <button aria-label={t.refresh} title={t.refresh} disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={18} /></button>
    </div></header>
    {mode === "overview" && <div className={styles.stockOptions}><label><input type="checkbox" checked={zero} onChange={(event) => setZero(event.target.checked)} />{t.zero}</label><label><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />{t.archived}</label></div>}
    {capturedAt && <p>{new Date(capturedAt).toLocaleString(language, { timeZone: "Europe/Stockholm" })}</p>}
    {error && <p role="alert">{error}</p>}{pending && <p role="status">{t.pending}</p>}
    {mode === "overview" ? <OperationsDataTable rows={loading || error ? [] : rows} columns={columns} label={t.title} filterLabel={t.filter} emptyLabel={loading ? t.loading : t.empty} actionsLabel={t.actions} onFiltersChange={setFilters} onRowActivate={(row) => onSelect(String(row.material_id))} />
      : <><InventoryPlanner language={language} materials={materials} locations={locations} balances={balances} pending={pending} blocked={blocked} refreshKey={`${settled}:${refresh}`} onBooked={() => { setRefresh((value) => value + 1); onBooked(); }} />
        <h3>{language === "de" ? "Gebuchte Inventuren" : language === "sv" ? "Bokförda inventeringar" : "Posted stocktakes"}</h3>
        <StockInventoryHistory inline language={language} materials={materials} locations={locations} refreshKey={`${settled}:${refresh}`} onClose={() => {}} /></>}
  </section>;
}
