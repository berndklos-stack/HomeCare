"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Archive, ChevronLeft, ChevronRight, History, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { apiFetch, tenantScopedStorageKey } from "@/lib/apiClient";
import { createStableId, type SyncMutation } from "@/lib/syncQueue";
import { operationsLabels, maintenanceStatus, type OperationsLanguage } from "@/lib/operations";
import { operationsFields, validateOperationsMutation, type OperationsCommand, type OperationsEntity, type OperationsRow } from "@/lib/operationsCommands";
import { operationLabel } from "@/lib/operationsUi";
import { TripDialog } from "./TripDialog";
import styles from "./OperationsWorkspace.module.css";
import { OperationsStock } from "./OperationsStock";
import { OperationsDocumentUpload } from "./OperationsDocumentUpload";
import { OperationsHistory } from "./OperationsHistory";

type Reference = { id: string; name: string; minStock?: string; revision?: number; hours?: number; mileage?: number; availability?: string; documents?: { id: string; name: string }[] };
type Props = {
  children: ReactNode; language: OperationsLanguage; queue: SyncMutation[];
  enqueue: (input: Parameters<typeof import("@/lib/syncQueue").createSyncMutation>[0]) => unknown;
  materials: Reference[]; locations: Reference[]; resources: Reference[]; employees: Reference[]; jobs: Reference[]; projects: Reference[];
  onOpenMasterData: (tab: "materials" | "resources") => void;
};
type Form = { entity: OperationsEntity; row?: OperationsRow; kind: "save" | "receive" | "complete"; values: Record<string, string>; target?: OperationsRow };
const numeric = new Set(["quantity", "unit_price", "due_mileage", "due_hours", "interval_days", "interval_mileage", "interval_hours", "purchase_price", "operating_hours", "reorder_quantity", "mileage", "cost"]);
const required: Partial<Record<OperationsEntity, string[]>> = {
  suppliers: ["supplier_number", "company"], supplier_contacts: ["supplier_id", "name"],
  purchase_orders: ["order_number", "supplier_id", "order_date", "location_id", "currency"],
  purchase_order_items: ["order_id", "material_id", "quantity", "unit_price"],
  resource_assignments: ["resource_id", "starts_at"], maintenance_plans: ["resource_id", "name", "maintenance_type"],
};
const groups: Record<string, OperationsEntity[]> = {
  inventory: ["material_details", "location_details"], purchasing: ["suppliers", "purchase_orders"],
  resources: ["resource_details", "resource_assignments"], maintenance: ["maintenance_plans"],
};
const enums: Record<string, string[]> = {
  equipment_kind: ["vehicle", "machine", "tool", "equipment", "trailer", "other"],
  availability: ["available", "in_use", "maintenance", "repair", "unavailableStatus", "archived"],
  location_kind: ["warehouse", "vehicle", "project", "other"],
};

export function OperationsWorkspace(props: Props) {
  const { language, queue, enqueue } = props;
  const t = (key: string) => operationLabel(key, language);
  const [tab, setTab] = useState("inventory");
  const [entity, setEntity] = useState<OperationsEntity>("material_details");
  const [parent, setParent] = useState<OperationsRow | null>(null);
  const [rows, setRows] = useState<OperationsRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stockActive, setStockActive] = useState(false);
  const [error, setError] = useState("");
  const [suppliers, setSuppliers] = useState<Reference[]>([]);
  const [orders, setOrders] = useState<Reference[]>([]);
  const [resourceDetails, setResourceDetails] = useState<Reference[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [archive, setArchive] = useState<OperationsRow | null>(null);
  const [formError, setFormError] = useState("");
  const [consumption, setConsumption] = useState<{ material_id: string; location_id: string; quantity: string }[]>([]);
  const [documentPending, setDocumentPending] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<{ id: string; name: string } | null>(null);
  const [history, setHistory] = useState<{ entity: "purchase_receipts" | "maintenance_events"; row: OperationsRow; title: string } | null>(null);
  const settled = queue.filter((m) => m.entityType === "operations" && m.status === "synced").map((m) => m.id).join(":");
  const active = queue.filter((m) => m.entityType === "operations" && m.status !== "synced");
  const blocked = (id: string) => active.some((m) => m.entityId === id || m.resourceId === id);
  const cacheKey = tenantScopedStorageKey("workcore-operations-read-page");

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuerySearch(search); setPage(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch("/api/operations?entity=stock_status", { signal: controller.signal }).then(async (r) => r.ok ? r.json() : null)
      .then((data) => { if (!controller.signal.aborted) setStockActive(Boolean(data?.active)); }).catch(() => {});
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRows([]);
    // One bounded read page, not a growing cache per search/page/report.
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) ?? "null");
      if (cached?.entity === entity && cached.parent === (parent?.id ?? "") && cached.page === page && cached.search === querySearch) {
        setRows(cached.rows); setCount(cached.count);
      }
    } catch { /* Read cache is optional. */ }
    const query = new URLSearchParams({ entity, page: String(page) });
    if (querySearch) query.set("search", querySearch);
    if (parent) query.set("parent", parent.id);
    apiFetch(`/api/operations?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error("OPERATIONS_UNAVAILABLE"); return r.json(); })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRows(data.rows); setCount(data.count);
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ entity, parent: parent?.id ?? "", page, search: querySearch, rows: data.rows, count: data.count })); } catch { /* Queue durability is independent of read caching. */ }
      })
      .catch(() => { if (!controller.signal.aborted) setError("unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [entity, page, parent, refresh, settled, cacheKey, querySearch]);

  useEffect(() => {
    const controller = new AbortController();
    // Reference lists are explicitly paginated, not silently truncated to 50.
    async function references(kind: string, label: string, setter: (r: Reference[]) => void) {
      const result: Reference[] = [];
      let page = 0, count = 1;
      while (result.length < count && !controller.signal.aborted) {
        const response = await apiFetch(`/api/operations?entity=${kind}&page=${page++}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json(); count = data.count;
        result.push(...data.rows.map((r: OperationsRow) => ({ id: r.id, name: String(r[label] ?? r.id), revision: r.revision,
          hours: r.operating_hours == null ? undefined : Number(r.operating_hours), availability: r.availability == null ? undefined : String(r.availability) })));
        if (!data.rows.length) break;
      }
      if (!controller.signal.aborted) setter(result);
    }
    void references("suppliers", "company", setSuppliers).catch(() => {});
    if (tab !== "inventory") {
      void references("purchase_orders", "order_number", setOrders).catch(() => {});
      void references("resource_details", "id", setResourceDetails).catch(() => {});
    }
    return () => controller.abort();
  }, [tab, settled, refresh]);

  const parentId = parent?.id;
  useEffect(() => {
    if (!parentId) return;
    const controller = new AbortController();
    const kind = entity === "purchase_order_items" ? "purchase_orders" : "suppliers";
    apiFetch(`/api/operations?entity=${kind}&id=${encodeURIComponent(parentId)}`, { signal: controller.signal })
      .then(async (r) => r.ok ? r.json() : null).then((data) => {
        if (!controller.signal.aborted && data?.rows[0]) setParent(data.rows[0]);
      }).catch(() => {});
    return () => controller.abort();
  }, [parentId, entity, settled, refresh]);

  const refs = useMemo(() => ({
    supplier_id: suppliers, preferred_supplier_id: suppliers, order_id: orders,
    resource_id: props.resources, employee_id: props.employees, responsible_person_id: props.employees,
    material_id: props.materials, location_id: props.locations, job_id: props.jobs, project_id: props.projects,
    document_id: [...(props.resources.find((r) => r.id === form?.row?.resource_id)?.documents ?? []), ...(uploadedDocument ? [uploadedDocument] : [])],
  }), [suppliers, orders, props.resources, props.employees, props.materials, props.locations, props.jobs, props.projects, form?.row?.resource_id, uploadedDocument]);
  function title(row: OperationsRow) {
    const existing = entity === "resource_details" ? props.resources : entity === "material_details" ? props.materials : entity === "location_details" ? props.locations : [];
    return existing.find((r) => r.id === row.id)?.name ?? String(row.company ?? row.name ?? row.order_number ??
      props.materials.find((r) => r.id === row.material_id)?.name ?? props.resources.find((r) => r.id === row.resource_id)?.name ?? row.id);
  }
  function change(next: OperationsEntity, owner: OperationsRow | null = null) {
    setEntity(next); setParent(owner); setPage(0); setSearch(""); setQuerySearch(""); setForm(null);
  }
  function open(kind: Form["kind"], row?: OperationsRow) {
    setFormError(""); setConsumption([]);
    setDocumentPending(false); setUploadedDocument(null);
    const values: Record<string, string> = {};
    if (kind === "save") {
      for (const key of operationsFields[entity]) values[key] = row?.[key] == null ? "" : String(row[key]);
      if (!row) {
        if (parent && entity === "purchase_order_items") values.order_id = parent.id;
        if (parent && entity === "supplier_contacts") values.supplier_id = parent.id;
        if (entity === "purchase_orders") { values.order_date = new Date().toLocaleDateString("sv-SE"); values.currency = "SEK"; }
        if (entity === "resource_assignments") values.starts_at = new Date().toISOString();
      }
    } else if (kind === "receive") { values.quantity = ""; values.note = ""; }
    else { values.completed_date = new Date().toLocaleDateString("sv-SE"); values.cost = "0"; values.currency = "SEK"; values.notes = ""; }
    setForm({ kind, entity, row, target: kind === "receive" ? parent ?? undefined : row, values });
  }
  function submitCommand(id: string, command: OperationsCommand, operation: SyncMutation["operation"], revision?: number, aggregate?: string) {
    const input = { entityType: "operations" as const, entityId: id, resourceId: aggregate ?? id, payload: command as unknown as Record<string, unknown>, operation, expectedRevision: revision };
    validateOperationsMutation({ ...input, id: createStableId() });
    enqueue(input);
  }
  function save() {
    if (!form || documentPending) return;
    try {
      const v = form.values;
      if (form.kind === "save") {
        if (form.entity === "maintenance_plans" && !["due_date", "due_mileage", "due_hours"].some((key) => v[key]?.trim())) {
          throw new Error("maintenanceDueRequired");
        }
        const values: Record<string, unknown> = {};
        for (const key of operationsFields[form.entity]) {
          values[key] = v[key] === "" ? null : numeric.has(key) ? Number(v[key]) : key === "archived" ? v[key] === "true"
            : key === "availability" && v[key] === "unavailableStatus" ? "unavailable" : v[key];
        }
        if (form.entity === "suppliers" && values.archived === null) values.archived = false;
        submitCommand(form.row?.id ?? createStableId(), { kind: "save", entity: form.entity, values }, form.row ? "update" : "create", form.row?.revision,
          form.entity === "purchase_order_items" ? String(values.order_id) : form.row?.id);
      } else if (form.kind === "receive") {
        if (!form.target || !form.row) throw new Error("Missing purchase order");
        submitCommand(form.target.id, { kind: "receive", item_id: form.row.id, quantity: Number(v.quantity), note: v.note }, "update", form.target.revision);
      } else {
        if (!form.row) return;
        submitCommand(form.row.id, { kind: "complete", completed_date: v.completed_date, mileage: v.mileage ? Number(v.mileage) : null,
          operating_hours: v.operating_hours ? Number(v.operating_hours) : null, cost: Number(v.cost), currency: v.currency,
          supplier_id: v.supplier_id || null, document_id: v.document_id || null, notes: v.notes,
          materials: consumption.map((m) => ({ ...m, quantity: Number(m.quantity) })) }, "update", form.row.revision, String(form.row.resource_id));
      }
      setForm(null);
    } catch (e) { setFormError(e instanceof Error ? e.message : "INVALID_OPERATIONS_COMMAND"); }
  }
  function input(key: string, values: Record<string, string>, update: (key: string, value: string) => void, mandatory = false) {
    const references = refs[key as keyof typeof refs];
    const choices = enums[key];
    const value = key === "availability" && values[key] === "unavailable" ? "unavailableStatus" : values[key] ?? "";
    return <label key={key} className={styles.field}><span>{t(key)}</span>
      {key === "archived" ? <input type="checkbox" checked={value === "true"} onChange={(e) => update(key, String(e.target.checked))} />
        : references || choices ? <select aria-label={t(key)} required={mandatory} value={value} onChange={(e) => update(key, e.target.value)}>
          <option value="">—</option>{references ? references.map((r) => <option key={r.id} value={r.id}>{r.name}</option>) : choices?.map((c) => <option key={c} value={c}>{t(c)}</option>)}
        </select> : key === "notes" || key === "warranty_notes" || key === "address" ? <textarea value={value} onChange={(e) => update(key, e.target.value)} />
          : <input required={mandatory} type={numeric.has(key) ? "number" : key.endsWith("_date") || ["due_date", "expected_delivery", "warranty_until"].includes(key) ? "date" : "text"}
            min={numeric.has(key) ? 0 : undefined} step={numeric.has(key) ? "any" : undefined} value={value} onChange={(e) => update(key, e.target.value)} />}
    </label>;
  }
  const editable = !entity.endsWith("_details");
  const fields = form?.kind === "receive" ? ["quantity", "note"] : form?.kind === "complete"
    ? ["completed_date", "mileage", "operating_hours", "cost", "currency", "supplier_id", "document_id", "notes"] : form ? operationsFields[form.entity] : [];
  return <div className={styles.workspace}>
    <nav className={styles.tabs} aria-label="Operations">{Object.keys(groups).map((key) => <button key={key} className={tab === key ? styles.selected : ""}
      onClick={() => { setTab(key); change(groups[key][0]); }}>{operationsLabels[key as keyof typeof operationsLabels][language]}</button>)}</nav>
    {tab === "inventory" && (stockActive ? <OperationsStock {...props} /> : props.children)}
    <div className={styles.toolbar}>
      {(tab === "inventory" || tab === "resources") && <button onClick={() => props.onOpenMasterData(tab === "inventory" ? "materials" : "resources")}><Pencil size={18} />{language === "de" ? "Stammdaten" : language === "sv" ? "Grunddata" : "Master data"}</button>}
      {groups[tab].map((key) => <button key={key} aria-pressed={entity === key} onClick={() => change(key)}>{t(key)}</button>)}
      {parent && <button onClick={() => change(entity === "supplier_contacts" ? "suppliers" : "purchase_orders")}>{String(parent.company ?? parent.order_number)} <ChevronLeft size={16} /></button>}
      {["suppliers", "purchase_orders", "maintenance_plans", "resource_details", "material_details", "location_details"].includes(entity) && <input aria-label={language === "de" ? "Einträge suchen" : language === "sv" ? "Sök poster" : "Search records"} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
      <button title={t("refresh")} aria-label={t("refresh")} onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={18} /></button>
      {editable && !error && <button onClick={() => open("save")} disabled={entity === "purchase_order_items" && (!parent || parent.status !== "draft" || blocked(parent.id))}><Plus size={18} />{t("create")}</button>}
    </div>
    {error && <p role="status">{t(error)}</p>}
    {active.length > 0 && <div role="status" className={styles.pending}>{active.map((m) => <p key={m.id}>{t(m.status === "failed" || m.status === "conflict" ? "failed" : "waiting")}: {String((m.payload.values as Record<string, unknown> | undefined)?.company ?? (m.payload.values as Record<string, unknown> | undefined)?.name ?? m.entityId)}</p>)}</div>}
    <div className={styles.list} aria-busy={loading}>
      {!rows.length && !loading && !error && <p>{t("empty")}</p>}
      {rows.map((row) => <article key={row.id} className={styles.row}>
        <div><strong>{title(row)}</strong><div className={styles.meta}>{row.status ? operationsLabels[row.status as keyof typeof operationsLabels]?.[language] : null}
          {entity === "maintenance_plans" && (row.in_progress ? t("inProgress") : operationsLabels[maintenanceStatus({ dueDate: row.due_date as string | null, dueMileage: row.due_mileage == null ? null : Number(row.due_mileage), dueHours: row.due_hours == null ? null : Number(row.due_hours) }, { date: new Date().toLocaleDateString("sv-SE"), mileage: props.resources.find((r) => r.id === row.resource_id)?.mileage, hours: resourceDetails.find((r) => r.id === row.resource_id)?.hours }, Boolean(row.completed))][language])}
          {row.quantity != null && <span>{t("quantity")}: {String(row.quantity)} · {t("unit_price")}: {String(row.unit_price)}</span>}
          {row.due_date ? <span>{t("due_date")}: {String(row.due_date)}</span> : null}
          {row.availability ? <span>{t(row.availability === "unavailable" ? "unavailableStatus" : String(row.availability))}</span> : null}
        </div></div>
        <div className={styles.actions}>
          {(entity === "purchase_order_items" || entity === "maintenance_plans") && <button onClick={() => setHistory({ entity: entity === "purchase_order_items" ? "purchase_receipts" : "maintenance_events", row, title: title(row) })}><History size={18} />{t(entity === "purchase_order_items" ? "purchase_receipts" : "maintenance_events")}</button>}
          {entity === "suppliers" && <button onClick={() => change("supplier_contacts", row)}>{t("supplier_contacts")}</button>}
          {entity === "purchase_orders" && <><button onClick={() => change("purchase_order_items", row)}>{t("purchase_order_items")}</button>
            {row.status === "draft" && <button disabled={blocked(row.id)} onClick={() => { try { submitCommand(row.id, { kind: "order" }, "update", row.revision); } catch (e) { setFormError(String(e)); } }}>{t("order")}</button>}
            {["draft", "ordered"].includes(String(row.status)) && <button disabled={blocked(row.id)} onClick={() => { try { submitCommand(row.id, { kind: "cancel" }, "update", row.revision); } catch (e) { setFormError(String(e)); } }}>{t("cancelOrder")}</button>}</>}
          {entity === "purchase_order_items" && parent && ["ordered", "partially_received"].includes(String(parent.status)) && <button disabled={!stockActive || blocked(parent.id)} onClick={() => open("receive", row)}>{t("receive")}</button>}
          {entity === "maintenance_plans" && !row.completed && <button disabled={blocked(row.id)} onClick={() => open("complete", row)}>{t("complete")}</button>}
          {entity === "maintenance_plans" && !row.completed && !row.in_progress && <button disabled={blocked(row.id) || blocked(String(row.resource_id)) || !resourceDetails.find((r) => r.id === row.resource_id)?.revision} onClick={() => {
            const resource = resourceDetails.find((r) => r.id === row.resource_id);
            if (resource?.revision) try { submitCommand(row.id, { kind: "start", resource_revision: resource.revision }, "update", row.revision, String(row.resource_id)); } catch (e) { setFormError(String(e)); }
          }}>{t("start")}</button>}
          {!(entity === "purchase_orders" && row.status !== "draft") && !(entity === "purchase_order_items" && parent?.status !== "draft")
            && <button title={t("edit")} aria-label={`${t("edit")}: ${title(row)}`} disabled={Boolean(row.in_progress) || blocked(row.id) || Boolean(parent && blocked(parent.id))} onClick={() => open("save", row)}><Pencil size={18} /></button>}
          {(["suppliers", "supplier_contacts", "maintenance_plans"].includes(entity) || (entity === "purchase_order_items" && parent?.status === "draft")) && <button title={t("archive")} aria-label={`${t("archive")}: ${title(row)}`} disabled={Boolean(row.in_progress) || blocked(row.id) || Boolean(parent && blocked(parent.id))} onClick={() => setArchive(row)}><Archive size={18} /></button>}
        </div>
      </article>)}
    </div>
    {count > 50 && <div className={styles.toolbar}><button aria-label={t("previous")} disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={18} /></button><span>{page + 1} / {Math.ceil(count / 50)}</span><button aria-label={t("next")} disabled={(page + 1) * 50 >= count} onClick={() => setPage((p) => p + 1)}><ChevronRight size={18} /></button></div>}
    {form && <TripDialog labelledBy="operations-form-title" onClose={() => setForm(null)} className={styles.dialog}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className={styles.toolbar}><h2 id="operations-form-title">{t(form.kind === "save" ? form.entity : form.kind)}</h2><button type="button" title={t("close")} aria-label={t("close")} onClick={() => setForm(null)}><X size={18} /></button></div>
        <div className={styles.fields}>{fields.map((key) => input(key, form.values, (k, v) => setForm({ ...form, values: { ...form.values, [k]: v } }),
          form.kind === "save" ? required[form.entity]?.includes(key) : ["quantity", "note", "completed_date", "cost", "currency"].includes(key)))}</div>
        {form.kind === "complete" && <OperationsDocumentUpload language={language} onPending={setDocumentPending} onUploaded={(document) => {
          setUploadedDocument(document);
          setForm((current) => current?.kind === "complete" ? { ...current, values: { ...current.values, document_id: document.id } } : current);
        }} />}
        {form.kind === "complete" && <section><h3>{t("consumption")}</h3>{consumption.map((m, index) => <div className={styles.fields} key={index}>
          {(["material_id", "location_id", "quantity"] as const).map((key) => input(key, m, (k, v) => setConsumption((old) => old.map((r, i) => i === index ? { ...r, [k]: v } : r)), true))}
          <button type="button" aria-label={t("archive")} onClick={() => setConsumption((old) => old.filter((_, i) => i !== index))}><X size={18} /></button>
        </div>)}<button type="button" onClick={() => setConsumption((old) => [...old, { material_id: "", location_id: "", quantity: "1" }])}><Plus size={18} />{t("material_id")}</button></section>}
        {formError && <p role="alert">{t(formError)}</p>}
        <footer className={styles.actions}><button type="button" onClick={() => setForm(null)}>{t("cancel")}</button><button type="submit" disabled={documentPending} className={styles.selected}>{t("save")}</button></footer>
      </form>
    </TripDialog>}
    {archive && <TripDialog labelledBy="operations-archive-title" onClose={() => setArchive(null)} className={styles.dialog}><h2 id="operations-archive-title">{t("confirmArchive")}</h2><p>{title(archive)}</p><div className={styles.actions}><button onClick={() => setArchive(null)}>{t("cancel")}</button><button onClick={() => { try { submitCommand(archive.id, { kind: "archive", entity }, "delete", archive.revision, parent?.id); setArchive(null); } catch (e) { setFormError(String(e)); } }}>{t("archive")}</button></div></TripDialog>}
    {history && <OperationsHistory entity={history.entity} parent={history.row.id} title={history.title} language={language} onClose={() => setHistory(null)} />}
  </div>;
}
