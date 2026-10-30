export type BillingDraftLine = {
  id: string;
  kind: "Leistung" | "Material" | "Rabatt";
  name: string;
  articleNumber?: string;
  comment?: string;
  discountPercent?: string;
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
  customerReference?: string;
  ourReference?: string;
  orderReference?: string;
  lines: BillingDraftLine[];
};

export function copyBillingDraft(source: BillingDraftEdit, invoiceDate: string, dueDate: string): BillingDraftEdit {
  return {
    customerId: source.customerId, objectId: source.objectId, invoiceDate, dueDate, serviceDate: "", notes: source.notes,
    customerReference: source.customerReference, ourReference: source.ourReference, orderReference: source.orderReference,
    lines: source.lines.map(line => ({
      id: `LINE-${crypto.randomUUID()}`, kind: line.kind, name: line.name, articleNumber: line.articleNumber,
      comment: line.comment, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice,
      currency: line.currency, taxRate: line.taxRate, accountingAccount: line.accountingAccount,
      discountPercent: line.discountPercent, discountType: line.discountType, discountValue: line.discountValue,
    })),
  };
}

export function draftNumber(value: string) {
  return /^[+-]?\d+(?:[.,]\d+)?$/.test(value.trim()) ? Number(value.trim().replace(",", ".")) : NaN;
}

export function billingDraftLineNet(line: BillingDraftLine) {
  const value = draftNumber(line.quantity) * draftNumber(line.unitPrice) * (1 - draftNumber(line.discountPercent || "0") / 100);
  return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
}

export function billingDraftTotals(lines: BillingDraftLine[]) {
  const round = (value: number) => Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
  let net = 0;
  let tax = 0;
  const taxByRate: Record<string, number> = {};
  for (const line of lines) {
    const lineNet = billingDraftLineNet(line);
    const lineTax = round(lineNet * draftNumber(line.taxRate) / 100);
    net += lineNet;
    tax += lineTax;
    taxByRate[line.taxRate] = round((taxByRate[line.taxRate] || 0) + lineTax);
  }
  return { net: round(net), tax: round(tax), gross: round(net + tax), currency: lines[0]?.currency || "SEK", taxByRate };
}

export function billingDraftError(draft: BillingDraftEdit): "customer" | "date" | "lines" | "currency" | null {
  if (!draft.customerId) return "customer";
  if ([draft.customerReference, draft.ourReference, draft.orderReference].some(value => (value?.length || 0) > 250)) return "lines";
  const validDate = (value: string) => {
    const date = new Date(`${value}T12:00:00Z`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (![draft.invoiceDate, draft.dueDate].every(validDate) || (draft.serviceDate && !validDate(draft.serviceDate)) || draft.dueDate < draft.invoiceDate) return "date";
  if (!draft.lines.length || new Set(draft.lines.map(line => line.id)).size !== draft.lines.length || draft.lines.some(line => {
    const numbers = [line.quantity, line.unitPrice, line.taxRate, line.discountPercent || "0"].map(draftNumber);
    return !line.id || !line.name.trim() || !line.unit.trim() || (line.comment?.length || 0) > 10000 || (line.articleNumber?.length || 0) > 100 || numbers.some(value => !Number.isFinite(value)) || numbers[0] <= 0 || numbers[2] < 0 || numbers[2] > 100 || numbers[3] < 0 || numbers[3] > 100 || (line.kind === "Rabatt" ? numbers[1] > 0 || numbers[3] !== 0 : numbers[1] < 0);
  })) return "lines";
  if (new Set(draft.lines.map(line => line.currency)).size !== 1 || !/^[A-Z]{3}$/.test(draft.lines[0].currency)) return "currency";
  const totals = billingDraftTotals(draft.lines);
  if (![totals.net, totals.tax, totals.gross].every(value => Number.isSafeInteger(Math.round(value * 100)))) return "lines";
  return null;
}
