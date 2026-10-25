"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, FileText, Search } from "lucide-react";
import { billingCurrencyTotals, billingTabCounts, selectBillingRows, type BillingOverviewRow, type BillingSort, type BillingTab } from "@/lib/billingOverview";

export function BillingOverview({ rows, language, renderDetails, onPreview }: {
  rows: BillingOverviewRow[]; language: "de" | "sv" | "en";
  renderDetails: (id: string) => ReactNode; onPreview: (id: string) => void;
}) {
  const copy = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  const [tab, setTab] = useState<BillingTab>("drafts");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [transfer, setTransfer] = useState("all");
  const [sort, setSort] = useState<BillingSort>("invoiceDate");
  const [descending, setDescending] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const counts = billingTabCounts(rows);
  const selected = selectBillingRows(rows, { tab, query, status, category, transfer, sort, descending, locale: language });
  const totals = billingCurrencyTotals(selected);
  const statusNames: Record<string, string> = { entwurf: copy("Entwurf", "Utkast", "Draft"), gebucht: copy("Gebucht", "Bokförd", "Issued"), gesendet: copy("Versendet", "Skickad", "Sent"), "überfällig": copy("Überfällig", "Förfallen", "Overdue"), bezahlt: copy("Bezahlt", "Betald", "Paid"), storniert: copy("Storniert", "Makulerad", "Cancelled") };
  const transferName = (value: string) => value === "gesendet" ? copy("Als übergeben markiert", "Markerad som överförd", "Marked as transferred") : value === "fehler" ? copy("Fehler", "Fel", "Error") : copy("Nicht übergeben", "Inte överförd", "Not transferred");
  const money = (amount: number, currency: string) => {
    const locale = language === "sv" ? "sv-SE" : language === "en" ? "en-GB" : "de-DE";
    try { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount); }
    catch { return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(amount)} ${currency}`; }
  };
  function changeSort(value: BillingSort) { if (sort === value) setDescending(!descending); else { setSort(value); setDescending(false); } }
  const sortHeading = (key: BillingSort, title: string) => <th scope="col" aria-sort={sort === key ? descending ? "descending" : "ascending" : "none"}><button type="button" onClick={() => changeSort(key)}>{title}{sort === key && (descending ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" />)}</button></th>;
  return <div className="billing-ledger">
    <div className="billing-ledger-tabs" role="tablist" aria-label={copy("Rechnungsübersicht", "Kundfakturor", "Customer invoices")} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const order: BillingTab[] = ["drafts", "unpaid", "all"];
      const next = order[event.key === "Home" ? 0 : event.key === "End" ? 2 : (order.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3];
      setTab(next); setStatus("all"); setExpanded(null); document.getElementById(`billing-tab-${next}`)?.focus();
    }}>
      {([["drafts", copy("Entwürfe", "Utkast", "Drafts")], ["unpaid", copy("Unbezahlte Rechnungen", "Obetalda kundfakturor", "Unpaid invoices")], ["all", copy("Alle Rechnungen", "Alla kundfakturor", "All invoices")]] as const).map(([key, title]) => <button key={key} id={`billing-tab-${key}`} type="button" role="tab" tabIndex={tab === key ? 0 : -1} aria-selected={tab === key} aria-controls="billing-ledger-panel" onClick={() => { setTab(key); setStatus("all"); setExpanded(null); }}>{title}<span>{counts[key]}</span></button>)}
    </div>
    <div id="billing-ledger-panel" role="tabpanel" aria-labelledby={`billing-tab-${tab}`}>
      <div className="billing-ledger-filters">
        <label className="billing-ledger-search"><span>{copy("Suche", "Sök", "Search")}</span><div><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={copy("Kunde, Projekt, Rechnung …", "Kund, projekt, faktura …", "Customer, project, invoice …")} /></div></label>
        <label><span>{copy("Kategorie", "Kategori", "Category")}</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">{copy("Alle Kategorien", "Alla kategorier", "All categories")}</option><option value="service">{copy("Leistungen", "Tjänster", "Services")}</option><option value="material">{copy("Material", "Material", "Materials")}</option><option value="mixed">{copy("Leistungen und Material", "Tjänster och material", "Services and materials")}</option></select></label>
        <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">{copy("Alle Status", "Alla statusar", "All statuses")}</option>{Object.entries(statusNames).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
        <label><span>{copy("Spiris-Übergabe", "Spiris-överföring", "Spiris transfer")}</span><select value={transfer} onChange={event => setTransfer(event.target.value)}><option value="all">{copy("Alle", "Alla", "All")}</option>{["nicht gesendet", "gesendet", "fehler"].map(value => <option value={value} key={value}>{transferName(value)}</option>)}</select></label>
        <label className="billing-ledger-sort"><span>{copy("Sortieren", "Sortera", "Sort")}</span><select value={`${sort}:${descending ? "desc" : "asc"}`} onChange={event => { const [key, direction] = event.target.value.split(":"); setSort(key as BillingSort); setDescending(direction === "desc"); }}>
          <option value="invoiceDate:desc">{copy("Datum: neueste zuerst", "Datum: nyaste först", "Date: newest first")}</option><option value="invoiceDate:asc">{copy("Datum: älteste zuerst", "Datum: äldsta först", "Date: oldest first")}</option><option value="number:asc">{copy("Rechnungsnummer", "Fakturanummer", "Invoice number")}</option><option value="customer:asc">{copy("Kunde A–Z", "Kund A–Ö", "Customer A–Z")}</option><option value="dueDate:asc">{copy("Fälligkeit", "Förfallodatum", "Due date")}</option><option value="amount:desc">{copy("Betrag: absteigend", "Belopp: fallande", "Amount: descending")}</option><option value="amount:asc">{copy("Betrag: aufsteigend", "Belopp: stigande", "Amount: ascending")}</option>
        </select></label>
      </div>
      <div className="billing-ledger-totals" aria-live="polite"><span>{selected.length} {copy("Rechnungen", "fakturor", "invoices")}</span><div>{totals.map(([currency, amount]) => <strong key={currency}>{copy("Summe", "Totalt", "Total")}: {money(amount, currency)}</strong>)}</div></div>
      <table className="billing-ledger-table"><caption className="sr-only">{copy("Rechnungen", "Kundfakturor", "Customer invoices")}</caption><thead><tr>
        {sortHeading("number", copy("Rechnungsnr.", "Fakt.nr", "Invoice no."))}<th scope="col">{copy("Kundennr.", "Kundnr", "Customer no.")}</th>{sortHeading("customer", copy("Kunde", "Kundnamn", "Customer"))}<th scope="col">{copy("Projekt / Objekt", "Projekt / objekt", "Project / property")}</th>{sortHeading("invoiceDate", copy("Datum", "Datum", "Date"))}{sortHeading("dueDate", copy("Fällig", "Förfallodatum", "Due"))}{sortHeading("amount", copy("Betrag", "Belopp", "Amount"))}<th scope="col">Status</th><th scope="col">{copy("Aktionen", "Åtgärder", "Actions")}</th>
      </tr></thead><tbody>{selected.map(row => <Fragment key={row.id}><tr className={expanded === row.id ? "is-expanded" : ""}>
        <td data-label={copy("Rechnungsnr.", "Fakt.nr", "Invoice no.")}><button type="button" className="billing-invoice-link" onClick={() => onPreview(row.id)}>{row.number}</button></td>
        <td data-label={copy("Kundennr.", "Kundnr", "Customer no.")}>{row.customerNumber}</td>
        <td data-label={copy("Kunde", "Kundnamn", "Customer")}>{row.customer}</td><td data-label={copy("Projekt / Objekt", "Projekt / objekt", "Project / property")}>{row.project}</td>
        <td data-label={copy("Rechnungsdatum", "Fakturadatum", "Invoice date")}>{row.invoiceDate || "—"}</td><td data-label={copy("Fällig", "Förfallodatum", "Due")}>{row.dueDate || "—"}</td>
        <td data-label={copy("Betrag", "Belopp", "Amount")} className="billing-ledger-amount">{money(row.amount, row.currency)}</td><td data-label="Status"><span className={`billing-ledger-status status-${row.status === "überfällig" ? "overdue" : row.status}`}>{statusNames[row.status] || row.status}</span></td>
        <td className="billing-ledger-actions"><button type="button" title={copy("Vorschau", "Förhandsgranska", "Preview")} aria-label={`${copy("Rechnungsvorschau", "Förhandsgranska faktura", "Preview invoice")} ${row.number}`} onClick={() => onPreview(row.id)}><FileText size={18} /></button><button type="button" title={copy("Details und Aktionen", "Detaljer och åtgärder", "Details and actions")} aria-label={`${copy("Details und Aktionen", "Detaljer och åtgärder", "Details and actions")} ${row.number}`} aria-expanded={expanded === row.id} onClick={() => setExpanded(expanded === row.id ? null : row.id)}>{expanded === row.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button></td>
      </tr>{expanded === row.id && <tr className="billing-ledger-detail"><td colSpan={9}>{renderDetails(row.id)}</td></tr>}</Fragment>)}</tbody></table>
      {selected.length === 0 && <p className="billing-ledger-empty" role="status">{copy("Keine Rechnungen zum aktuellen Filter vorhanden.", "Inga fakturor matchar filtret.", "No invoices match the current filters.")}</p>}
    </div>
  </div>;
}
