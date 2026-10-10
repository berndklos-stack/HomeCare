"use client";
import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, PackageCheck, ScanLine, X } from "lucide-react";
import type { SyncMutation, createSyncMutation } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import { TripDialog } from "./TripDialog";
import { GoodsReceiptScan } from "./GoodsReceiptScan";
import { GoodsIssue } from "./GoodsIssue";
import { PickingOrders } from "./PickingOrders";
import { StockScan } from "./StockScan";
import styles from "./OperationsWorkspace.module.css";

type Flow = "receipt" | "picking" | "issue" | "transfer";
export function ScanWorkflows({ selectionRequest, language, queue, materials, enqueue, onBooked }: {
 selectionRequest: number; language: "de" | "sv" | "en"; queue: SyncMutation[];
 materials: { id: string; name: string; scanCode?: string; sku?: string; unit?: string; archived?: boolean }[];
 enqueue: (input: Parameters<typeof createSyncMutation>[0]) => unknown; onBooked?: () => void;
}) {
 const t = (key: string) => operationLabel(key, language);
 const [chooser, setChooser] = useState(true), [flow, setFlow] = useState<Flow | null>(null), [visited, setVisited] = useState<Flow[]>([]), [transfer, setTransfer] = useState(false);
 const [queued, setQueued] = useState(false);
 useEffect(() => { let alive = true; void Promise.resolve().then(() => { if (alive) setChooser(true); }); return () => { alive = false; }; }, [selectionRequest]);
 const choices = [{ id: "receipt", label: "goodsReceiptScan", Icon: ArrowDownToLine }, { id: "picking", label: "pickingOrders", Icon: PackageCheck }, { id: "issue", label: "goodsIssue", Icon: ArrowUpFromLine }, { id: "transfer", label: "scanTransfer", Icon: ArrowLeftRight }] as const;
 return <>
  <div className={styles.actions}><button type="button" onClick={() => setChooser(true)}><ScanLine size={18} />{t("chooseScanFlow")}</button></div>
  {queued && <p role="status">{t("scanQueued")}</p>}
  {chooser && <TripDialog labelledBy="scan-flow-title" onClose={() => setChooser(false)} className={styles.dialog}>
   <header className={styles.dialogHeader}><h2 id="scan-flow-title">{t("scanFlows")}</h2><button aria-label={t("close")} onClick={() => setChooser(false)}><X size={18} /></button></header>
   <div className={styles.fields}>{choices.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => { setFlow(id); setVisited((current) => current.includes(id) ? current : [...current, id]); setChooser(false); if (id === "transfer") setTransfer(true); }}><Icon size={20} />{t(label)}</button>)}</div>
  </TripDialog>}
  {visited.includes("receipt") && <div hidden={flow !== "receipt"}><GoodsReceiptScan materials={materials} language={language} queue={queue} onBooked={onBooked} /></div>}
  {visited.includes("picking") && <div hidden={flow !== "picking"}><PickingOrders language={language} queue={queue} onBooked={onBooked} /></div>}
  {visited.includes("issue") && <div hidden={flow !== "issue"}><GoodsIssue materials={materials} language={language} queue={queue} enqueue={enqueue} onBooked={onBooked} /></div>}
  {flow === "transfer" && <section className="panel"><h2>{t("scanTransfer")}</h2><button onClick={() => setTransfer(true)}><ScanLine size={18} />{t("scanTransfer")}</button></section>}
  {transfer && <StockScan materials={materials} language={language} queue={queue} enqueue={enqueue} onClose={() => setTransfer(false)} onQueued={() => { setTransfer(false); setQueued(true); }} />}
 </>;
}
