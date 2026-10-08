"use client";
import { useEffect, useMemo, useState } from "react";
import { Archive, Pencil, Plus, RefreshCw, Save, X } from "lucide-react";
import { apiFetch, tenantScopedStorageKey } from "@/lib/apiClient";
import { createSyncMutation, type SyncMutation } from "@/lib/syncQueue";
import { defaultResourceTypes, resourceFieldCatalog, resourceLanguageIndex, resourceTypesText, validateResourceType, visibleResourceFields,
  type ResourceType, type ResourceCategory } from "@/lib/resourceTypes";
import { TripDialog } from "./TripDialog";
import styles from "./ResourceTypes.module.css";

export function useResourceTypes(queue: SyncMutation[], enqueue: (mutation: SyncMutation) => void) {
  const [stored, setStored] = useState<ResourceType[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const acknowledged = queue.filter((mutation) => mutation.entityType === "resource_type" && mutation.status === "synced").map((mutation) => mutation.id).join(":");
  useEffect(() => {
    const controller = new AbortController();
    const key = tenantScopedStorageKey("workcore-resource-types-v1");
    try {
      const cached = JSON.parse(localStorage.getItem(key) ?? "[]") as ResourceType[];
      cached.forEach(validateResourceType);
      setStored(cached);
      if (cached.length) setReady(true);
    } catch { /* An invalid read cache is never a source of pending writes. */ }
    void apiFetch("/api/resource-types", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("RESOURCE_TYPES_UNAVAILABLE");
      const { types } = await response.json() as { types: ResourceType[] };
      if (!Array.isArray(types)) throw new Error("INVALID_RESOURCE_TYPES");
      types.forEach(validateResourceType);
      if (controller.signal.aborted) return;
      setStored(types); setError(false); setReady(true);
      try { localStorage.setItem(key, JSON.stringify(types)); } catch { /* The durable mutation queue is separate from this read cache. */ }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [acknowledged, refresh]);
  const types = useMemo(() => {
    const records = new Map((ready ? stored : defaultResourceTypes).map((type) => [type.id, type]));
    for (const mutation of queue.filter((row) => row.entityType === "resource_type" && row.status !== "synced" && row.status !== "conflict")) {
      records.set(mutation.entityId, { ...mutation.payload, id: mutation.entityId, revision: (mutation.expectedRevision ?? 0) + 1 } as ResourceType);
    }
    return [...records.values()];
  }, [stored, queue, ready]);
  return { types, error, ready, retry: () => setRefresh((value) => value + 1), save: (type: ResourceType) => {
    if (!ready) throw new Error("RESOURCE_TYPES_UNAVAILABLE");
    validateResourceType(type);
    enqueue(createSyncMutation({ entityType: "resource_type", entityId: type.id, resourceId: type.id,
      operation: type.revision == null ? "create" : "update", expectedRevision: type.revision,
      payload: { name: type.name.trim(), category: type.category, archived: type.archived, fields: type.fields } }));
  } };
}

export function ResourceTypesPanel({ types, language, save, error, ready, retry }: { types: ResourceType[]; language: string; save: (type: ResourceType) => void; error: boolean; ready: boolean; retry: () => void }) {
  const index = resourceLanguageIndex(language);
  const [draft, setDraft] = useState<ResourceType | null>(null);
  const [notice, setNotice] = useState("");
  const word = (de: string, sv: string, en: string) => [de, sv, en][index];
  function persist() {
    if (!draft) return;
    try { save(draft); setDraft(null); setNotice(""); } catch { setNotice(word("Bitte Name und Feldkonfiguration prüfen.", "Kontrollera namn och fältkonfiguration.", "Check name and field configuration.")); }
  }
  return <section className={styles.panel}>
    <header className={styles.toolbar}><h2>{resourceTypesText.title[index]}</h2>
      <button className="primary-button" disabled={!ready} onClick={() => { setNotice(""); setDraft({ ...defaultResourceTypes[6], id: crypto.randomUUID(), name: "", fields: defaultResourceTypes[6].fields.map((field) => ({ ...field })) }); }}><Plus size={16}/>{resourceTypesText.new[index]}</button></header>
    {error && <p role="alert">{resourceTypesText.unavailable[index]} <button className="ghost-button" aria-label={word("Erneut versuchen", "Försök igen", "Retry")} onClick={retry}><RefreshCw size={16}/></button></p>}
    {types.map((type) => <div className={styles.typeRow} key={type.id}><strong>{type.name}</strong><span>{resourceTypesText[type.category][index]}</span>
      {type.archived && <span>{word("Archiviert", "Arkiverad", "Archived")}</span>}
      <button className="icon-button" disabled={!ready} title={word("Bearbeiten", "Redigera", "Edit")} aria-label={`${word("Bearbeiten", "Redigera", "Edit")} ${type.name}`} onClick={() => { setNotice(""); setDraft({ ...type, fields: type.fields.map((field) => ({ ...field })) }); }}><Pencil size={16}/></button>
      <button className="icon-button" disabled={!ready} title={word("Archivieren / Aktivieren", "Arkivera / Aktivera", "Archive / Activate")} aria-label={`${word("Archivieren / Aktivieren", "Arkivera / Aktivera", "Archive / Activate")} ${type.name}`} onClick={() => { try { save({ ...type, archived: !type.archived }); } catch { setNotice(word("Speichern fehlgeschlagen", "Kunde inte spara", "Save failed")); } }}><Archive size={16}/></button>
    </div>)}
    {!draft && notice && <p role="alert">{notice}</p>}
    {draft && <TripDialog labelledBy="resource-type-title" onClose={() => setDraft(null)} className={styles.dialog}>
      <header className={styles.toolbar}><h2 id="resource-type-title">{resourceTypesText.type[index]}</h2><button className="icon-button" aria-label={word("Schließen", "Stäng", "Close")} onClick={() => setDraft(null)}><X size={18}/></button></header>
      <label>{resourceFieldCatalog[0].labels[index]}<input value={draft.name} maxLength={200} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
      <label>{resourceTypesText.category[index]}<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as ResourceCategory })}>
        {(["vehicle", "machine", "equipment"] as const).map((category) => <option key={category} value={category}>{resourceTypesText[category][index]}</option>)}
      </select></label>
      <div className={styles.fields}><div className={styles.fieldRow}><strong>{resourceTypesText.fields[index]}</strong><span>{resourceTypesText.enabled[index]}</span><span>{resourceTypesText.required[index]}</span><span>{resourceTypesText.order[index]}</span></div>
      {draft.fields.map((field) => { const label = resourceFieldCatalog.find((item) => item.key === field.key)!.labels[index];
        const update = (values: Partial<typeof field>) => setDraft({ ...draft, fields: draft.fields.map((row) => row.key === field.key ? { ...row, ...values } : row) });
        return <div className={styles.fieldRow} key={field.key}><span>{label}</span>
          <input type="checkbox" aria-label={`${resourceTypesText.enabled[index]} ${label}`} checked={field.enabled} disabled={field.key === "name"} onChange={(event) => update({ enabled: event.target.checked, required: event.target.checked && field.required })}/>
          <input type="checkbox" aria-label={`${resourceTypesText.required[index]} ${label}`} checked={field.required} disabled={!field.enabled || field.key === "name"} onChange={(event) => update({ required: event.target.checked })}/>
          <input type="number" min={0} max={1000} aria-label={`${resourceTypesText.order[index]} ${label}`} value={field.order} onChange={(event) => update({ order: Number(event.target.value) })}/>
        </div>; })}</div>
      {notice && <p role="alert">{notice}</p>}
      <footer className={styles.toolbar}><button className="ghost-button" onClick={() => setDraft(null)}><X size={16}/>{word("Abbrechen", "Avbryt", "Cancel")}</button><button className="primary-button" onClick={persist}><Save size={16}/>{word("Speichern", "Spara", "Save")}</button></footer>
    </TripDialog>}
  </section>;
}

export function DynamicResourceFields({ type, values, language, employees, onChange }: { type: ResourceType; values: Record<string, unknown>; language: string; employees: { id: string; name: string }[]; onChange: (key: string, value: string | boolean) => void }) {
  const index = resourceLanguageIndex(language);
  return <>{visibleResourceFields(type).map((field) => {
    const label = field.labels[index]; const value = values[field.key];
    const options = field.kind === "employee" ? employees : field.kind === "country" ? [{ id: "DE", name: "Deutschland" }, { id: "SE", name: "Sverige" }]
      : field.kind === "language" ? [{ id: "de", name: "Deutsch" }, { id: "sv", name: "Svenska" }, { id: "en", name: "English" }]
      : field.kind === "intervalUnit" ? (["days", "hours", "km"] as const).map((key) => ({ id: key, name: resourceTypesText[key][index] }))
      : field.key === "trackingMode" ? [{ id: "none", name: ["Keines", "Ingen", "None"][index] }, { id: "phone", name: ["Telefon", "Telefon", "Phone"][index] }, { id: "tracker", name: "Tracker" }] : null;
    return <label className={`resource-field ${styles.dynamicField}`} key={field.key}><span>{label}{field.required ? " *" : ""}</span>
      {field.kind === "boolean" ? <input aria-label={label} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(field.key, event.target.checked)}/>
        : options ? <select aria-label={label} required={field.required} value={String(value ?? "")} onChange={(event) => onChange(field.key, event.target.value)}><option value="">—</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
        : <input aria-label={label} required={field.required} type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"} min={field.kind === "number" ? 0 : undefined} step="any" value={String(value ?? "")} onChange={(event) => onChange(field.key, event.target.value)}/>}</label>;
  })}</>;
}
