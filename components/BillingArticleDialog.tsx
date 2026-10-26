"use client";

import { Plus, Search, X } from "lucide-react";
import { useState } from "react";
import type { BillingArticle } from "./BillingDraftEditor";
import { TripDialog } from "./TripDialog";

export function BillingArticleDialog({ articles, currency, language, initialNumber, onNumberSelect, onSelect, onCreate, onClose }: {
  articles: BillingArticle[];
  currency: string;
  language: "de" | "sv" | "en";
  initialNumber: string;
  onNumberSelect: (value: string) => void;
  onSelect: (article: BillingArticle) => void;
  onCreate?: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [articleNumber, setArticleNumber] = useState(initialNumber);
  const copy = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  const matches = articles.filter(item => item.currency === currency && `${item.name} ${item.number}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, language, { numeric: true }));
  return <TripDialog className="billing-master-dialog" labelledBy="billing-article-title" onClose={onClose}>
    <header><h2 id="billing-article-title">{copy("Leistung / Material auswählen", "Välj tjänst / material", "Select service / material")}</h2><button type="button" aria-label={copy("Schließen", "Stäng", "Close")} onClick={onClose}><X size={20} /></button></header>
    <label className="billing-article-search"><span><Search size={16} />{copy("Suche", "Sök", "Search")}</span><input autoFocus type="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {
      if (e.key === "Enter" && matches.length === 1) { e.preventDefault(); onSelect(matches[0]); }
    }} /></label>
    <ul className="billing-article-results" aria-label={copy("Artikel", "Artiklar", "Articles")}>
      {matches.map(article => <li key={`${article.kind}-${article.number}`}><button type="button" onClick={() => onSelect(article)}>
        <strong>{article.name}</strong><small>{article.kind === "Material" ? "Material" : copy("Leistung", "Tjänst", "Service")} · {article.price} {article.currency} / {article.unit}</small>
      </button></li>)}
    </ul>
    {!matches.length && <p role="status">{copy("Keine passenden Artikel vorhanden.", "Inga matchande artiklar.", "No matching articles.")}</p>}
    <details><summary>{copy("Eigene Artikelnummer", "Eget artikelnummer", "Custom article number")}</summary><div className="billing-custom-article"><label><span>{copy("Artikelnummer", "Artikelnummer", "Article number")}</span><input maxLength={100} value={articleNumber} onChange={e => setArticleNumber(e.target.value)} /></label><button type="button" className="outline-button" onClick={() => onNumberSelect(articleNumber.trim())}>{copy("Übernehmen", "Välj", "Apply")}</button></div></details>
    <footer className="modal-actions"><button type="button" className="outline-button" onClick={onClose}>{copy("Abbrechen", "Avbryt", "Cancel")}</button>{onCreate && <button type="button" className="primary-button" onClick={onCreate}><Plus size={18} />{copy("Neue Leistung", "Ny tjänst", "New service")}</button>}</footer>
  </TripDialog>;
}
