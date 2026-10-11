import type { StockMaterialLine } from "./jobStock";

export type ReviewedMaterial = { material_id: string; material: { name: string; category?: string | null; unit?: string | null; sales_price?: number | string | null; currency?: string | null; tax_rate?: number | string | null; accounting_account?: string | null } };

// Zero-consumption markers replace planned billing quantities without inventing stock movements.
export function reviewedStockMaterials(booked: StockMaterialLine[], reviewed: ReviewedMaterial[]): StockMaterialLine[] {
  const ids = new Set(booked.map((line) => line.materialId));
  return [...booked, ...reviewed.flatMap(({ material_id, material }) => {
    if (ids.has(material_id)) return [];
    ids.add(material_id);
    return [{ id: `REVIEW-${material_id}`, materialId: material_id, name: material.name, category: material.category ?? "Material", unit: material.unit ?? "", quantity: "0", price: String(material.sales_price ?? 0), currency: material.currency ?? "SEK", taxRate: String(material.tax_rate ?? 25), accountingAccount: material.accounting_account ?? "3058" }];
  })];
}
