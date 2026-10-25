export type BillingDraftLine = {
  id: string;
  kind: "Leistung" | "Material" | "Rabatt";
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  currency: string;
  taxRate: string;
  accountingAccount?: string;
  discountType?: "amount" | "percent";
  discountValue?: string;
  revision?: number;
};

export type BillingDraftEdit = {
  customerId: string;
  objectId: string;
  invoiceDate: string;
  dueDate: string;
  serviceDate: string;
  notes: string;
  lines: BillingDraftLine[];
};

export function draftNumber(value: string) {
  return /^[+-]?\d+(?:[.,]\d+)?$/.test(value.trim()) ? Number(value.trim().replace(",", ".")) : NaN;
}

export function billingDraftTotals(lines: BillingDraftLine[]) {
  const round = (value: number) => Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
  let net = 0;
  let tax = 0;
  const taxByRate: Record<string, number> = {};
  for (const line of lines) {
    const lineNet = round(draftNumber(line.quantity) * draftNumber(line.unitPrice));
    const lineTax = round(lineNet * draftNumber(line.taxRate) / 100);
    net += lineNet;
    tax += lineTax;
    taxByRate[line.taxRate] = round((taxByRate[line.taxRate] || 0) + lineTax);
  }
  return { net: round(net), tax: round(tax), gross: round(net + tax), currency: lines[0]?.currency || "SEK", taxByRate };
}

export function billingDraftError(draft: BillingDraftEdit): "customer" | "date" | "lines" | "currency" | null {
  if (!draft.customerId || !draft.objectId) return "customer";
  const validDate = (value: string) => {
    const date = new Date(`${value}T12:00:00Z`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (![draft.invoiceDate, draft.dueDate].every(validDate) || (draft.serviceDate && !validDate(draft.serviceDate)) || draft.dueDate < draft.invoiceDate) return "date";
  if (!draft.lines.length || new Set(draft.lines.map(line => line.id)).size !== draft.lines.length || draft.lines.some(line => {
    const numbers = [line.quantity, line.unitPrice, line.taxRate].map(draftNumber);
    return !line.id || !line.name.trim() || !line.unit.trim() || numbers.some(value => !Number.isFinite(value)) || numbers[0] <= 0 || numbers[2] < 0 || numbers[2] > 100 || (line.kind === "Rabatt" ? numbers[1] > 0 : numbers[1] < 0);
  })) return "lines";
  if (new Set(draft.lines.map(line => line.currency)).size !== 1 || !/^[A-Z]{3}$/.test(draft.lines[0].currency)) return "currency";
  const totals = billingDraftTotals(draft.lines);
  if (![totals.net, totals.tax, totals.gross].every(value => Number.isSafeInteger(Math.round(value * 100)))) return "lines";
  return null;
}
