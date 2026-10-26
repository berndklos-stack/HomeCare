"use client";

import { Save, X } from "lucide-react";
import { useState } from "react";
import { draftNumber } from "@/lib/billingDraft";
import { TripDialog } from "./TripDialog";

export type BillingCustomerInput = { name: string; company: string; contact: string; email: string; phone: string; address: string };
export type BillingServiceInput = { name: string; category: string; unit: string; price: string; currency: string; taxRate: string };
export type BillingCreateResult<T> = { value: T; error?: never } | { error: string; value?: never };

export function BillingMasterDataDialog({ kind, language, currency, initialName = "", onCustomer, onService, onClose }: {
  kind: "customer" | "service";
  language: "de" | "sv" | "en";
  currency: string;
  initialName?: string;
  onCustomer: (input: BillingCustomerInput) => string | null;
  onService: (input: BillingServiceInput) => string | null;
  onClose: () => void;
}) {
  const copy = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  const title = kind === "customer" ? copy("Neuer Kunde", "Ny kund", "New customer") : copy("Neue Leistung", "Ny tjänst", "New service");
  const [customer, setCustomer] = useState<BillingCustomerInput>({ name: "", company: "", contact: "", email: "", phone: "", address: "" });
  const [service, setService] = useState<BillingServiceInput>({ name: initialName, category: "", unit: copy("Stunde", "timme", "hour"), price: "0", currency, taxRate: "25" });
  const [error, setError] = useState("");
  return <TripDialog className="billing-master-dialog" labelledBy="billing-master-title" onClose={onClose}>
    <header><h2 id="billing-master-title">{title}</h2><button type="button" aria-label={copy("Schließen", "Stäng", "Close")} onClick={onClose}><X size={20} /></button></header>
    <form onSubmit={event => {
      event.preventDefault();
      if (kind === "service" && (!Number.isFinite(draftNumber(service.price)) || draftNumber(service.price) < 0 || !Number.isFinite(draftNumber(service.taxRate)) || draftNumber(service.taxRate) < 0 || draftNumber(service.taxRate) > 100)) {
        setError(copy("Bitte gültigen Preis und Steuersatz eingeben.", "Ange giltigt pris och momssats.", "Enter a valid price and VAT rate.")); return;
      }
      try { setError((kind === "customer" ? onCustomer(customer) : onService(service)) || ""); }
      catch { setError(copy("Speichern nicht möglich. Deine Eingaben bleiben erhalten.", "Det gick inte att spara. Dina uppgifter finns kvar.", "Unable to save. Your input has been retained.")); }
    }}>
      <div className="billing-master-fields">
        {kind === "customer" ? <>
          <label><span>{copy("Name", "Namn", "Name")}</span><input autoFocus required maxLength={250} value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} /></label>
          <label><span>{copy("Firma", "Företag", "Company")}</span><input maxLength={250} value={customer.company} onChange={e => setCustomer({ ...customer, company: e.target.value })} /></label>
          <label><span>{copy("Ansprechpartner", "Kontaktperson", "Contact")}</span><input maxLength={250} value={customer.contact} onChange={e => setCustomer({ ...customer, contact: e.target.value })} /></label>
          <label><span>{copy("E-Mail", "E-post", "Email")}</span><input type="email" maxLength={250} value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} /></label>
          <label><span>{copy("Telefon", "Telefon", "Phone")}</span><input type="tel" maxLength={100} value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} /></label>
          <label><span>{copy("Adresse", "Adress", "Address")}</span><textarea rows={2} maxLength={2000} value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} /></label>
        </> : <>
          <label><span>{copy("Bezeichnung", "Benämning", "Description")}</span><input autoFocus required maxLength={250} value={service.name} onChange={e => setService({ ...service, name: e.target.value })} /></label>
          <label><span>{copy("Kategorie", "Kategori", "Category")}</span><input required maxLength={100} value={service.category} onChange={e => setService({ ...service, category: e.target.value })} /></label>
          <label><span>{copy("Einheit", "Enhet", "Unit")}</span><input required maxLength={50} value={service.unit} onChange={e => setService({ ...service, unit: e.target.value })} /></label>
          <label><span>{copy("Einzelpreis", "À-pris", "Unit price")}</span><input required inputMode="decimal" value={service.price} onChange={e => setService({ ...service, price: e.target.value })} /></label>
          <label><span>{copy("USt. %", "Moms %", "VAT %")}</span><input required inputMode="decimal" value={service.taxRate} onChange={e => setService({ ...service, taxRate: e.target.value })} /></label>
          <label><span>{copy("Währung", "Valuta", "Currency")}</span><input readOnly value={currency} /></label>
        </>}
      </div>
      {error && <p role="alert">{error}</p>}
      <footer className="modal-actions"><button type="button" className="outline-button" onClick={onClose}>{copy("Abbrechen", "Avbryt", "Cancel")}</button><button type="submit" className="primary-button"><Save size={18} />{copy("Speichern und übernehmen", "Spara och välj", "Save and select")}</button></footer>
    </form>
  </TripDialog>;
}
