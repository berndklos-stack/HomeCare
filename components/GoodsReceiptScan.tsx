"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine, Trash2 } from "lucide-react";
import { apiFetch, tenantScopedStorageKey } from "@/lib/apiClient";
import { createStableId, type SyncMutation } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import { OperationsDataTable } from "./OperationsDataTable";
import { CodeCamera } from "./CodeCamera";
import { OperationsDocumentUpload } from "./OperationsDocumentUpload";
import { storageLocationPath } from "@/lib/locationLabel";
import styles from "./OperationsWorkspace.module.css";

type Material = { id: string; name: string; sku?: string; scanCode?: string; unit?: string; archived?: boolean };
type Place = { id: string; name: string; parent_location_id?: string; archived?: boolean };
type Supplier = { id: string; company: string };
type Order = { id: string; order_number: string; supplier_id: string; status: string; revision: number };
type OrderItem = { id: string; material_id: string; quantity: number; received_quantity: number };
type Line = { id: string; material_id: string; item_id?: string; quantity: number; name: string; unit?: string };
type ReceiptDocument = { id: string; name: string };
type ReceiptPayload = { supplier_id: string; delivery_number: string; location_id: string; order_id: string | null; revision: number | null; items: { material_id: string; item_id: string | null; quantity: number }[]; document_id?: string | null; damage?: { description: string; photos: string[] } | null };
type ReceiptConfirmation = { supplier: string; delivery: string; location: string; lines: Line[]; damage: boolean };
export function GoodsReceiptScan({ materials, language, queue, onBooked }: {
 materials: Material[]; language: "de" | "sv" | "en"; queue: SyncMutation[]; onBooked?: () => void;
}) {
 const t = (key: string) => operationLabel(key, language);
 const [suppliers, setSuppliers] = useState<Supplier[]>([]), [places, setPlaces] = useState<Place[]>([]), [orders, setOrders] = useState<Order[]>([]), [orderItems, setOrderItems] = useState<OrderItem[]>([]);
 const [supplier, setSupplier] = useState(""), [delivery, setDelivery] = useState(""), [place, setPlace] = useState(""), [orderId, setOrderId] = useState("");
 const [started, setStarted] = useState(false), [lines, setLines] = useState<Line[]>([]), [material, setMaterial] = useState<Material | null>(null), [item, setItem] = useState(""), [quantity, setQuantity] = useState("1");
 const [code, setCode] = useState(""), [camera, setCamera] = useState(false), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState<ReceiptConfirmation | null>(null);
 const [document, setDocument] = useState<ReceiptDocument | null>(null), [damage, setDamage] = useState(false), [damageDescription, setDamageDescription] = useState(""), [photos, setPhotos] = useState<ReceiptDocument[]>([]);
 const [documentPending, setDocumentPending] = useState(false), [photoPending, setPhotoPending] = useState(false);
 const id = useRef(createStableId()), lock = useRef(false);
 const [draftReady, setDraftReady] = useState(false), [frozen, setFrozen] = useState<ReceiptPayload | null>(null), [refresh, setRefresh] = useState(0);
 useEffect(() => {
  let alive = true;
  void Promise.resolve().then(() => {
   if (!alive) return;
   try {
    const draft = JSON.parse(localStorage.getItem(tenantScopedStorageKey("workcore-goods-receipt-draft")) ?? "null");
    if (draft && typeof draft.id === "string" && Array.isArray(draft.lines)) {
     id.current = draft.id; setSupplier(draft.supplier ?? ""); setDelivery(draft.delivery ?? ""); setPlace(draft.place ?? ""); setOrderId(draft.orderId ?? ""); setLines(draft.lines); setStarted(true); setFrozen(draft.frozen ?? null);
     setDocument(draft.document ?? null); setDamage(draft.damage === true); setDamageDescription(draft.damageDescription ?? ""); setPhotos(draft.photos ?? []);
    }
   } catch { setError("RECEIPT_DRAFT_FAILED"); }
   setDraftReady(true);
  });
  return () => { alive = false; };
 }, []);
 useEffect(() => {
  if (!draftReady) return;
  try {
   const key = tenantScopedStorageKey("workcore-goods-receipt-draft");
   if (started) localStorage.setItem(key, JSON.stringify({ id: id.current, supplier, delivery, place, orderId, lines, frozen, document, damage, damageDescription, photos }));
   else localStorage.removeItem(key);
  } catch { void Promise.resolve().then(() => setError("RECEIPT_DRAFT_FAILED")); }
 }, [draftReady, started, supplier, delivery, place, orderId, lines, frozen, document, damage, damageDescription, photos]);
 const placeName = (id: string) => storageLocationPath(id, places.map((place) => ({ ...place, parentLocationId: place.parent_location_id })));
 const pending = queue.some((mutation) => mutation.status !== "synced" && mutation.entityType === "operations" && (mutation.payload.kind === "stock" || mutation.entityId === orderId));
 useEffect(() => {
  const controller = new AbortController();
  async function rows<T>(entity: string, extra = ""): Promise<T[]> {
   const all: T[] = [];
   for (let page = 0; ; page++) { const response = await apiFetch(`/api/operations?entity=${entity}&page=${page}${extra}`, { signal: controller.signal }); if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE"); const data = await response.json(); all.push(...data.rows); if (data.rows.length < 50 || (page + 1) * 50 >= data.count) break; }
   return all;
  }
  void (async () => {
   const suppliers = await rows<Supplier>("suppliers"), orders = await rows<Order>("purchase_orders");
   const roots = await rows<Place>("location_details"), bins = await rows<Place>("location_details", "&storage_places=1");
   if (!controller.signal.aborted) { setSuppliers(suppliers); setOrders(orders); setPlaces([...roots, ...bins].filter((place) => !place.archived)); setLoaded(true); }
  })().catch(() => { if (!controller.signal.aborted) setError("OPERATIONS_UNAVAILABLE"); });
  return () => controller.abort();
 }, [refresh]);
 useEffect(() => {
  if (!orderId) return;
  const controller = new AbortController();
  void (async () => {
   const all: OrderItem[] = [];
   for (let page = 0; ; page++) { const response = await apiFetch(`/api/operations?entity=purchase_order_items&parent=${orderId}&page=${page}`, { signal: controller.signal }); if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE"); const data = await response.json(); all.push(...data.rows); if (data.rows.length < 50 || (page + 1) * 50 >= data.count) break; }
   if (!controller.signal.aborted) setOrderItems(all);
  })().catch(() => { if (!controller.signal.aborted) setError("OPERATIONS_UNAVAILABLE"); });
  return () => controller.abort();
 }, [orderId]);
 function accept(value: string) {
  if (frozen || busy) return;
  setCamera(false); setError("");
  const matches = materials.filter((material) => !material.archived && material.scanCode === value.trim());
  if (matches.length !== 1) { setError(matches.length ? "scanAmbiguous" : "scanUnknown"); return; }
  const available = orderItems.filter((line) => line.material_id === matches[0].id && Number(line.received_quantity) < Number(line.quantity));
  if (orderId && !available.length) { setError("PURCHASE_ITEM_NOT_FOUND"); return; }
  setMaterial(matches[0]); setQuantity("1"); setItem(available.length === 1 ? available[0].id : ""); setCode("");
 }
 function add() {
  if (!material || frozen || busy) return;
  const amount = Number(quantity), existing = lines.find((line) => line.material_id === material.id), orderItem = orderItems.find((line) => line.id === item);
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 1000 - Math.round(amount * 1000)) > 0.000001 || orderId && !orderItem) { setError("INVALID_RECEIPT_QUANTITY"); return; }
  if (orderItem && amount + (existing?.quantity ?? 0) > Number(orderItem.quantity) - Number(orderItem.received_quantity)) { setError("INVALID_RECEIPT_QUANTITY"); return; }
  if (existing && existing.item_id !== (orderId ? item : undefined)) { setError("RECEIPT_DIFFERENT_ITEM"); return; }
  if (!existing && lines.length >= 50) { setError("RECEIPT_TOO_MANY_ITEMS"); return; }
  setLines((current) => existing ? current.map((line) => line.id === existing.id ? { ...line, quantity: line.quantity + amount } : line) : [...current, { id: material.id, material_id: material.id, item_id: orderId ? item : undefined, name: material.name, unit: material.unit, quantity: amount }]);
  setMaterial(null); setError("");
 }
 async function finish() {
  if (lock.current || !lines.length || pending || material || documentPending || photoPending) return;
  if (!frozen && damage && (!damageDescription.trim() || !photos.length)) { setError("DAMAGE_DOCUMENTATION_REQUIRED"); return; }
  lock.current = true; setBusy(true); setError("");
  try {
   const payload = frozen ?? { supplier_id: supplier, delivery_number: delivery.trim(), location_id: place, order_id: orderId || null, revision: orders.find((order) => order.id === orderId)?.revision ?? null, items: lines.map((line) => ({ material_id: line.material_id, item_id: line.item_id ?? null, quantity: line.quantity })), document_id: document?.id ?? null, damage: damage ? { description: damageDescription.trim(), photos: photos.map((photo) => photo.id) } : null };
   setFrozen(payload);
   localStorage.setItem(tenantScopedStorageKey("workcore-goods-receipt-draft"), JSON.stringify({ id: id.current, supplier, delivery, place, orderId, lines, frozen: payload, document, damage, damageDescription, photos }));
   const response = await apiFetch("/api/goods-receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id.current, payload }) });
   const result = await response.json(); if (!response.ok) { if ((response.status === 400 || response.status === 409) && result.error !== "RECEIPT_ID_REUSED") setFrozen(null); throw new Error(result.error ?? "RECEIPT_POST_FAILED"); }
   if (result.id !== id.current) throw new Error("RECEIPT_POST_FAILED");
   setSuccess({ supplier: suppliers.find((row) => row.id === payload.supplier_id)?.company ?? "", delivery: payload.delivery_number, location: placeName(payload.location_id), lines: [...lines], damage: Boolean(payload.damage) });
   setLines([]); setStarted(false); setFrozen(null); setDelivery(""); setDocument(null); setDamage(false); setDamageDescription(""); setPhotos([]); id.current = createStableId(); setRefresh((value) => value + 1); onBooked?.();
  } catch (cause) { const key = cause instanceof Error ? cause.message : ""; setError(key && t(key) !== key && key !== "OPERATIONS_UNAVAILABLE" ? key : "RECEIPT_POST_FAILED"); }
  finally { lock.current = false; setBusy(false); }
 }
 return <section className="panel"><header className={styles.dialogHeader}><div><p>{t("inventorySection")}</p><h2>{t("goodsReceiptScan")}</h2></div></header>
  {!loaded && !error && <p role="status">{t("loading")}</p>}
  {error && <p role="alert">{t(error)}</p>}{success && <div role="status"><h3>{t("receiptConfirmed")}</h3><p>{t("supplier_id")}: {success.supplier} · {t("deliveryNumber")}: {success.delivery}</p><p>{t("destination_id")}: {success.location}</p><ul>{success.lines.map((line) => <li key={line.id}>{line.name}: {new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(line.quantity)} {line.unit}</li>)}</ul>{success.damage && <p>{t("damageCaseCreated")}</p>}</div>}
  {loaded && <><div className={styles.fields}>
   <label className={styles.field}><span>{t("supplier_id")}</span><select aria-label={t("supplier_id")} disabled={started || busy} value={supplier} onChange={(event) => { setSupplier(event.target.value); setOrderId(""); }}><option value="" />{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.company}</option>)}</select></label>
   <label className={styles.field}><span>{t("deliveryNumber")}</span><input aria-label={t("deliveryNumber")} maxLength={120} disabled={started || busy} value={delivery} onChange={(event) => setDelivery(event.target.value)} /></label>
   <label className={styles.field}><span>{t("purchase_orders")}</span><select aria-label={t("purchase_orders")} disabled={started || busy} value={orderId} onChange={(event) => { setOrderItems([]); setOrderId(event.target.value); }}><option value="">{t("withoutPurchaseOrder")}</option>{orders.filter((order) => order.supplier_id === supplier && ["ordered", "partially_received"].includes(order.status)).map((order) => <option key={order.id} value={order.id}>{order.order_number}</option>)}</select></label>
   <label className={styles.field}><span>{t("destination_id")}</span><select aria-label={t("destination_id")} disabled={started || busy} value={place} onChange={(event) => setPlace(event.target.value)}><option value="" />{places.map((place) => <option key={place.id} value={place.id}>{placeName(place.id)}</option>)}</select></label>
  </div>
  {!started && <button className={styles.primaryAction} disabled={!supplier || !delivery.trim() || !place || busy || pending || Boolean(orderId && !orderItems.length)} onClick={() => { setStarted(true); setSuccess(null); setError(""); }}><ScanLine size={18} />{t("startReceiptScan")}</button>}
  {started && <>
   {!material ? <form onSubmit={(event) => { event.preventDefault(); accept(code); }}><div className={styles.scanInput}><label className={styles.field}><span>{t("scanMaterial")}</span><input aria-label={t("scanCode")} autoComplete="off" value={code} disabled={busy} onChange={(event) => setCode(event.target.value)} /></label><button disabled={!code.trim() || busy}><ScanLine size={18} />{t("scanAccept")}</button><button type="button" disabled={busy} onClick={() => setCamera(true)}><Camera size={18} />{t("scanCamera")}</button></div>{camera && <CodeCamera label={t("scanCamera")} onCode={accept} onError={() => { setCamera(false); setError("scanCameraError"); }} />}</form>
   : <form onSubmit={(event) => { event.preventDefault(); add(); }}><h3>{material.name}</h3><div className={styles.fields}>{orderId && <label className={styles.field}><span>{t("purchase_order_items")}</span><select required value={item} onChange={(event) => setItem(event.target.value)}><option value="" />{orderItems.filter((line) => line.material_id === material.id && Number(line.received_quantity) < Number(line.quantity)).map((line, index) => <option key={line.id} value={line.id}>{index + 1}: {Number(line.quantity) - Number(line.received_quantity)} {material.unit}</option>)}</select></label>}<label className={styles.field}><span>{t("quantity")} ({material.unit})</span><input type="number" min="0.001" step="0.001" required aria-label={t("quantity")} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label></div><div className={styles.actions}><button type="button" onClick={() => setMaterial(null)}>{t("cancel")}</button><button>{t("receiptAddItem")}</button></div></form>}
   <OperationsDataTable rows={lines} columns={[{ key: "name", label: t("designation"), value: (row) => String(row.name) }, { key: "quantity", label: t("quantity"), value: (row) => `${row.quantity} ${row.unit ?? ""}` }]} label={t("goodsReceiptScan")} filterLabel={t("filter")} emptyLabel={t("empty")} actionsLabel={t("actions")} actions={(row) => <button aria-label={`${t("remove")}: ${row.name}`} disabled={busy || Boolean(frozen)} onClick={() => setLines((lines) => lines.filter((line) => line.id !== row.id))}><Trash2 size={18} /></button>} />
   <OperationsDocumentUpload key={`delivery-${id.current}`} language={language} scope="purchase-documents" photoPdf disabled={busy || Boolean(frozen) || Boolean(document)} onPending={setDocumentPending} onUploaded={setDocument} />
   {document && <p>{t("deliveryNote")}: {document.name}</p>}
   <label className={styles.field}><span><input type="checkbox" checked={damage} disabled={busy || Boolean(frozen) || photoPending} onChange={(event) => setDamage(event.target.checked)} /> {t("damageDetected")}</span></label>
   {damage && <><label className={styles.field}><span>{t("damageDescription")}</span><textarea maxLength={4000} disabled={busy || Boolean(frozen)} value={damageDescription} onChange={(event) => setDamageDescription(event.target.value)} /></label>
    <ul>{photos.map((photo) => <li key={photo.id}>{photo.name}</li>)}</ul>
    <OperationsDocumentUpload key={`damage-${id.current}-${photos.length}`} language={language} scope="purchase-documents" imagesOnly disabled={busy || Boolean(frozen) || photos.length >= 20} onPending={setPhotoPending} onUploaded={(photo) => setPhotos((current) => [...current, photo])} />
   </>}
   <footer className={styles.actions}><button disabled={busy || Boolean(frozen) || documentPending || photoPending} onClick={() => { if (!lines.length || window.confirm(t("receiptDiscard"))) { setLines([]); setMaterial(null); setStarted(false); setCamera(false); setDocument(null); setPhotos([]); setDamage(false); setDamageDescription(""); } }}>{t("cancel")}</button><button className={styles.primaryAction} disabled={busy || pending || !lines.length || Boolean(material) || documentPending || photoPending} onClick={() => void finish()}>{t("finishReceiptScan")}</button></footer>
  </>}{pending && <p role="status">{t("waiting")}</p>}</>}
 </section>;
}
