"use client";
import { useState } from "react";
import { Printer } from "lucide-react";
import { entityCodeLabelPdf } from "@/lib/locationLabel";

export function EntityCodeLabel({ saved, current, kind, language }: {
  saved?: { name: string; scanCode?: string }; current: { name: string; scanCode?: string };
  kind: "job" | "object"; language: "de" | "sv" | "en";
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const index = language === "de" ? 0 : language === "sv" ? 1 : 2;
  async function print() {
    setError("");
    if (!saved?.scanCode?.trim() || saved.scanCode !== current.scanCode?.trim() || saved.name !== current.name.trim()) {
      setError(["Bitte Bezeichnung und Code zuerst speichern und erneut öffnen.", "Spara benämning och kod först och öppna igen.", "Save the description and code first, then reopen."][index]); return;
    }
    setBusy(true);
    try {
      const blob = await entityCodeLabelPdf({ name: saved.name, code: saved.scanCode, kind }, language);
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `${kind === "job" ? "Auftrag" : "Objekt"}-${saved.scanCode.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError(["Etikett konnte nicht erstellt werden.", "Etiketten kunde inte skapas.", "Could not create label."][index]); }
    finally { setBusy(false); }
  }
  return <div><button className="ghost-button" type="button" disabled={busy} onClick={() => void print()}><Printer size={16} />{["Code-Etikett als PDF", "Kodetikett som PDF", "Code label PDF"][index]}</button>{error && <p role="alert">{error}</p>}</div>;
}
