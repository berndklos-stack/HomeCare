"use client";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import styles from "./OperationsWorkspace.module.css";
import { SupplierDamageCases } from "./SupplierDamageCases";
import { operationLabel } from "@/lib/operationsUi";

export function OperationsWarnings({ language, onOpen }: { language: "de" | "sv" | "en"; onOpen: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [damageCount, setDamageCount] = useState(0), [damageOpen, setDamageOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("/api/supplier-damage-cases?summary=1", { signal: controller.signal }).then(async (response) => response.ok ? response.json() : null)
      .then((data) => { if (!controller.signal.aborted && data) setDamageCount(data.count); }).catch(() => {});
    return () => controller.abort();
  }, [damageOpen]);
  useEffect(() => {
    const controller = new AbortController();
    apiFetch(`/api/operations?entity=overview&date=${new Date().toLocaleDateString("sv-SE")}`, { signal: controller.signal })
      .then(async (r) => r.ok ? r.json() : null).then((data) => { if (!controller.signal.aborted && data) setCounts(data); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const labels = { lowStock: ["Material unter Mindestbestand", "Material under minimilager", "Materials below minimum stock"],
    overdue: ["Überfällige Wartungen", "Försenat underhåll", "Overdue maintenance"], upcoming: ["Bald fällige Prüfungen", "Kommande kontroller", "Inspections due soon"],
    unavailable: ["Nicht verfügbare Ressourcen", "Otillgängliga resurser", "Unavailable resources"] };
  const visible = Object.entries(labels).filter(([key]) => counts[key] > 0);
  if (!visible.length && !damageCount && !damageOpen) return null;
  return <div className={styles.workspace}><div className={styles.toolbar}>{visible.map(([key, texts]) => <button key={key} onClick={onOpen}><AlertTriangle size={18} /><strong>{counts[key]}</strong>{texts[language === "de" ? 0 : language === "sv" ? 1 : 2]}</button>)}
    {damageCount > 0 && <button onClick={() => setDamageOpen(true)}><AlertTriangle size={18} /><strong>{damageCount}</strong>{operationLabel("damageOutstanding", language)}</button>}
    </div>{damageOpen && <SupplierDamageCases language={language} onClose={() => setDamageOpen(false)} />}</div>;
}
