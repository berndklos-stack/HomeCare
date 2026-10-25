export type BillingTab = "drafts" | "unpaid" | "all";
export type BillingSort = "number" | "customer" | "invoiceDate" | "dueDate" | "amount";
export type BillingOverviewRow = {
  id: string; number: string; customerNumber: string; customer: string; project: string;
  invoiceDate: string; dueDate: string; status: string; amount: number; currency: string;
  transferStatus: string; category: "service" | "material" | "mixed"; searchText: string;
};
export const unpaidInvoiceStatuses = new Set(["gebucht", "gesendet", "überfällig"]);
export function billingTabMatches(row: BillingOverviewRow, tab: BillingTab) {
  return tab === "all" || (tab === "drafts" ? row.status === "entwurf" : unpaidInvoiceStatuses.has(row.status));
}
export function billingTabCounts(rows: BillingOverviewRow[]) {
  return { drafts: rows.filter(row => billingTabMatches(row, "drafts")).length, unpaid: rows.filter(row => billingTabMatches(row, "unpaid")).length, all: rows.length };
}
export function selectBillingRows(rows: BillingOverviewRow[], filter: { tab: BillingTab; query: string; status: string; category: string; transfer: string; sort: BillingSort; descending: boolean; locale?: string }) {
  const query = filter.query.trim().toLocaleLowerCase();
  const collator = new Intl.Collator(filter.locale || "de", { numeric: true, sensitivity: "base" });
  return rows.filter(row => billingTabMatches(row, filter.tab)
    && (filter.status === "all" || row.status === filter.status)
    && (filter.category === "all" || row.category === filter.category)
    && (filter.transfer === "all" || row.transferStatus === filter.transfer)
    && (!query || [row.number, row.customerNumber, row.customer, row.project, row.invoiceDate, row.dueDate, row.searchText].join(" ").toLocaleLowerCase().includes(query)))
    .sort((a, b) => {
      const comparison = filter.sort === "amount" ? a.amount - b.amount : collator.compare(a[filter.sort], b[filter.sort]);
      return (filter.descending ? -comparison : comparison) || collator.compare(a.id, b.id);
    });
}
export function billingCurrencyTotals(rows: BillingOverviewRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) if (row.status !== "storniert" && Number.isFinite(row.amount)) totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amount);
  return [...totals].sort(([a], [b]) => a.localeCompare(b));
}
