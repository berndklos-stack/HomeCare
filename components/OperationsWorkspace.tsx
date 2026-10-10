"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Archive, ChevronLeft, ChevronRight, History, Mail, MapPin, Pencil, Phone, Plus, RefreshCw, X } from "lucide-react";
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
import { PurchaseOrderSend } from "./PurchaseOrderSend";
import { OperationsDataTable, type DataColumn } from "./OperationsDataTable";

const tableEntities = new Set(["suppliers", "supplier_contacts", "purchase_orders", "material_details", "location_details", "resource_details"]);

type Reference = { id: string; name: string; sku?: string; unit?: string; minStock?: string; revision?: number; hours?: number; mileage?: number; availability?: string; documents?: { id: string; name: string }[] };
type Props = {
  children?: ReactNode; language: OperationsLanguage; queue: SyncMutation[];
  enqueue: (input: Parameters<typeof import("@/lib/syncQueue").createSyncMutation>[0]) => unknown;
  materials: Reference[]; locations: Reference[]; resources: Reference[]; employees: Reference[]; jobs: Reference[]; projects: Reference[];
  onOpenMasterData: (tab: "materials" | "resources") => void;
  resourcesOnly?: boolean;
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
  const fieldLabel = (key: string, target: OperationsEntity = entity) => t(key === "name" && target !== "supplier_contacts" ? "designation" : key);
  const [tab, setTab] = useState(props.resourcesOnly ? "resources" : "inventory");
  const [entity, setEntity] = useState<OperationsEntity>(props.resourcesOnly ? "resource_assignments" : "material_details");
  const [parent, setParent] = useState<OperationsRow | null>(null);
  const [rows, setRows] = useState<OperationsRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stockActive, setStockActive] = useState<boolean | null>(null);
  const [stockMaterialId, setStockMaterialId] = useState(props.materials[0]?.id ?? "");
  const [stockError, setStockError] = useState(false);
  const [error, setError] = useState("");
  const [suppliers, setSuppliers] = useState<Reference[]>([]);
  const [orders, setOrders] = useState<Reference[]>([]);
  const [resourceDetails, setResourceDetails] = useState<Reference[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [itemDetails, setItemDetails] = useState<OperationsRow | null>(null);
  const [archive, setArchive] = useState<OperationsRow | null>(null);
  const [formError, setFormError] = useState("");
  const [consumption, setConsumption] = useState<{ material_id: string; location_id: string; quantity: string }[]>([]);
  const [documentPending, setDocumentPending] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<{ id: string; name: string } | null>(null);
  const [history, setHistory] = useState<{ entity: "purchase_receipts" | "maintenance_events"; row: OperationsRow; title: string; order?: boolean } | null>(null);
  const [receiptSelection, setReceiptSelection] = useState<Record<string, string>>({});
  const [receiptLocation, setReceiptLocation] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptDocument, setReceiptDocument] = useState<{ id: string; name: string } | null>(null);
  const [receiptDocumentPending, setReceiptDocumentPending] = useState(false);
  const receiptLock = useRef(false);
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
    setStockError(false);
    apiFetch("/api/operations?entity=stock_status", { signal: controller.signal }).then(async (r) => r.ok ? r.json() : null)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (typeof data?.active !== "boolean") throw new Error("OPERATIONS_UNAVAILABLE");
        setStockActive(data.active);
      }).catch(() => { if (!controller.signal.aborted) setStockError(true); });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRows([]);
    // One bounded read page, not a growing cache per search/page/report.
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) ?? "null");
      if (cached?.entity === entity && cached.parent === (parent?.id ?? "") && cached.page === page && cached.search === querySearch) {
        setRows(cached.rows); setCount(tableEntities.has(entity) ? 0 : cached.count);
      }
    } catch { /* Read cache is optional. */ }
    const query = new URLSearchParams({ entity, page: String(page) });
    if (querySearch) query.set("search", querySearch);
    if (parent) query.set("parent", parent.id);
    apiFetch(`/api/operations?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("OPERATIONS_UNAVAILABLE");
        const data = await r.json();
        if (tableEntities.has(entity)) {
          let next = 1;
          while (data.rows.length < data.count) {
            query.set("page", String(next++));
            const response = await apiFetch(`/api/operations?${query}`, { signal: controller.signal, cache: "no-store" });
            if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE");
            const more = await response.json();
            if (!more.rows.length) break;
            data.rows.push(...more.rows);
          }
        }
        return data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRows(data.rows); setCount(tableEntities.has(entity) ? 0 : data.count);
        try { if (data.rows.length <= 50) sessionStorage.setItem(cacheKey, JSON.stringify({ entity, parent: parent?.id ?? "", page, search: querySearch, rows: data.rows, count: data.count })); else sessionStorage.removeItem(cacheKey); } catch { /* Queue durability is independent of read caching. */ }
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
  const parentLocation = String(parent?.location_id ?? "");
  const receiptSettled = queue.filter((mutation) => mutation.entityType === "operations" && mutation.entityId === parentId && mutation.status === "synced").map((mutation) => mutation.id).join(":");
  useEffect(() => {
    setReceiptSelection({}); setReceiptError("");
  }, [rows]);
  useEffect(() => {
    setReceiptLocation(parentLocation);
    setReceiptNote(""); setReceiptBusy(false); receiptLock.current = false;
    setReceiptDocument(null); setReceiptDocumentPending(false);
  }, [parentId, parentLocation, receiptSettled]); // A pending order mutation remains blocked by the durable queue.
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
    setEntity(next); setParent(owner); setPage(0); setSearch(""); setQuerySearch(""); setForm(null); setItemDetails(null);
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
    return <label key={key} className={styles.field}><span>{fieldLabel(key, form?.entity)}</span>
      {key === "archived" ? <input type="checkbox" checked={value === "true"} onChange={(e) => update(key, String(e.target.checked))} />
        : references || choices ? <select aria-label={fieldLabel(key, form?.entity)} required={mandatory} value={value} onChange={(e) => update(key, e.target.value)}>
          <option value="">—</option>{references ? references.map((r) => <option key={r.id} value={r.id}>{r.name}</option>) : choices?.map((c) => <option key={c} value={c}>{t(c)}</option>)}
        </select> : key === "notes" || key === "warranty_notes" || key === "address" ? <textarea value={value} onChange={(e) => update(key, e.target.value)} />
          : <input required={mandatory} type={numeric.has(key) ? "number" : key.endsWith("_date") || ["due_date", "expected_delivery", "warranty_until"].includes(key) ? "date" : "text"}
            min={numeric.has(key) ? 0 : undefined} step={numeric.has(key) ? "any" : undefined} value={value} onChange={(e) => update(key, e.target.value)} />}
    </label>;
  }
  const editable = !entity.endsWith("_details");
  const fields = form?.kind === "receive" ? ["quantity", "note"] : form?.kind === "complete"
    ? ["completed_date", "mileage", "operating_hours", "cost", "currency", "supplier_id", "document_id", "notes"] : form ? operationsFields[form.entity] : [];
  const detail = itemDetails ? rows.find((row) => row.id === itemDetails.id) ?? itemDetails : null;
  const outstanding = (row: OperationsRow) => Math.max(0, Number(row.quantity) - Number(row.received_quantity ?? 0));
  const receivable = entity === "purchase_order_items" && parent && ["ordered", "partially_received"].includes(String(parent.status));
  const openRows = rows.filter((row) => outstanding(row) > 0);
  const receiptDisabled = !stockActive || loading || Boolean(error) || !parent || blocked(parent.id) || receiptBusy;
  function bookReceipts() {
    if (!parent || receiptDisabled || receiptDocumentPending || receiptLock.current) return;
    try {
      const items = rows.filter((row) => receiptSelection[row.id] !== undefined).map((row) => {
        const quantity = Number(receiptSelection[row.id]);
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > outstanding(row)) throw new Error("receiptInvalid");
        return { item_id: row.id, quantity };
      });
      if (!items.length || !props.locations.some((location) => location.id === receiptLocation)) throw new Error("receiptInvalid");
      receiptLock.current = true;
      submitCommand(parent.id, { kind: "receive_batch", items, location_id: receiptLocation, document_id: receiptDocument?.id ?? null, note: receiptNote.trim() || `${t("receiptReason")} ${String(parent.order_number ?? "")}` }, "update", parent.revision);
      setReceiptBusy(true); setReceiptError("");
    } catch { receiptLock.current = false; setReceiptError("receiptInvalid"); }
  }
  const number = (value: unknown) => value == null ? "—" : new Intl.NumberFormat(language === "sv" ? "sv-SE" : language === "en" ? "en-GB" : "de-DE", { maximumFractionDigits: 3 }).format(Number(value));
  const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Intl.DateTimeFormat(language === "sv" ? "sv-SE" : language === "en" ? "en-GB" : "de-DE").format(new Date(`${value}T12:00:00`)) : "—";
  const tableKeys = entity === "suppliers" ? ["supplier_number", "company", "phone", "email", "address", "vat_number", "payment_terms"]
    : entity === "supplier_contacts" ? ["name", "role", "phone", "email"]
    : entity === "purchase_orders" ? ["order_number", "supplier_id", "status", "order_date", "expected_delivery", "openItems"]
    : entity === "material_details" ? ["name", "preferred_supplier_id", "reorder_quantity", "notes"]
    : entity === "location_details" ? ["name", "location_kind", "notes"] : ["name", "availability", "notes"];
  const columns: DataColumn[] = tableKeys.map((key) => ({ key, label: fieldLabel(key), value: (row) => {
    if (key === "name") return title(row);
    if (key === "supplier_id" || key === "preferred_supplier_id") return suppliers.find((supplier) => supplier.id === row[key])?.name ?? "";
    if (key === "status") return operationsLabels[row.status as keyof typeof operationsLabels]?.[language] ?? String(row.status ?? "");
    if (key === "order_date" || key === "expected_delivery") return row[key] ? date(row[key]) : "";
    if (key === "openItems") return `${number(row.open_item_count)} / ${number(row.item_count)}`;
    if (key === "availability" || key === "location_kind") return row[key] ? t(String(row[key])) : "";
    return String(row[key] ?? "");
  }, ...(key === "phone" || key === "email" ? { render: (row: OperationsRow) => String(row[key] ?? "").trim() ? <a aria-label={`${t(key)}: ${String(row[key]).trim()}`} href={key === "phone" ? `tel:${String(row[key]).replace(/[^\d+*#]/g, "")}` : `mailto:${encodeURIComponent(String(row[key]).trim())}`}>{String(row[key]).trim()}</a> : "—" } : {}) }));
  const tableActions = (row: OperationsRow) => <>
    {entity === "suppliers" && <button onClick={() => change("supplier_contacts", row)}>{t("supplier_contacts")}</button>}
    {entity === "purchase_orders" && <>
      <button onClick={() => change("purchase_order_items", row)}>{t("purchase_order_items")}</button>
      <button title={t("deliveryDocuments")} aria-label={t("deliveryDocuments")} onClick={() => setHistory({ entity: "purchase_receipts", row, title: title(row), order: true })}><History size={18} /></button>
      {row.status === "draft" && <PurchaseOrderSend orderId={row.id} revision={Number(row.revision)} disabled={blocked(row.id)} language={language} onSent={() => submitCommand(row.id, { kind: "order" }, "update", row.revision)} />}
      {["draft", "ordered"].includes(String(row.status)) && <button disabled={blocked(row.id)} onClick={() => { try { submitCommand(row.id, { kind: "cancel" }, "update", row.revision); } catch (e) { setFormError(String(e)); } }}>{t("cancelOrder")}</button>}
    </>}
    {!(entity === "purchase_orders" && row.status !== "draft") && <button title={t("edit")} aria-label={`${t("edit")}: ${title(row)}`} disabled={blocked(row.id) || Boolean(parent && blocked(parent.id))} onClick={() => open("save", row)}><Pencil size={18} /></button>}
    {["suppliers", "supplier_contacts"].includes(entity) && <button title={t("archive")} aria-label={`${t("archive")}: ${title(row)}`} disabled={blocked(row.id) || Boolean(parent && blocked(parent.id))} onClick={() => setArchive(row)}><Archive size={18} /></button>}
  </>;
  return <div className={styles.workspace}>
    <nav className={styles.tabs} aria-label="Operations">{Object.keys(groups).filter((key) => props.resourcesOnly ? ["resources", "maintenance"].includes(key) : ["inventory", "purchasing"].includes(key)).map((key) => <button key={key} className={tab === key ? styles.selected : ""}
      onClick={() => { setTab(key); change(groups[key][0]); }}>{operationsLabels[key as keyof typeof operationsLabels][language]}</button>)}</nav>
    <div className={styles.toolbar}>
      {(tab === "inventory" || tab === "resources") && <button onClick={() => props.onOpenMasterData(tab === "inventory" ? "materials" : "resources")}><Pencil size={18} />{tab === "inventory" ? (language === "de" ? "Materialstammdaten" : language === "sv" ? "Materialregister" : "Material master data") : (language === "de" ? "Ressourcen bearbeiten" : language === "sv" ? "Redigera resurser" : "Edit resources")}</button>}
      {groups[tab].filter((key) => key !== "material_details").map((key) => <button key={key} aria-pressed={entity === key} onClick={() => change(key)}>{t(key)}</button>)}
      {parent && <button onClick={() => change(entity === "supplier_contacts" ? "suppliers" : "purchase_orders")}>{String(parent.company ?? parent.order_number)} <ChevronLeft size={16} /></button>}
      {entity === "maintenance_plans" && <input aria-label={language === "de" ? "Einträge suchen" : language === "sv" ? "Sök poster" : "Search records"} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
      <button title={t("refresh")} aria-label={t("refresh")} onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={18} /></button>
      {editable && !error && <button onClick={() => open("save")} disabled={entity === "purchase_order_items" && (!parent || parent.status !== "draft" || blocked(parent.id))}><Plus size={18} />{t("create")}</button>}
    </div>
    {tab === "inventory" && (stockActive === true ? <OperationsStock {...props} onMaterialSelected={setStockMaterialId} /> : stockActive === false ? props.children : <div role="status" aria-busy={!stockError}>{t(stockError ? "OPERATIONS_UNAVAILABLE" : "loading")}</div>)}
    {error && <p role="status">{t(error)}</p>}
    {active.length > 0 && <div role="status" className={styles.pending}>{active.map((m) => <p key={m.id}>{t(m.status === "failed" || m.status === "conflict" ? "failed" : "waiting")}: {String((m.payload.values as Record<string, unknown> | undefined)?.company ?? (m.payload.values as Record<string, unknown> | undefined)?.name ?? m.entityId)}</p>)}</div>}
    <div className={styles.list} aria-busy={loading}>
      {tab === "inventory" && <h3 className={styles.tableHeading}>{t(entity)}</h3>}
      {!tableEntities.has(entity) && !rows.length && !loading && !error && <p>{t("empty")}</p>}
      {tableEntities.has(entity) ? <OperationsDataTable key={`${entity}:${parent?.id ?? ""}`} rows={entity === "material_details" && stockActive && stockMaterialId ? rows.filter((row) => row.id === stockMaterialId) : rows} columns={columns} actions={tableActions} label={t(entity)} filterLabel={t("filter")} emptyLabel={t("empty")} actionsLabel={t("actions")}
        canActivate={(row) => !blocked(row.id) && !(parent && blocked(parent.id))}
        onRowActivate={(row) => entity === "purchase_orders" && row.status !== "draft" ? change("purchase_order_items", row) : open("save", row)} /> : entity === "purchase_order_items" && rows.length > 0 ? <div className={styles.itemsScroll}><table className={styles.items}>
        <thead><tr><th scope="col">{receivable && <input type="checkbox" aria-label={t(count > 50 ? "selectOpenPage" : "selectOpen")} title={t(count > 50 ? "selectOpenPage" : "selectOpen")} disabled={receiptDisabled || !openRows.length}
          checked={openRows.length > 0 && openRows.every((row) => receiptSelection[row.id] !== undefined)}
          ref={(element) => { if (element) element.indeterminate = openRows.some((row) => receiptSelection[row.id] !== undefined) && !openRows.every((row) => receiptSelection[row.id] !== undefined); }}
          onChange={(event) => setReceiptSelection(event.target.checked ? Object.fromEntries(openRows.map((row) => [row.id, String(outstanding(row))])) : {})} />}{t("position")}</th><th scope="col">{t("orderedQuantity")}</th><th scope="col">{t("receivedQuantity")}</th><th scope="col">{t("openQuantity")}</th>{receivable && <th scope="col">{t("receiptQuantity")}</th>}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <th scope="row"><div className={styles.itemSelection}>{receivable && <input type="checkbox" aria-label={`${t("selectPosition")}: ${title(row)}`} checked={receiptSelection[row.id] !== undefined}
            disabled={receiptDisabled || !outstanding(row)} onChange={(event) => setReceiptSelection((current) => {
              const next = { ...current }; if (event.target.checked) next[row.id] = String(outstanding(row)); else delete next[row.id]; return next;
            })} />}<button className={styles.itemName} onClick={() => setItemDetails(row)}>{title(row)}<ChevronRight size={16} aria-hidden="true" /></button></div></th>
          <td>{number(row.quantity)}</td><td>{number(row.received_quantity)}</td><td>{number(outstanding(row))}</td>
          {receivable && <td>{outstanding(row) > 0 ? <input className={styles.receiptQuantity} type="number" min="0.001" max={outstanding(row)} step="0.001"
            aria-label={`${t("receiptQuantity")}: ${title(row)}`} disabled={receiptDisabled || receiptSelection[row.id] === undefined} value={receiptSelection[row.id] ?? ""}
            onChange={(event) => { setReceiptError(""); setReceiptSelection((current) => ({ ...current, [row.id]: event.target.value })); }} /> : "—"}</td>}
        </tr>)}</tbody>
      </table></div> : rows.map((row) => <article key={row.id} className={styles.row}>
        <div><strong>{title(row)}</strong><div className={styles.meta}>{row.status ? operationsLabels[row.status as keyof typeof operationsLabels]?.[language] : null}
          {entity === "suppliers" && ["supplier_number", "vat_number", "payment_terms"].map((key) => typeof row[key] === "string" && String(row[key]).trim()
            ? <span key={key}>{t(key)}: {String(row[key]).trim()}</span> : null)}
          {entity === "supplier_contacts" && typeof row.role === "string" && row.role.trim() && <span>{t("role")}: {row.role.trim()}</span>}
          {entity === "purchase_orders" && <>
            <span>{t("supplier_id")}: {suppliers.find((supplier) => supplier.id === row.supplier_id)?.name ?? "—"}</span>
            <span>{t("order_date")}: {date(row.order_date)}</span>
            <span>{t("expected_delivery")}: {date(row.expected_delivery)}</span>
            <span>{t("openItems")}: {number(row.open_item_count)} / {number(row.item_count)}</span>
          </>}
          {entity === "maintenance_plans" && (row.in_progress ? t("inProgress") : operationsLabels[maintenanceStatus({ dueDate: row.due_date as string | null, dueMileage: row.due_mileage == null ? null : Number(row.due_mileage), dueHours: row.due_hours == null ? null : Number(row.due_hours) }, { date: new Date().toLocaleDateString("sv-SE"), mileage: props.resources.find((r) => r.id === row.resource_id)?.mileage, hours: resourceDetails.find((r) => r.id === row.resource_id)?.hours }, Boolean(row.completed))][language])}
          {row.quantity != null && <span>{t("quantity")}: {String(row.quantity)} · {t("unit_price")}: {String(row.unit_price)}</span>}
          {row.due_date ? <span>{t("due_date")}: {String(row.due_date)}</span> : null}
          {row.availability ? <span>{t(row.availability === "unavailable" ? "unavailableStatus" : String(row.availability))}</span> : null}
        </div>
          {(entity === "suppliers" || entity === "supplier_contacts") && <div className={styles.contactDetails}>
            {typeof row.phone === "string" && row.phone.trim() && <a href={`tel:${row.phone.replace(/[^\d+*#]/g, "")}`} aria-label={`${t("phone")}: ${row.phone.trim()}`}><Phone size={16} aria-hidden="true" />{row.phone.trim()}</a>}
            {typeof row.email === "string" && row.email.trim() && <a href={`mailto:${encodeURIComponent(row.email.trim())}`} aria-label={`${t("email")}: ${row.email.trim()}`}><Mail size={16} aria-hidden="true" />{row.email.trim()}</a>}
            {typeof row.address === "string" && row.address.trim() && <span className={styles.address}><MapPin size={16} aria-hidden="true" /><span>{row.address.trim()}</span></span>}
          </div>}
        </div>
        <div className={styles.actions}>
          {(entity === "purchase_order_items" || entity === "maintenance_plans") && <button onClick={() => setHistory({ entity: entity === "purchase_order_items" ? "purchase_receipts" : "maintenance_events", row, title: title(row) })}><History size={18} />{t(entity === "purchase_order_items" ? "purchase_receipts" : "maintenance_events")}</button>}
          {entity === "suppliers" && <button onClick={() => change("supplier_contacts", row)}>{t("supplier_contacts")}</button>}
          {entity === "purchase_orders" && <><button onClick={() => change("purchase_order_items", row)}>{t("purchase_order_items")}</button>
            <button onClick={() => setHistory({ entity: "purchase_receipts", row, title: title(row), order: true })}><History size={18} />{t("deliveryDocuments")}</button>
            {row.status === "draft" && <PurchaseOrderSend orderId={row.id} revision={Number(row.revision)} disabled={blocked(row.id)} language={language} onSent={() => submitCommand(row.id, { kind: "order" }, "update", row.revision)} />}
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
    {receivable && <section className={styles.receiptBooking}>
      <div className={styles.fields}>
        {input("location_id", { location_id: receiptLocation }, (_key, value) => setReceiptLocation(value), true)}
        {input("note", { note: receiptNote }, (_key, value) => setReceiptNote(value))}
      </div>
      <OperationsDocumentUpload key={`${parentId}:${receiptSettled}`} language={language} scope="purchase-documents" photoPdf disabled={receiptDisabled}
        onPending={setReceiptDocumentPending} onUploaded={setReceiptDocument} />
      {receiptError && <p role="alert">{t(receiptError)}</p>}
      <div className={styles.actions}><button className={styles.selected} disabled={receiptDisabled || receiptDocumentPending || !Object.keys(receiptSelection).length || !receiptLocation}
        onClick={bookReceipts}><Plus size={18} />{t("bookSelected")} ({Object.keys(receiptSelection).length})</button></div>
    </section>}
    {detail && <TripDialog labelledBy="purchase-item-title" onClose={() => setItemDetails(null)} className={`${styles.dialog} ${styles.itemDialog}`}>
      <header className={styles.dialogHeader}><div><p>{t("itemDetails")} · {String(parent?.order_number ?? "")}</p><h2 id="purchase-item-title">{title(detail)}</h2></div><button aria-label={t("close")} title={t("close")} onClick={() => setItemDetails(null)}><X size={18} /></button></header>
      <dl className={styles.itemFacts}>
        <div><dt>{t("orderedQuantity")}</dt><dd>{number(detail.quantity)}</dd></div>
        <div><dt>{t("receivedQuantity")}</dt><dd>{number(detail.received_quantity)}</dd></div>
        <div><dt>{t("unit_price")}</dt><dd>{number(detail.unit_price)} {String(parent?.currency ?? "")}</dd></div>
        <div><dt>{t("lineTotal")}</dt><dd>{number(Number(detail.quantity) * Number(detail.unit_price))} {String(parent?.currency ?? "")}</dd></div>
      </dl>
      <footer className={styles.actions}>
        <button onClick={() => { setItemDetails(null); setHistory({ entity: "purchase_receipts", row: detail, title: title(detail) }); }}><History size={18} />{t("deliveryHistory")}</button>
        {parent && ["ordered", "partially_received"].includes(String(parent.status)) && <button className={styles.selected} disabled={!stockActive || blocked(parent.id)} onClick={() => { setItemDetails(null); open("receive", detail); }}><Plus size={18} />{t("receive")}</button>}
        {parent?.status === "draft" && <>
          <button disabled={blocked(detail.id) || blocked(parent.id)} onClick={() => { setItemDetails(null); open("save", detail); }}><Pencil size={18} />{t("edit")}</button>
          <button disabled={blocked(detail.id) || blocked(parent.id)} onClick={() => { setItemDetails(null); setArchive(detail); }}><Archive size={18} />{t("archive")}</button>
        </>}
      </footer>
    </TripDialog>}
    {form && <TripDialog labelledBy="operations-form-title" onClose={() => setForm(null)} className={styles.dialog}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <header className={styles.dialogHeader}><h2 id="operations-form-title">{t(form.kind === "save" ? form.entity : form.kind)}</h2><button type="button" title={t("close")} aria-label={t("close")} onClick={() => setForm(null)}><X size={18} /></button></header>
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
    {archive && <TripDialog labelledBy="operations-archive-title" onClose={() => setArchive(null)} className={`${styles.dialog} ${styles.itemDialog}`}><header className={styles.dialogHeader}><h2 id="operations-archive-title">{t("confirmArchive")}</h2><button aria-label={t("close")} title={t("close")} onClick={() => setArchive(null)}><X size={18} /></button></header><p>{title(archive)}</p><footer className={styles.actions}><button onClick={() => setArchive(null)}>{t("cancel")}</button><button onClick={() => { try { submitCommand(archive.id, { kind: "archive", entity }, "delete", archive.revision, parent?.id); setArchive(null); } catch (e) { setFormError(String(e)); } }}>{t("archive")}</button></footer></TripDialog>}
    {history && <OperationsHistory entity={history.entity} parent={history.row.id} order={history.order} title={history.title} language={language} onClose={() => setHistory(null)} />}
  </div>;
}
