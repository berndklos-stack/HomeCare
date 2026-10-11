"use client";
import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, PackageCheck, ArrowLeft } from "lucide-react";
import type { SyncMutation, createSyncMutation } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
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
  {!chooser && <div className={styles.actions}><button type="button" onClick={() => { setChooser(true); setTransfer(false); }}><ArrowLeft size={18} />{t("chooseScanFlow")}</button></div>}
  {queued && <p role="status">{t("scanQueued")}</p>}
  {chooser && <section className={`panel ${styles.scanSurface}`} aria-labelledby="scan-flow-title">
   <header className={styles.dialogHeader}><h2 id="scan-flow-title">{t("scanFlows")}</h2></header>
   <div className={styles.fields}>{choices.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => { setFlow(id); setVisited((current) => current.includes(id) ? current : [...current, id]); setChooser(false); if (id === "transfer") setTransfer(true); }}><Icon size={20} />{t(label)}</button>)}</div>
  </section>}
  {visited.includes("receipt") && <div hidden={chooser || flow !== "receipt"}><GoodsReceiptScan active={!chooser && flow === "receipt"} materials={materials} language={language} queue={queue} onBooked={onBooked} /></div>}
  {!chooser && flow === "picking" && <PickingOrders inline language={language} queue={queue} onBooked={onBooked} />}
  {!chooser && flow === "issue" && <GoodsIssue materials={materials} language={language} queue={queue} enqueue={enqueue} onBooked={onBooked} />}
  {!chooser && transfer && <StockScan inline materials={materials} language={language} queue={queue} enqueue={enqueue} onClose={() => { setTransfer(false); setChooser(true); }} onQueued={() => { setTransfer(false); setChooser(true); setQueued(true); }} />}
 </>;
}
