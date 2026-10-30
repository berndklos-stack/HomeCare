"use client";

import { ArrowLeft, Eye, MessageSquare, Plus, Save, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { billingDraftError, billingDraftTotals, billingDraftLineNet, type BillingDraftEdit, type BillingDraftLine } from "@/lib/billingDraft";
import { BillingMasterDataDialog, type BillingCustomerInput, type BillingServiceInput, type BillingCreateResult } from "./BillingMasterDataDialog";
import { BillingArticleDialog } from "./BillingArticleDialog";
import { TripDialog } from "./TripDialog";

type Choice = { id: string; name: string };
export type BillingArticle = { number: string; name: string; kind: "Leistung" | "Material"; unit: string; price: string; currency: string; taxRate?: string; accountingAccount?: string };

export function BillingDraftEditor({ initial, number, language, customers, objects, defaultCurrency, articles = [], onCreateCustomer, onCreateService, onPreview, onSave, onClose }: {
  initial: BillingDraftEdit;
  number: string;
  language: "de" | "sv" | "en";
  defaultCurrency?: string;
  customers: Choice[];
  objects: (Choice & { ownerCustomerId?: string })[];
  articles?: BillingArticle[];
  onCreateCustomer?: (input: BillingCustomerInput) => BillingCreateResult<Choice>;
  onCreateService?: (input: BillingServiceInput) => BillingCreateResult<BillingArticle>;
  onSave: (value: BillingDraftEdit) => string | null;
  onPreview: (value: BillingDraftEdit) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [openComments, setOpenComments] = useState(() => initial.lines.filter(line => line.comment?.trim()).map(line => line.id));
  const [creating, setCreating] = useState<{ kind: "customer" } | { kind: "service"; lineId: string } | null>(null);
  const [pickingLine, setPickingLine] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const copy = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  const update = <K extends keyof BillingDraftEdit>(key: K, value: BillingDraftEdit[K]) => setDraft(current => ({ ...current, [key]: value }));
  const updateLine = (id: string, patch: Partial<BillingDraftLine>) => setDraft(current => ({ ...current, lines: current.lines.map(line => line.id === id ? { ...line, ...patch } : line) }));
  const compatibleObjects = objects.filter(object => !object.ownerCustomerId || object.ownerCustomerId === draft.customerId);
  const { net, tax } = billingDraftTotals(draft.lines);
  const currency = draft.lines[0]?.currency || defaultCurrency || "SEK";
  const money = (value: number) => `${Number.isFinite(value) ? value.toLocaleString(language === "de" ? "de-DE" : language === "sv" ? "sv-SE" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"} ${currency}`;
  const close = () => {
    if (JSON.stringify(draft) !== JSON.stringify(initial)) { setConfirmClose(true); return; }
    onClose();
  };
  const selectArticle = (lineId: string, article: BillingArticle) => updateLine(lineId, { articleNumber: article.number, name: article.name, kind: article.kind, unit: article.unit, unitPrice: article.price, currency: article.currency, taxRate: article.taxRate || "25", accountingAccount: article.accountingAccount, discountPercent: "0" });

  return <section className="billing-editor" aria-label={copy("Rechnung bearbeiten", "Redigera faktura", "Edit invoice")}>
    <header className="billing-editor-title">
      <button type="button" className="outline-button" onClick={close} title={copy("Zurück", "Tillbaka", "Back")} aria-label={copy("Zurück", "Tillbaka", "Back")}><ArrowLeft size={20} /></button>
      <div><small>{copy("Entwurf", "Utkast", "Draft")}</small><h2>{number}</h2></div>
    </header>
    <form onSubmit={event => {
      event.preventDefault();
      const issue = billingDraftError(draft);
      if (issue) {
        setError(issue === "customer" ? copy("Bitte einen Kunden auswählen.", "Välj en kund.", "Select a customer.") : issue === "date" ? copy("Bitte gültige Daten und eine Fälligkeit ab Rechnungsdatum eingeben.", "Kontrollera datum och förfallodatum.", "Check the dates and payment due date.") : issue === "currency" ? copy("Alle Positionen müssen dieselbe Währung haben.", "Alla rader måste ha samma valuta.", "All lines must use the same currency.") : copy("Bitte alle Positionen vollständig und mit gültigen Zahlen erfassen.", "Fyll i alla rader med giltiga värden.", "Complete every line with valid values."));
        return;
      }
      if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "preview") { setError(""); onPreview(structuredClone(draft)); }
      else setError(onSave(draft) || "");
    }}>
      <div className="billing-editor-head">
        <label><span>{copy("Kunde", "Kund", "Customer")}</span><span className="billing-customer-control"><select aria-label={copy("Kunde", "Kund", "Customer")} required value={draft.customerId} onChange={event => {
          const customerId = event.target.value;
          setDraft(current => ({ ...current, customerId, objectId: objects.some(object => object.id === current.objectId && (!object.ownerCustomerId || object.ownerCustomerId === customerId)) ? current.objectId : "" }));
        }}><option value="">—</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>{onCreateCustomer && <button type="button" className="outline-button" title={copy("Neuer Kunde", "Ny kund", "New customer")} aria-label={copy("Neuer Kunde", "Ny kund", "New customer")} onClick={() => setCreating({ kind: "customer" })}><Plus size={18} /></button>}</span></label>
        <label><span>{copy("Projekt / Objekt", "Projekt / objekt", "Project / property")}</span><select value={draft.objectId} onChange={event => update("objectId", event.target.value)}><option value="">{copy("Ohne Zuordnung", "Utan koppling", "No assignment")}</option>{compatibleObjects.map(object => <option key={object.id} value={object.id}>{object.name}</option>)}</select></label>
        <label><span>{copy("Rechnungsdatum", "Fakturadatum", "Invoice date")}</span><input required type="date" value={draft.invoiceDate} onChange={event => update("invoiceDate", event.target.value)} /></label>
        <label><span>{copy("Fällig am", "Förfallodatum", "Due date")}</span><input required type="date" min={draft.invoiceDate} value={draft.dueDate} onChange={event => update("dueDate", event.target.value)} /></label>
        <label><span>{copy("Leistungsdatum", "Leveransdatum", "Service date")}</span><input type="date" value={draft.serviceDate} onChange={event => update("serviceDate", event.target.value)} /></label>
        <label><span>{copy("Ihre Referenz", "Er referens", "Your reference")}</span><input maxLength={250} value={draft.customerReference || ""} onChange={event => update("customerReference", event.target.value)} /></label>
        <label><span>{copy("Unsere Referenz", "Vår referens", "Our reference")}</span><input maxLength={250} value={draft.ourReference || ""} onChange={event => update("ourReference", event.target.value)} /></label>
        <label><span>{copy("Ihre Bestellreferenz", "Er orderreferens", "Your order reference")}</span><input maxLength={250} value={draft.orderReference || ""} onChange={event => update("orderReference", event.target.value)} /></label>
        <label><span>{copy("Währung", "Valuta", "Currency")}</span><select value={currency} onChange={event => update("lines", draft.lines.map(line => ({ ...line, currency: event.target.value })))}>{Array.from(new Set([currency, "SEK", "EUR", "GBP", "USD"])).map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="billing-editor-lines">
        {draft.lines.map((line, index) => <fieldset className="billing-editor-line" key={line.id}>
          <legend>{copy("Position", "Rad", "Line")} {index + 1}</legend>
          <div className="billing-article-field"><span>{copy("Artikel", "Artikel", "Article")}</span><button className="outline-button" type="button" title={line.articleNumber ? `${line.name} (${line.articleNumber})` : copy("Artikel auswählen", "Välj artikel", "Select article")} aria-label={`${copy("Artikel wählen zu Position", "Välj artikel för rad", "Select article for line")} ${index + 1}`} onClick={() => setPickingLine(line.id)}><Search size={18} /></button></div>
          <label><span>{copy("Art", "Typ", "Type")}</span><select value={line.kind} onChange={event => updateLine(line.id, { kind: event.target.value as BillingDraftLine["kind"] })}><option value="Leistung">{copy("Leistung", "Tjänst", "Service")}</option><option value="Material">Material</option><option value="Rabatt">{copy("Rabatt", "Rabatt", "Discount")}</option></select></label>
          <label className="billing-editor-description"><span>{copy("Bezeichnung", "Benämning", "Description")}</span><input required value={line.name} onChange={event => updateLine(line.id, { name: event.target.value })} /></label>
          <label><span>{copy("Menge", "Antal", "Quantity")}</span><input required inputMode="decimal" value={line.quantity} onChange={event => updateLine(line.id, { quantity: event.target.value })} /></label>
          <label><span>{copy("Einheit", "Enhet", "Unit")}</span><input required value={line.unit} onChange={event => updateLine(line.id, { unit: event.target.value })} /></label>
          <label><span>{copy("Einzelpreis", "À-pris", "Unit price")}</span><input required inputMode="decimal" value={line.unitPrice} onChange={event => updateLine(line.id, { unitPrice: event.target.value })} /></label>
          <label><span>{copy("USt. %", "Moms %", "VAT %")}</span><input required inputMode="decimal" value={line.taxRate} onChange={event => updateLine(line.id, { taxRate: event.target.value })} /></label>
          <label><span>{copy("Rabatt %", "Rabatt %", "Discount %")}</span><input inputMode="decimal" disabled={line.kind === "Rabatt"} value={line.discountPercent || "0"} onChange={event => updateLine(line.id, { discountPercent: event.target.value })} /></label>
          <div className="billing-editor-line-sum"><small>{copy("Netto", "Summa exkl. moms", "Net")}</small><output>{money(billingDraftLineNet(line) || 0)}</output></div>
          <div className="billing-editor-line-actions">
            <button className="outline-button" type="button" aria-expanded={openComments.includes(line.id)} title={copy("Kommentar", "Kommentar", "Comment")} aria-label={`${copy("Kommentar zu Position", "Kommentar till rad", "Comment for line")} ${index + 1}`} onClick={() => setOpenComments(current => current.includes(line.id) ? current.filter(id => id !== line.id) : [...current, line.id])}><MessageSquare size={18} /></button>
            <button className="outline-button" type="button" title={copy("Position entfernen", "Ta bort rad", "Remove line")} aria-label={`${copy("Position entfernen", "Ta bort rad", "Remove line")} ${index + 1}`} onClick={() => update("lines", draft.lines.filter(item => item.id !== line.id))}><Trash2 size={18} /></button>
          </div>
          {openComments.includes(line.id) && <label className="billing-editor-comment"><span>{copy("Kommentar", "Kommentar", "Comment")}</span><textarea rows={2} maxLength={10000} value={line.comment || ""} onChange={event => updateLine(line.id, { comment: event.target.value })} /></label>}
        </fieldset>)}
        <button className="outline-button" type="button" onClick={() => update("lines", [...draft.lines, { id: `LINE-${crypto.randomUUID()}`, kind: "Leistung", name: "", quantity: "1", unit: draft.lines[0]?.unit || copy("Stunde", "timme", "hour"), unitPrice: "0", taxRate: draft.lines[0]?.taxRate || "25", currency }])}><Plus size={18} />{copy("Position hinzufügen", "Lägg till rad", "Add line")}</button>
      </div>
      <div className="billing-editor-bottom">
        <label><span>{copy("Notizen", "Anteckningar", "Notes")}</span><textarea rows={3} value={draft.notes} onChange={event => update("notes", event.target.value)} /></label>
        <dl className="billing-editor-totals"><div><dt>{copy("Netto", "Summa", "Net")}</dt><dd>{money(net)}</dd></div><div><dt>{copy("Umsatzsteuer", "Moms", "VAT")}</dt><dd>{money(tax)}</dd></div><div><dt>{copy("Gesamt", "Totalt", "Total")}</dt><dd><output>{money(net + tax)}</output></dd></div></dl>
      </div>
      {error && <p role="alert">{error}</p>}
      <footer className="billing-editor-actions"><button type="button" className="outline-button" onClick={close}>{copy("Abbrechen", "Avbryt", "Cancel")}</button><button type="submit" value="preview" formNoValidate className="outline-button"><Eye size={18} />{copy("Vorschau", "Förhandsgranska", "Preview")}</button><button type="submit" className="primary-button"><Save size={18} />{copy("Entwurf speichern", "Spara utkast", "Save draft")}</button></footer>
    </form>
    {pickingLine && <BillingArticleDialog articles={articles} currency={currency} language={language} initialNumber={draft.lines.find(line => line.id === pickingLine)?.articleNumber || ""} onNumberSelect={articleNumber => { updateLine(pickingLine, { articleNumber }); setPickingLine(null); }} onClose={() => setPickingLine(null)} onSelect={article => { selectArticle(pickingLine, article); setPickingLine(null); }} onCreate={onCreateService ? () => { setCreating({ kind: "service", lineId: pickingLine }); setPickingLine(null); } : undefined} />}
    {creating && <BillingMasterDataDialog kind={creating.kind} language={language} currency={currency} initialName={creating.kind === "service" ? draft.lines.find(line => line.id === creating.lineId)?.name : ""} onClose={() => setCreating(null)} onCustomer={input => {
      if (!onCreateCustomer) return copy("Anlage nicht verfügbar.", "Kan inte skapa.", "Creation unavailable.");
      const result = onCreateCustomer(input);
      if (result.error !== undefined) return result.error;
      setDraft(current => ({ ...current, customerId: result.value.id, objectId: "" })); setCreating(null); return null;
    }} onService={input => {
      if (!onCreateService || creating.kind !== "service") return copy("Anlage nicht verfügbar.", "Kan inte skapa.", "Creation unavailable.");
      const result = onCreateService(input);
      if (result.error !== undefined) return result.error;
      selectArticle(creating.lineId, result.value); setCreating(null); return null;
    }} />}
    {confirmClose && <TripDialog className="sync-confirm-dialog" labelledBy="billing-discard-title" onClose={() => setConfirmClose(false)}>
      <header><h2 id="billing-discard-title">{copy("Änderungen verwerfen?", "Kasta ändringarna?", "Discard changes?")}</h2></header>
      <p>{copy("Die Änderungen an diesem Rechnungsentwurf werden nicht gespeichert. Bereits angelegte Kunden und Leistungen bleiben in den Stammdaten erhalten.", "Ändringarna i fakturautkastet sparas inte. Kunder och tjänster som skapats finns kvar.", "Changes to this invoice draft will not be saved. Customers and services already created remain in master data.")}</p>
      <footer className="modal-actions"><button autoFocus type="button" className="outline-button" onClick={() => setConfirmClose(false)}>{copy("Weiter bearbeiten", "Fortsätt redigera", "Keep editing")}</button><button type="button" className="outline-button danger-action" onClick={onClose}><Trash2 size={18} />{copy("Änderungen verwerfen", "Kasta ändringarna", "Discard changes")}</button></footer>
    </TripDialog>}
  </section>;
}
