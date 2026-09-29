import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { overlayPendingFinancialMutations, prepareFinancialMutations } from "../lib/financialSync";
import { createSyncMutation } from "../lib/syncQueue";

test("Rechnung, Position, Zahlung und Export werden datensatzweise geplant", () => {
  const created = prepareFinancialMutations([], [{
    amount: "125", externalExportStatus: "nicht gesendet", id: "INV-A", invoiceStatus: "entwurf",
    lines: [{ id: "LINE-A", name: "Arbeit", quantity: "2", taxRate: "25", unitPrice: "50" }],
  }]);
  expect(created.mutations).toEqual(expect.arrayContaining([
    expect.objectContaining({ entityType: "invoice", entityId: "INV-A", operation: "create" }),
    expect.objectContaining({ entityType: "invoice_line", entityId: "LINE-A", resourceId: "INV-A" }),
  ]));
  expect(created.mutations.some((item) => item.entityType === "accounting_export")).toBeFalsy();
  expect(created.invoices[0].lines?.[0].revision).toBe(1);

  const changed = prepareFinancialMutations(created.invoices, [{ ...created.invoices[0], paidAt: "2026-09-29T12:00:00Z", externalExportStatus: "gesendet", externalExportedAt: "2026-09-29T13:00:00Z" }]);
  expect(changed.mutations).toEqual(expect.arrayContaining([
    expect.objectContaining({ entityType: "payment", entityId: "PAY-INV-A", operation: "create" }),
    expect.objectContaining({ entityType: "accounting_export", operation: "create", resourceId: "INV-A" }),
  ]));
});

test("Offline-Replay erhält lokale Rechnungen und Tombstones", () => {
  const invoice = { id: "INV-A", invoiceStatus: "entwurf", revision: 2 };
  const update = createSyncMutation({ entityId: "INV-A", entityType: "invoice", expectedRevision: 2, operation: "update", payload: { notes: "Mobil" }, resourceId: "INV-A" });
  expect(overlayPendingFinancialMutations([invoice], [update])[0]).toMatchObject({ notes: "Mobil", revision: 3 });
  const deletion = createSyncMutation({ entityId: "INV-A", entityType: "invoice", expectedRevision: 2, operation: "delete", resourceId: "INV-A" });
  expect(overlayPendingFinancialMutations([invoice], [deletion])).toEqual([]);
});

test("Legacy-Finanzschreibwege sind geschlossen", () => {
  const root = process.cwd();
  const sections = readFileSync(path.join(root, "app/api/sync-sections/route.ts"), "utf8");
  const state = readFileSync(path.join(root, "app/api/app-state/route.ts"), "utf8");
  const backup = readFileSync(path.join(root, "app/api/app-backups/route.ts"), "utf8");
  expect(sections).toContain("SYNC_SECTION_WRITES_RETIRED");
  expect(sections).toContain('if (keys.includes("billing")) sections.billing = await loadBillingSection');
  expect(sections).not.toContain("async function saveBillingSection");
  expect(state).toContain("APP_STATE_RETIRED");
  expect(backup).toContain("homecare_create_relational_backup");
});

test("Migration schützt Finanzintegrität und versöhnt den Import", () => {
  const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260929090000_financial_relational_cutover.sql"), "utf8");
  expect(migration).toContain("homecare_apply_financial_mutation");
  expect(migration).toContain("homecare_protect_issued_invoice");
  expect(migration).toContain("homecare_financial_audit");
  expect(migration).toContain("duplicate invoice numbers");
  expect(migration).toContain("invoice totals differ");
  expect(migration).toContain("payment totals differ");
});
