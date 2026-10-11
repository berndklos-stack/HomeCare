"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { StockMaterialLine } from "@/lib/jobStock";
import styles from "./OperationsWorkspace.module.css";

type Material = { id: string; name: string; sku?: string; unit?: string; archived?: boolean };
type Location = { id: string; name: string; archived?: boolean };
type Line = { material_id: string; source_id: string; allocated_quantity: number; consumed_quantity: string; additional: boolean; material?: { name: string; sku?: string; unit?: string } };
export function FieldMaterialReview({ job, date, materials, locations, language, onCancel, onComplete }: {
  job: { id: string; revision?: number }; date: string; materials: Material[]; locations: Location[]; language: "de" | "sv" | "en";
  onCancel: () => void; onComplete: (items: StockMaterialLine[]) => void;
}) {
  const t = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  const [lines, setLines] = useState<Line[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [allConsumed, setAllConsumed] = useState<string>(""), [additionalUsed, setAdditionalUsed] = useState<string>("");
  const [confirmed, setConfirmed] = useState<StockMaterialLine[] | null>(null);
  const [retry, setRetry] = useState(0);
  const id = useRef<string>(crypto.randomUUID());
  const surface = useRef<HTMLElement>(null);
  const lock = useRef(false);
  useEffect(() => { surface.current?.scrollIntoView({ block: "start" }); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void apiFetch(`/api/field-material-review?job=${encodeURIComponent(job.id)}&date=${encodeURIComponent(date)}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (data.stockMaterialItems) { setConfirmed(data.stockMaterialItems); return; }
      if (!data.lines?.length) { onComplete([]); return; }
      setLines(data.lines.map((line: Omit<Line, "consumed_quantity" | "additional">) => ({ ...line, consumed_quantity: String(line.allocated_quantity), additional: false })));
    }).catch(() => { if (!controller.signal.aborted) setError(t("Material konnte nicht geprüft werden. Bitte Verbindung prüfen und erneut versuchen.", "Materialet kunde inte kontrolleras. Kontrollera anslutningen och försök igen.", "Could not check materials. Check your connection and try again.")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // The completion callback changes with checklist edits; only reload the material snapshot explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, date, retry]);
  const ready = !loading && !busy && allConsumed !== "" && additionalUsed !== "" && (additionalUsed === "no" || lines.some((line) => line.additional));
  async function finish() {
    if (lock.current) return;
    if (confirmed) { onComplete(confirmed); return; }
    if (!ready) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const payload = lines.map((line) => ({ material_id: line.material_id, source_id: line.source_id, allocated_quantity: line.allocated_quantity, consumed_quantity: Number(line.consumed_quantity), additional: line.additional }));
      if (payload.some((line, index) => !lines[index].consumed_quantity.trim() || !line.material_id || !line.source_id || !Number.isFinite(line.consumed_quantity) || line.consumed_quantity < 0 || (line.additional ? line.consumed_quantity <= 0 : line.consumed_quantity > line.allocated_quantity))) throw new Error("INVALID_MATERIAL_REVIEW");
      const response = await apiFetch("/api/field-material-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id.current, job: job.id, date, revision: job.revision ?? 1, allConsumed: allConsumed === "yes", additionalUsed: additionalUsed === "yes", lines: payload }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConfirmed(data.stockMaterialItems);
      onComplete(data.stockMaterialItems);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "INSUFFICIENT_STOCK" ? t("Der Fahrzeugbestand reicht nicht aus. Mengen prüfen.", "Fordonslagret räcker inte. Kontrollera mängderna.", "Insufficient vehicle stock. Check quantities.") : t("Verbrauch konnte nicht bestätigt werden. Mengen, Fahrzeug und Verbindung prüfen. Der Auftrag bleibt offen.", "Förbrukningen kunde inte bekräftas. Kontrollera mängder, fordon och anslutning. Uppdraget är fortfarande öppet.", "Consumption could not be confirmed. Check quantities, vehicle and connection. The job remains open."));
    } finally { lock.current = false; setBusy(false); }
  }
  return <section ref={surface} className={styles.fieldMaterialReview} aria-labelledby="field-material-title">
    <h3 id="field-material-title">{t("Materialverbrauch beim Abschluss", "Materialförbrukning vid avslut", "Material consumption at completion")}</h3>
    {loading && <p role="status">{t("Material wird geprüft…", "Kontrollerar material…", "Checking materials…")}</p>}
    {confirmed ? <p>{t("Materialverbrauch ist bestätigt.", "Materialförbrukningen är bekräftad.", "Material consumption is confirmed.")}</p> : !loading && <>
      <fieldset disabled={busy}><legend>{t("Wurde das zugewiesene Material vollständig verbraucht?", "Förbrukades allt tilldelat material?", "Was all assigned material consumed?")}</legend>
        {[["yes", t("Ja", "Ja", "Yes")], ["no", t("Nein, Mengen anpassen", "Nej, justera mängder", "No, adjust quantities")]].map(([value, label]) => <label key={value}><input type="radio" name="all-consumed" checked={allConsumed === value} onChange={() => { setAllConsumed(value); if (value === "yes") setLines((current) => current.map((line) => line.additional ? line : { ...line, consumed_quantity: String(line.allocated_quantity) })); }} />{label}</label>)}
      </fieldset>
      {lines.filter((line) => !line.additional).map((line) => <div className={styles.materialReviewLine} key={`${line.material_id}:${line.source_id}`}>
        <div><strong>{line.material?.sku ? `${line.material.sku} · ` : ""}{line.material?.name}</strong><small>{locations.find((location) => location.id === line.source_id)?.name ?? line.source_id} · {t("Zugewiesen", "Tilldelat", "Assigned")}: {line.allocated_quantity} {line.material?.unit}</small></div>
        <label>{t("Verbraucht", "Förbrukat", "Consumed")}<input aria-label={`${t("Verbraucht", "Förbrukat", "Consumed")}: ${line.material?.name}`} type="number" min="0" max={line.allocated_quantity} step="0.001" disabled={busy || allConsumed !== "no"} value={line.consumed_quantity} onChange={(event) => setLines((current) => current.map((item) => item === line ? { ...item, consumed_quantity: event.target.value } : item))} /></label>
      </div>)}
      <fieldset disabled={busy}><legend>{t("Wurde zusätzliches Material für die Abrechnung gebraucht?", "Användes extra material som ska faktureras?", "Was additional billable material used?")}</legend>
        {[["yes", t("Ja", "Ja", "Yes")], ["no", t("Nein", "Nej", "No")]].map(([value, label]) => <label key={value}><input type="radio" name="additional-used" checked={additionalUsed === value} onChange={() => { setAdditionalUsed(value); if (value === "no") setLines((current) => current.filter((line) => !line.additional)); }} />{label}</label>)}
      </fieldset>
      {additionalUsed === "yes" && <>
        {lines.map((line, index) => line.additional && <div className={styles.materialReviewExtra} key={index}>
          <label>{t("Material", "Material", "Material")}<select aria-label={`${t("Zusatzmaterial", "Extra material", "Additional material")} ${index + 1}`} disabled={busy} value={line.material_id} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, material_id: event.target.value } : item))}><option value="">—</option>{materials.filter((material) => !material.archived).map((material) => <option key={material.id} value={material.id}>{material.sku ? `${material.sku} · ` : ""}{material.name}</option>)}</select></label>
          <label>{t("Fahrzeug", "Fordon", "Vehicle")}<select disabled={busy} value={line.source_id} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, source_id: event.target.value } : item))}>{[...new Set(lines.filter((item) => !item.additional).map((item) => item.source_id))].map((source) => <option key={source} value={source}>{locations.find((location) => location.id === source)?.name ?? source}</option>)}</select></label>
          <label>{t("Menge", "Mängd", "Quantity")}<input type="number" min="0.001" step="0.001" disabled={busy} value={line.consumed_quantity} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, consumed_quantity: event.target.value } : item))} /></label>
          <button type="button" disabled={busy} aria-label={t("Zusatzmaterial entfernen", "Ta bort extra material", "Remove additional material")} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><Trash2 size={18} /></button>
        </div>)}
        <button className="create-button" type="button" disabled={busy} onClick={() => setLines((current) => [...current, { material_id: "", source_id: current[0].source_id, allocated_quantity: 0, consumed_quantity: "1", additional: true }])}><Plus size={18} />{t("Zusatzmaterial hinzufügen", "Lägg till extra material", "Add additional material")}</button>
      </>}
    </>}
    {error && <p role="alert">{error}</p>}
    <footer className={styles.actions}>
      <button type="button" disabled={busy} onClick={onCancel}>{t("Abbrechen", "Avbryt", "Cancel")}</button>
      {error && <button type="button" disabled={busy} onClick={() => setRetry((value) => value + 1)}>{t("Erneut prüfen", "Kontrollera igen", "Check again")}</button>}
      <button className="primary-button" type="button" disabled={!confirmed && !ready} onClick={() => void finish()}><Check size={18} />{t("Verbrauch bestätigen und Auftrag abschließen", "Bekräfta förbrukning och avsluta uppdrag", "Confirm consumption and complete job")}</button>
    </footer>
  </section>;
}
