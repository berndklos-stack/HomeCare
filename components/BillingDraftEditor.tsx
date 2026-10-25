"use client";

import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { billingDraftError, billingDraftTotals, draftNumber, type BillingDraftEdit, type BillingDraftLine } from "@/lib/billingDraft";

type Choice = { id: string; name: string };

export function BillingDraftEditor({ initial, number, language, customers, objects, defaultCurrency, onSave, onClose }: {
  initial: BillingDraftEdit;
  number: string;
  language: "de" | "sv" | "en";
  defaultCurrency?: string;
  customers: Choice[];
  objects: (Choice & { ownerCustomerId?: string })[];
  onSave: (value: BillingDraftEdit) => string | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const copy = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  const update = <K extends keyof BillingDraftEdit>(key: K, value: BillingDraftEdit[K]) => setDraft(current => ({ ...current, [key]: value }));
  const updateLine = (id: string, patch: Partial<BillingDraftLine>) => setDraft(current => ({ ...current, lines: current.lines.map(line => line.id === id ? { ...line, ...patch } : line) }));
  const compatibleObjects = objects.filter(object => !object.ownerCustomerId || object.ownerCustomerId === draft.customerId);
  const { net, tax } = billingDraftTotals(draft.lines);
  const currency = draft.lines[0]?.currency || defaultCurrency || "SEK";
  const money = (value: number) => `${Number.isFinite(value) ? value.toLocaleString(language === "de" ? "de-DE" : language === "sv" ? "sv-SE" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"} ${currency}`;
  const close = () => {
    if (JSON.stringify(draft) !== JSON.stringify(initial) && !window.confirm(copy("Änderungen verwerfen?", "Kasta ändringarna?", "Discard changes?"))) return;
    onClose();
  };

  return <section className="billing-editor" aria-label={copy("Rechnung bearbeiten", "Redigera faktura", "Edit invoice")}>
    <header className="billing-editor-title">
      <button type="button" className="outline-button" onClick={close} title={copy("Zurück", "Tillbaka", "Back")} aria-label={copy("Zurück", "Tillbaka", "Back")}><ArrowLeft size={20} /></button>
      <div><small>{copy("Entwurf", "Utkast", "Draft")}</small><h2>{number}</h2></div>
    </header>
    <form onSubmit={event => {
      event.preventDefault();
      const issue = billingDraftError(draft);
      if (issue) {
        setError(issue === "customer" ? copy("Bitte Kunde und Projekt/Objekt auswählen.", "Välj kund och projekt/objekt.", "Select a customer and project/property.") : issue === "date" ? copy("Bitte gültige Daten und eine Fälligkeit ab Rechnungsdatum eingeben.", "Kontrollera datum och förfallodatum.", "Check the dates and payment due date.") : issue === "currency" ? copy("Alle Positionen müssen dieselbe Währung haben.", "Alla rader måste ha samma valuta.", "All lines must use the same currency.") : copy("Bitte alle Positionen vollständig und mit gültigen Zahlen erfassen.", "Fyll i alla rader med giltiga värden.", "Complete every line with valid values."));
        return;
      }
      setError(onSave(draft) || "");
    }}>
      <div className="billing-editor-head">
        <label><span>{copy("Kunde", "Kund", "Customer")}</span><select required value={draft.customerId} onChange={event => {
          const customerId = event.target.value;
          setDraft(current => ({ ...current, customerId, objectId: objects.some(object => object.id === current.objectId && (!object.ownerCustomerId || object.ownerCustomerId === customerId)) ? current.objectId : "" }));
        }}><option value="">—</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label><span>{copy("Projekt / Objekt", "Projekt / objekt", "Project / property")}</span><select required value={draft.objectId} onChange={event => update("objectId", event.target.value)}><option value="">—</option>{compatibleObjects.map(object => <option key={object.id} value={object.id}>{object.name}</option>)}</select></label>
        <label><span>{copy("Rechnungsdatum", "Fakturadatum", "Invoice date")}</span><input required type="date" value={draft.invoiceDate} onChange={event => update("invoiceDate", event.target.value)} /></label>
        <label><span>{copy("Fällig am", "Förfallodatum", "Due date")}</span><input required type="date" min={draft.invoiceDate} value={draft.dueDate} onChange={event => update("dueDate", event.target.value)} /></label>
        <label><span>{copy("Leistungsdatum", "Leveransdatum", "Service date")}</span><input type="date" value={draft.serviceDate} onChange={event => update("serviceDate", event.target.value)} /></label>
      </div>
      <div className="billing-editor-lines">
        {draft.lines.map((line, index) => <fieldset className="billing-editor-line" key={line.id}>
          <legend>{copy("Position", "Rad", "Line")} {index + 1}</legend>
          <label><span>{copy("Art", "Typ", "Type")}</span><select value={line.kind} onChange={event => updateLine(line.id, { kind: event.target.value as BillingDraftLine["kind"] })}><option value="Leistung">{copy("Leistung", "Tjänst", "Service")}</option><option value="Material">Material</option><option value="Rabatt">{copy("Rabatt", "Rabatt", "Discount")}</option></select></label>
          <label className="billing-editor-description"><span>{copy("Bezeichnung", "Benämning", "Description")}</span><input required value={line.name} onChange={event => updateLine(line.id, { name: event.target.value })} /></label>
          <label><span>{copy("Menge", "Antal", "Quantity")}</span><input required inputMode="decimal" value={line.quantity} onChange={event => updateLine(line.id, { quantity: event.target.value })} /></label>
          <label><span>{copy("Einheit", "Enhet", "Unit")}</span><input required value={line.unit} onChange={event => updateLine(line.id, { unit: event.target.value })} /></label>
          <label><span>{copy("Einzelpreis", "À-pris", "Unit price")}</span><input required inputMode="decimal" value={line.unitPrice} onChange={event => updateLine(line.id, { unitPrice: event.target.value })} /></label>
          <label><span>{copy("USt. %", "Moms %", "VAT %")}</span><input required inputMode="decimal" value={line.taxRate} onChange={event => updateLine(line.id, { taxRate: event.target.value })} /></label>
          <div className="billing-editor-line-sum"><small>{copy("Netto", "Exkl. moms", "Net")}</small><output>{money(draftNumber(line.quantity) * draftNumber(line.unitPrice) || 0)}</output></div>
          <button className="outline-button" type="button" title={copy("Position entfernen", "Ta bort rad", "Remove line")} aria-label={`${copy("Position entfernen", "Ta bort rad", "Remove line")} ${index + 1}`} onClick={() => update("lines", draft.lines.filter(item => item.id !== line.id))}><Trash2 size={18} /></button>
        </fieldset>)}
        <button className="outline-button" type="button" onClick={() => update("lines", [...draft.lines, { id: `LINE-${crypto.randomUUID()}`, kind: "Leistung", name: "", quantity: "1", unit: draft.lines[0]?.unit || copy("Stunde", "timme", "hour"), unitPrice: "0", taxRate: draft.lines[0]?.taxRate || "25", currency }])}><Plus size={18} />{copy("Position hinzufügen", "Lägg till rad", "Add line")}</button>
      </div>
      <div className="billing-editor-bottom">
        <label><span>{copy("Notizen", "Anteckningar", "Notes")}</span><textarea rows={3} value={draft.notes} onChange={event => update("notes", event.target.value)} /></label>
        <dl className="billing-editor-totals"><div><dt>{copy("Netto", "Summa", "Net")}</dt><dd>{money(net)}</dd></div><div><dt>{copy("Umsatzsteuer", "Moms", "VAT")}</dt><dd>{money(tax)}</dd></div><div><dt>{copy("Gesamt", "Totalt", "Total")}</dt><dd><output>{money(net + tax)}</output></dd></div></dl>
      </div>
      {error && <p role="alert">{error}</p>}
      <footer className="billing-editor-actions"><button type="button" className="outline-button" onClick={close}>{copy("Abbrechen", "Avbryt", "Cancel")}</button><button type="submit" className="primary-button"><Save size={18} />{copy("Entwurf speichern", "Spara utkast", "Save draft")}</button></footer>
    </form>
  </section>;
}
