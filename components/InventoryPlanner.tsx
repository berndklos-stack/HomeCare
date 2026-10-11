"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, FileText, Save, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId } from "@/lib/syncQueue";
import { inventoryLocationPath, inventoryPlanPdf, orderInventoryItems, type InventoryLocation, type InventoryPlan } from "@/lib/inventoryPlan";
import type { StockBalance, StockMaterial } from "@/lib/stockOverview";
import { OperationsDataTable } from "./OperationsDataTable";
import { TripDialog } from "./TripDialog";
import styles from "./OperationsWorkspace.module.css";

const labels = {
  de: { new: "Neue Inventur", plans: "Inventurplanung", id: "Inventur-ID", note: "Inventurgrund", location: "Lagerort / Lagerplatz", all: "Alle Lagerorte", create: "Inventur anlegen", save: "Zählstände speichern", complete: "Inventur abschließen", count: "Gezählt", expected: "Sollbestand", difference: "Differenz", name: "Bezeichnung", close: "Schließen", status: "Status", open: "Offen", done: "Abgeschlossen", filter: "Filter", empty: "Keine geplanten Inventuren", error: "Nicht gespeichert. Bitte erneut versuchen.", changed: "Die Inventur wurde auf einem anderen Gerät geändert. Schließen und neu aufrufen; deine Eingaben werden nicht automatisch überschrieben.", stockChanged: "Bestände wurden seit der Anlage geändert. Abschluss nicht gebucht. Zählstände bleiben erhalten.", limit: "Bitte die Auswahl auf höchstens 500 Positionen begrenzen.", saved: "Zählstände gespeichert", pending: "Ausstehende Lagerbuchungen zuerst synchronisieren.", loading: "Wird geladen", zero: "Materialien ohne Bestand einbeziehen", select: "Bitte mindestens einen Lagerort auswählen." },
  sv: { new: "Ny inventering", plans: "Inventeringsplanering", id: "Inventerings-ID", note: "Inventeringsorsak", location: "Lager / Lagerplats", all: "Alla lager", create: "Skapa inventering", save: "Spara räkning", complete: "Slutför inventering", count: "Räknat", expected: "Förväntat saldo", difference: "Differens", name: "Benämning", close: "Stäng", status: "Status", open: "Öppen", done: "Slutförd", filter: "Filter", empty: "Inga planerade inventeringar", error: "Inte sparat. Försök igen.", changed: "Inventeringen ändrades på en annan enhet. Stäng och öppna igen. Dina värden skrivs inte över automatiskt.", stockChanged: "Saldon ändrades sedan starten. Inte bokfört. Räknade värden bevaras.", limit: "Välj högst 500 positioner.", saved: "Räkning sparad", pending: "Synkronisera väntande lagerbokningar först.", loading: "Laddar", zero: "Ta med material utan saldo", select: "Välj minst ett lager." },
  en: { new: "New stocktake", plans: "Stocktake planning", id: "Stocktake ID", note: "Stocktake reason", location: "Location / Bin", all: "All locations", create: "Create stocktake", save: "Save counts", complete: "Complete stocktake", count: "Counted", expected: "Expected stock", difference: "Difference", name: "Designation", close: "Close", status: "Status", open: "Open", done: "Completed", filter: "Filter", empty: "No planned stocktakes", error: "Not saved. Please try again.", changed: "Stocktake changed on another device. Close and reopen. Your entries are not automatically overwritten.", stockChanged: "Stock changed since creation. Not posted. Counts are preserved.", limit: "Select no more than 500 items.", saved: "Counts saved", pending: "Synchronize pending stock movements first.", loading: "Loading", zero: "Include materials without stock", select: "Select at least one location." },
};

export function InventoryPlanner({ language, materials, locations, balances, pending, blocked, refreshKey, onBooked }: {
  language: "de" | "sv" | "en"; materials: StockMaterial[]; locations: InventoryLocation[]; balances: StockBalance[];
  pending: boolean; blocked: boolean; refreshKey: string; onBooked: () => void;
}) {
  const t = labels[language];
  const [plans, setPlans] = useState<(InventoryPlan & { id: string })[]>([]), [plan, setPlan] = useState<InventoryPlan | null>(null);
  const [sites, setSites] = useState(locations), [selected, setSelected] = useState<string[]>([]), [zero, setZero] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false), [refresh, setRefresh] = useState(0);
  const [dirty, setDirty] = useState(false), [closing, setClosing] = useState(false);
  const [ready, setReady] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      await Promise.resolve(); if (controller.signal.aborted) return;
      setReady(false);
      const entries: InventoryPlan[] = [];
      for (let page = 0; ; page++) {
        const response = await apiFetch(`/api/inventory-plans?page=${page}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const result = await response.json(); entries.push(...result.rows);
        if (result.rows.length < 50 || entries.length >= result.count) break;
      }
      const loaded: InventoryLocation[] = [];
      for (const places of [false, true]) for (let page = 0; ; page++) {
        const response = await apiFetch(`/api/operations?entity=location_details${places ? "&storage_places=1" : ""}&page=${page}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const result = await response.json(); loaded.push(...result.rows.filter((row: { archived?: boolean }) => !row.archived));
        if (result.rows.length < 50 || (page + 1) * 50 >= result.count) break;
      }
      if (!controller.signal.aborted) { setPlans(entries); setSites([...new Map([...locations, ...loaded].filter((location) => !location.archived).map((location) => [location.id, location])).values()]); setReady(true); }
    }
    void load().catch(() => { if (!controller.signal.aborted) setError(t.error); });
    return () => controller.abort();
  }, [locations, refreshKey, refresh, t.error]);
  const key = (locationId: string, materialId: string) => JSON.stringify([locationId, materialId]);
  async function save(complete: boolean) {
    if (!plan || lock.current || pending) return;
    let items = plan.items;
    if (plan.revision === 0) {
      items = selected.flatMap((location_id) => materials.filter((material) => !material.archived).map((material) => ({ location_id, material_id: material.id, expected: Number(balances.find((balance) => balance.material_id === material.id && balance.location_id === location_id)?.quantity ?? 0), counted: null }))).filter((item) => zero || item.expected !== 0);
      if (!selected.length || !items.length) { setError(t.select); return; }
      if (items.length > 500) { setError(t.limit); return; }
    }
    lock.current = true; setBusy(true); setError(""); setSaved(false);
    try {
      const response = await apiFetch("/api/inventory-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: plan.id, note: plan.note, revision: plan.revision, items, complete }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPlan({ ...plan, items, revision: result.revision, completed_at: complete ? new Date().toISOString() : null }); setSaved(true); setDirty(false); setRefresh((value) => value + 1);
      if (complete) onBooked();
    } catch (failure) { setError(failure instanceof Error && failure.message === "PLAN_CHANGED" ? t.changed : failure instanceof Error && failure.message === "INVENTORY_STOCK_CHANGED" ? t.stockChanged : t.error); }
    finally { lock.current = false; setBusy(false); }
  }
  async function open(id: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSaved(false);
    try {
      const response = await apiFetch(`/api/inventory-plans?id=${encodeURIComponent(id)}`);
      const result = await response.json();
      if (!response.ok || !result.rows[0]) throw new Error();
      setPlan({ ...result.rows[0], items: result.items.map((item: { material_id: string; location_id: string; expected_quantity: number; counted_quantity: number | null }) => ({ material_id: item.material_id, location_id: item.location_id, expected: Number(item.expected_quantity), counted: item.counted_quantity === null ? null : Number(item.counted_quantity) })) });
      setDirty(false); setClosing(false);
    } catch { setError(t.error); } finally { lock.current = false; setBusy(false); }
  }
  async function pdf() {
    if (!plan || busy) return;
    setBusy(true); setError("");
    try {
      const blob = await inventoryPlanPdf(plan, sites, materials, language), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `Inventur-${plan.id}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError(t.error); } finally { setBusy(false); }
  }
  const ordered = plan ? orderInventoryItems(plan.items, sites, materials, language) : [];
  const close = () => { if (busy) return; if (dirty) setClosing(true); else setPlan(null); };
  const changeCount = (locationId: string, materialId: string, value: string) => {
    if (!plan) return;
    setDirty(true); setSaved(false);
    setPlan({ ...plan, items: plan.items.map((entry) => key(entry.location_id, entry.material_id) === key(locationId, materialId) ? { ...entry, counted: value === "" ? null : Number(value) } : entry) });
  };
  return <>
    <div className={styles.toolbar}><button className={styles.primaryAction + " create-button"} disabled={blocked || busy || !ready} onClick={() => { setPlan({ id: createStableId(), revision: 0, note: "", items: [] }); setSelected([]); setZero(false); setError(""); setSaved(false); setDirty(false); setClosing(false); }}><Plus size={18} />{t.new}</button></div>
    {!plan && error && <p role="alert">{error}</p>}
    <OperationsDataTable rows={plans.map((entry) => ({ ...entry }))} label={t.plans} filterLabel={t.filter} emptyLabel={t.empty} actionsLabel="" columns={[
      { key: "id", label: t.id, value: (row) => String(row.id) },
      { key: "note", label: t.note, value: (row) => String(row.note) },
      { key: "created_at", label: language === "de" ? "Angelegt am" : language === "sv" ? "Skapad" : "Created", value: (row) => new Date(String(row.created_at)).toLocaleString(language, { timeZone: "Europe/Stockholm" }) },
      { key: "completed_at", label: t.status, value: (row) => row.completed_at ? t.done : t.open },
    ]} onRowActivate={(row) => void open(row.id)} />
    {plan && <TripDialog labelledBy="inventory-plan-title" onClose={close} className={styles.dialog}>
      <header className={styles.dialogHeader}><h2 id="inventory-plan-title">{t.plans}</h2><button aria-label={t.close} disabled={busy} onClick={close}><X size={18} /></button></header>
      <p>{t.id}: <strong style={{ overflowWrap: "anywhere" }}>{plan.id}</strong></p>
      <label className={styles.field}>{t.note}<input aria-label={t.note} maxLength={500} value={plan.note} disabled={busy || Boolean(plan.completed_at)} onChange={(event) => { setPlan({ ...plan, note: event.target.value }); setDirty(true); setSaved(false); }} /></label>
      {plan.revision === 0 ? <div className={styles.stockOptions}>
        <label><input type="checkbox" checked={Boolean(sites.length) && selected.length === sites.length} onChange={(event) => setSelected(event.target.checked ? sites.map((site) => site.id) : [])} />{t.all}</label>
        {sites.map((site) => <label key={site.id}><input type="checkbox" checked={selected.includes(site.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, site.id] : selected.filter((id) => id !== site.id))} />{inventoryLocationPath(site.id, sites)}</label>)}
        <label><input type="checkbox" checked={zero} onChange={(event) => setZero(event.target.checked)} />{t.zero}</label>
      </div> : <><div className={`analytics-table ${styles.inventoryDesktop}`}><table className={styles.balanceTable} aria-label={t.plans}><thead><tr><th>{t.location}</th><th>{t.name}</th><th>{t.expected}</th><th>{t.count}</th><th>{t.difference}</th></tr></thead><tbody>{ordered.map((item) => {
        const material = materials.find((entry) => entry.id === item.material_id), path = inventoryLocationPath(item.location_id, sites);
        return <tr key={key(item.location_id, item.material_id)}><td>{path}</td><td>{material?.sku} {material?.name ?? item.material_id} <small>{material?.unit}</small></td><td>{item.expected.toLocaleString(language)}</td><td><input className={styles.countInput} aria-label={`${t.count}: ${material?.name ?? item.material_id} · ${path}`} type="number" min="0" step="0.001" disabled={busy || Boolean(plan.completed_at)} value={item.counted ?? ""} onChange={(event) => changeCount(item.location_id, item.material_id, event.target.value)} /></td><td>{item.counted === null ? "-" : (item.counted - item.expected).toLocaleString(language)}</td></tr>;
      })}</tbody></table></div>
      <div className={styles.inventoryMobile}>{ordered.map((item) => {
        const material = materials.find((entry) => entry.id === item.material_id), path = inventoryLocationPath(item.location_id, sites);
        return <div key={key(item.location_id, item.material_id)} className={styles.inventoryCountRow}><p>{path}</p><strong>{material?.sku} {material?.name ?? item.material_id}</strong><div className={styles.fields}>
          <label className={styles.field}>{t.count} ({material?.unit})<input aria-label={`${t.count}: ${material?.name ?? item.material_id} · ${path}`} type="number" inputMode="decimal" min="0" step="0.001" disabled={busy || Boolean(plan.completed_at)} value={item.counted ?? ""} onChange={(event) => changeCount(item.location_id, item.material_id, event.target.value)} /></label>
          <div><p>{t.expected}: {item.expected.toLocaleString(language)} {material?.unit}</p><p>{t.difference}: {item.counted === null ? "-" : (item.counted - item.expected).toLocaleString(language)}</p></div>
        </div></div>;
      })}</div></>}
      {error && <p role="alert">{error}</p>}{saved && <p role="status">{t.saved}</p>}{pending && <p role="status">{t.pending}</p>}
      <footer className={styles.actions}>
        {plan.revision > 0 && <button disabled={busy || dirty} onClick={() => void pdf()}><FileText size={18} />PDF</button>}
        {!plan.completed_at && <button className={styles.primaryAction} disabled={busy || pending || !plan.note.trim()} onClick={() => void save(false)}><Save size={18} />{plan.revision ? t.save : t.create}</button>}
        {plan.revision > 0 && !plan.completed_at && <button disabled={busy || pending || plan.items.some((item) => item.counted === null) || !plan.note.trim()} onClick={() => void save(true)}>{t.complete}</button>}
      </footer>
      {closing && <div role="alert"><p>{language === "de" ? "Nicht gespeicherte Eingaben verwerfen?" : language === "sv" ? "Kasta osparade ändringar?" : "Discard unsaved entries?"}</p><div className={styles.actions}><button onClick={() => setClosing(false)}>{language === "de" ? "Weiter bearbeiten" : language === "sv" ? "Fortsätt redigera" : "Keep editing"}</button><button onClick={() => { setDirty(false); setClosing(false); setPlan(null); }}>{language === "de" ? "Verwerfen" : language === "sv" ? "Kasta" : "Discard"}</button></div></div>}
    </TripDialog>}
  </>;
}
