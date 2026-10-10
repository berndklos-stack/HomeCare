"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { operationLabel } from "@/lib/operationsUi";
import { createSyncMutation, type SyncMutation } from "@/lib/syncQueue";
import { validateOperationsMutation } from "@/lib/operationsCommands";

export function MaterialPurchasing({ materialId, language, queue, enqueue }: {
  materialId: string; language: "de" | "sv" | "en"; queue: SyncMutation[];
  enqueue: (input: SyncMutation) => unknown;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [suppliers, setSuppliers] = useState<{ id: string; company: string }[]>([]);
  const [draft, setDraft] = useState({ preferred_supplier_id: "", reorder_quantity: "", notes: "" });
  const [revision, setRevision] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const lock = useRef(false);
  const active = queue.find((mutation) => mutation.status !== "synced" && mutation.entityId === materialId && ["material", "operations"].includes(mutation.entityType));
  const pending = Boolean(active);
  const settled = queue.filter((mutation) => mutation.status === "synced" && mutation.entityId === materialId).map((mutation) => mutation.id).join(":");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setRevision(null);
      const response = await apiFetch(`/api/operations?entity=material_details&id=${encodeURIComponent(materialId)}`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      const material = data.rows?.find((row: { id: string }) => row.id === materialId);
      if (!material || !Number.isSafeInteger(material.revision)) throw new Error("unavailable");
      const all: { id: string; company: string; archived?: boolean }[] = [];
      for (let page = 0; ; page++) {
        const response = await apiFetch(`/api/operations?entity=suppliers&page=${page}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        all.push(...data.rows);
        if (data.rows.length < 50) break;
      }
      if (controller.signal.aborted) return;
      setSuppliers(all.filter((row) => !row.archived || row.id === material.preferred_supplier_id).sort((a, b) => a.company.localeCompare(b.company, language)));
      setDraft({ preferred_supplier_id: material.preferred_supplier_id ?? "", reorder_quantity: material.reorder_quantity == null ? "" : String(material.reorder_quantity), notes: material.notes ?? "" });
      setRevision(material.revision); lock.current = false;
    }
    void load().catch(() => { if (!controller.signal.aborted) setError("unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [materialId, language, settled, refresh]);
  function save() {
    if (lock.current || pending || revision === null || loading) return;
    try {
      const input = { entityId: materialId, resourceId: materialId, entityType: "operations" as const, operation: "update" as const, expectedRevision: revision,
        payload: { kind: "save", entity: "material_details", values: { preferred_supplier_id: draft.preferred_supplier_id || null, reorder_quantity: draft.reorder_quantity === "" ? null : Number(draft.reorder_quantity), notes: draft.notes || null } } };
      const mutation = createSyncMutation(input);
      validateOperationsMutation(mutation);
      lock.current = true; enqueue(mutation); setError("");
    } catch { lock.current = false; setError("INVALID_OPERATIONS_COMMAND"); }
  }
  const disabled = loading || pending || revision === null;
  return <section aria-label={t("material_details")}>
    <h3>{t("material_details")}</h3>
    <div className="form-grid compact-form">
      <label><span>{t("preferred_supplier_id")}</span><select aria-label={t("preferred_supplier_id")} disabled={disabled} value={draft.preferred_supplier_id} onChange={(event) => setDraft({ ...draft, preferred_supplier_id: event.target.value })}>
        <option value="">—</option>{draft.preferred_supplier_id && !suppliers.some((row) => row.id === draft.preferred_supplier_id) && <option value={draft.preferred_supplier_id}>{language === "de" ? "Nicht verfügbar" : language === "sv" ? "Inte tillgänglig" : "Unavailable"}</option>}
        {suppliers.map((row) => <option key={row.id} value={row.id}>{row.company}</option>)}</select></label>
      <label><span>{t("reorder_quantity")}</span><input aria-label={t("reorder_quantity")} disabled={disabled} type="number" min="0" step="0.001" value={draft.reorder_quantity} onChange={(event) => setDraft({ ...draft, reorder_quantity: event.target.value })} /></label>
      <label className="wide"><span>{t("notes")}</span><textarea aria-label={t("notes")} maxLength={9000} disabled={disabled} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
    </div>
    {error && <p role="alert">{t(error)}</p>}
    {active && <p role="status">{t(["failed", "conflict"].includes(active.status) ? "failed" : "waiting")}</p>}
    <div className="message-actions">{error && <button className="ghost-button" type="button" aria-label={t("refresh")} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /></button>}
      <button className="ghost-button" type="button" disabled={disabled} onClick={save}><Check size={16} />{language === "de" ? "Beschaffungsdaten speichern" : language === "sv" ? "Spara inköpsuppgifter" : "Save purchasing details"}</button>
    </div>
  </section>;
}
