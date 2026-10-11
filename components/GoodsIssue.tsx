"use client";
import { useState } from "react";
import { ScanLine } from "lucide-react";
import type { SyncMutation, createSyncMutation } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import { PickingOrders } from "./PickingOrders";
import { StockScan } from "./StockScan";
export function GoodsIssue({ language, queue, materials, enqueue, onBooked }: {
 language: "de" | "sv" | "en"; queue: SyncMutation[];
 materials: { id: string; name: string; scanCode?: string; sku?: string; unit?: string; archived?: boolean }[];
 enqueue: (input: Parameters<typeof createSyncMutation>[0]) => unknown; onBooked?: () => void;
}) {
 const [scan, setScan] = useState(false), t = (key: string) => operationLabel(key, language);
 return <><div hidden={scan}><div className="panel"><h2>{t("goodsIssue")}</h2><button onClick={() => setScan(true)}><ScanLine size={18} />{t("goodsIssueDirect")}</button></div>
  <PickingOrders inline language={language} queue={queue} onBooked={onBooked} pickupOnly /></div>
  {scan && <StockScan inline materials={materials} language={language} queue={queue} enqueue={enqueue} issue onClose={() => setScan(false)} onQueued={() => { setScan(false); onBooked?.(); }} />}
 </>;
}
