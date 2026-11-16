"use client";

import { useState } from "react";
import { Plus, Trash2, X, Check } from "lucide-react";
import { customerServicePrice, validCustomerServiceCondition, type CustomerServiceCondition } from "@/lib/customerServiceConditions";
import type { BillingServiceInput, BillingCreateResult } from "./BillingMasterDataDialog";
import type { BillingArticle } from "./BillingDraftEditor";

type Service = { id: string; name: string; unit: string; price: string; currency: string; taxRate?: string; archived?: boolean };

export function CustomerServiceConditionsEditor({ conditions, services, language, onChange, onCreateService }: {
  conditions: CustomerServiceCondition[];
  services: Service[];
  language: "de" | "en" | "sv";
  onChange: (conditions: CustomerServiceCondition[]) => void;
  onCreateService: (input: BillingServiceInput) => BillingCreateResult<BillingArticle>;
}) {
  const copy = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<BillingServiceInput>({ name: "", category: "", unit: "Stunde", price: "0", currency: "SEK", taxRate: "25" });
  function assign(serviceId: string) {
    if (!serviceId || conditions.some((item) => item.serviceId === serviceId)) return;
    onChange([...conditions, { id: `CSC-${crypto.randomUUID()}`, serviceId, unitPrice: "", currency: "" }]);
    setSelected("");
  }
  function update(id: string, patch: Partial<CustomerServiceCondition>) {
    onChange(conditions.map((item) => item.id === id ? { ...item, ...patch } : item));
  }
  function create() {
    if (!validCustomerServiceCondition({ serviceId: "new", unitPrice: draft.price, currency: draft.currency })) {
      setError(copy("Bitte einen gültigen Nettopreis eingeben (maximal vier Nachkommastellen).", "Ange ett giltigt nettopris (högst fyra decimaler).", "Enter a valid net price (up to four decimal places).")); return;
    }
    const result = onCreateService(draft);
    if (!result.value) { setError(result.error || copy("Leistung konnte nicht angelegt werden.", "Kunde inte skapa tjänsten.", "Could not create service.")); return; }
    assign(result.value.number);
    setCreating(false); setError("");
    setDraft({ ...draft, name: "", category: "" });
  }
  return <section className="customer-service-conditions" aria-label={copy("Leistungen und Konditionen", "Tjänster och villkor", "Services and terms")}>
    <h3>{copy("Leistungen und Konditionen", "Tjänster och villkor", "Services and terms")}</h3>
    <div className="customer-condition-toolbar">
      <label><span>{copy("Leistung auswählen", "Välj tjänst", "Select service")}</span><select aria-label={copy("Leistung auswählen", "Välj tjänst", "Select service")} value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">—</option>{services.filter(service => !service.archived && !conditions.some(item => item.serviceId === service.id)).map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
      </select></label>
      <button type="button" className="ghost-button" disabled={!selected} onClick={() => assign(selected)}><Plus size={16} />{copy("Zuordnen", "Tilldela", "Assign")}</button>
      <button type="button" className="ghost-button" onClick={() => { setCreating(true); setError(""); }}><Plus size={16} />{copy("Neue Leistung", "Ny tjänst", "New service")}</button>
    </div>
    {creating && <div className="customer-condition-create form-grid">
      {(["name", "category", "unit", "price", "taxRate"] as const).map(key => <label key={key}><span>{({ name: copy("Bezeichnung", "Benämning", "Description"), category: copy("Kategorie", "Kategori", "Category"), unit: copy("Einheit", "Enhet", "Unit"), price: copy("Stammdatenpreis netto", "Standardpris netto", "Standard net price"), taxRate: copy("USt. %", "Moms %", "VAT %") })[key]}</span><input value={draft[key]} inputMode={["price", "taxRate"].includes(key) ? "decimal" : undefined} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
      <label><span>{copy("Währung", "Valuta", "Currency")}</span><select aria-label={copy("Währung", "Valuta", "Currency")} value={draft.currency} onChange={event => setDraft({ ...draft, currency: event.target.value })}>{["SEK", "EUR", "USD", "GBP", "NOK", "DKK", "CHF"].map(value => <option key={value}>{value}</option>)}</select></label>
      <div className="wide row-actions"><button type="button" className="ghost-button" onClick={() => setCreating(false)}><X size={16} />{copy("Abbrechen", "Avbryt", "Cancel")}</button><button type="button" className="primary-button" disabled={!draft.name.trim() || !draft.category.trim() || !draft.unit.trim()} onClick={create}><Check size={16} />{copy("Anlegen und zuordnen", "Skapa och tilldela", "Create and assign")}</button></div>
      {error && <p className="wide" role="alert">{error}</p>}
    </div>}
    {conditions.map(condition => {
      const service = services.find(item => item.id === condition.serviceId);
      const resolved = service ? customerServicePrice(service, [condition]) : undefined;
      const standard = condition.unitPrice === "" && condition.currency === "";
      return <div className="customer-condition-row" key={condition.id}>
        <div><strong>{service?.name || condition.serviceId}</strong><small>{service?.unit} · {service?.taxRate || "0"}% {copy("USt.", "moms", "VAT")}{service?.archived ? ` · ${copy("archiviert", "arkiverad", "archived")}` : ""}</small></div>
        <label className="checkbox-line"><input type="checkbox" checked={standard} onChange={event => update(condition.id, event.target.checked ? { unitPrice: "", currency: "" } : { unitPrice: service?.price || "0", currency: service?.currency || "SEK" })} /><span>{copy("Stammdatenpreis", "Standardpris", "Standard price")}</span></label>
        <label><span>{copy("Kundenpreis netto", "Kundpris netto", "Customer net price")}</span><input disabled={standard} inputMode="decimal" aria-invalid={!validCustomerServiceCondition(condition)} value={standard ? resolved?.price || "" : condition.unitPrice} onChange={event => update(condition.id, { unitPrice: event.target.value, currency: condition.currency || service?.currency || "SEK" })} /></label>
        <span>{standard ? resolved?.currency : condition.currency} / {service?.unit}</span>
        <button className="ghost-button icon-button" type="button" aria-label={`${copy("Zuordnung entfernen", "Ta bort tilldelning", "Remove assignment")} ${service?.name || condition.serviceId}`} data-tooltip={copy("Zuordnung entfernen", "Ta bort tilldelning", "Remove assignment")} onClick={() => onChange(conditions.filter(item => item.id !== condition.id))}><Trash2 size={16} /></button>
        {!validCustomerServiceCondition(condition) && <p className="wide" role="alert">{copy("Bitte einen gültigen Nettopreis eingeben.", "Ange ett giltigt nettopris.", "Enter a valid net price.")}</p>}
      </div>;
    })}
  </section>;
}
