"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { materialLabelPdf } from "@/lib/locationLabel";

type LabelMaterial = { name: string; sku?: string; scanCode?: string };

export function MaterialLabel({ saved, current, language }: { saved: LabelMaterial; current: LabelMaterial; language: "de" | "sv" | "en" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const index = language === "de" ? 0 : language === "sv" ? 1 : 2;

  async function print() {
    setError("");
    if (["name", "sku", "scanCode"].some((key) => (saved[key as keyof LabelMaterial] ?? "") !== (current[key as keyof LabelMaterial] ?? "").trim())) {
      setError(["Bitte Bezeichnung, Materialnummer und Scancode zuerst speichern und das Material erneut öffnen.", "Spara benämning, artikelnummer och skanningskod först och öppna materialet igen.", "Save the description, item number and scan code first, then reopen the material."][index]);
      return;
    }
    if (!saved.scanCode?.trim()) {
      setError(["Bitte zuerst einen EAN / Scancode hinterlegen und speichern.", "Ange och spara en EAN / skanningskod först.", "Enter and save an EAN / scan code first."][index]);
      return;
    }
    setBusy(true);
    try {
      const pdf = await materialLabelPdf({ name: saved.name, sku: saved.sku, code: saved.scanCode }, language);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Material-${(saved.sku || saved.scanCode).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError(["Etikett konnte nicht erstellt werden. Bitte Länge von Bezeichnung, Materialnummer und Code prüfen und erneut versuchen.", "Etiketten kunde inte skapas. Kontrollera längden på benämning, artikelnummer och kod och försök igen.", "Could not create the label. Check the length of the description, item number and code and try again."][index]);
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <button className="ghost-button" disabled={busy} onClick={print} type="button"><Printer size={16} />{["Etikett als PDF", "Etikett som PDF", "PDF label"][index]}</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
