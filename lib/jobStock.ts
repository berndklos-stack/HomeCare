export type StockMaterialLine = {
  id: string; materialId?: string; name: string; category: string; unit: string;
  quantity: string; price: string; currency: string; taxRate?: string; accountingAccount?: string;
};

export function billableJobMaterials<T extends StockMaterialLine>(planned: T[], booked: StockMaterialLine[]) {
  // Actual stock consumption replaces planned quantities for the same material.
  const materialIds = new Set(booked.map((line) => line.materialId));
  return [...planned.filter((line) => !line.materialId || !materialIds.has(line.materialId)), ...booked.filter((line) => Number(line.quantity) > 0)];
}

export function stockMaterialLines(rows: { id: string; quantity: number | string; source_id?: string | null; billing_data?: Record<string, unknown> | null; billing_source_id?: string | null }[]): StockMaterialLine[] {
  const lines = new Map<string, StockMaterialLine>();
  for (const row of rows) {
    if (!row.billing_data || !Object.keys(row.billing_data).length) continue;
    const id = `STOCK-${row.billing_source_id || row.id}`;
    const previous = lines.get(id);
    const data = row.billing_data as Omit<StockMaterialLine, "id" | "quantity">;
    lines.set(id, { ...data, id, quantity: String((previous ? Number(previous.quantity) : 0) + (row.source_id ? 1 : -1) * Number(row.quantity)) });
  }
  return [...lines.values()];
}
