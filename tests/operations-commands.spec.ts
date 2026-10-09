import { test, expect } from "@playwright/test";
import { requiredOperationsPermission, validateOperationsMutation } from "../lib/operationsCommands";
import { createSyncMutation, normalizeSyncQueue, persistSyncMutationBatch, readSyncQueue } from "../lib/syncQueue";
import { prepareMasterDataMutations } from "../lib/masterDataSync";

test("Auch das Archivieren von Wartungsplänen erfordert Ressourcenrechte", () => {
  expect(requiredOperationsPermission({ kind: "archive", entity: "maintenance_plans" }, true)).toBe("resources.manage");
  expect(requiredOperationsPermission({ kind: "archive", entity: "suppliers" }, true)).toBe("data.write");
  expect(requiredOperationsPermission({ kind: "start", resource_revision: 1 }, true)).toBe("resources.manage");
  const stock = { kind: "stock" as const, material_id: "material", source_id: "warehouse", destination_id: null, quantity: 1, note: "Issue", job_id: "job" };
  expect(requiredOperationsPermission(stock, false)).toBe("jobs.manage");
  expect(requiredOperationsPermission(stock, true)).toBe("data.write");
});

test("Operations nutzen dieselbe dauerhafte Queue und behalten stabile Identitäten beim Reload", () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, v); } };
  const command = createSyncMutation({ entityType: "operations", entityId: "11111111-1111-4111-8111-111111111111", resourceId: "supplier",
    operation: "create", payload: { kind: "save", entity: "suppliers", values: { supplier_number: "S-1", company: "Supplier" } } });
  expect(validateOperationsMutation(command).kind).toBe("save");
  persistSyncMutationBatch(storage, [], [command]);
  expect(readSyncQueue(storage)).toEqual([command]);
  expect(normalizeSyncQueue([{ ...command, status: "syncing" }])[0]).toMatchObject({ id: command.id, status: "pending" });
  expect(persistSyncMutationBatch(storage, [command], [command])).toHaveLength(1);
});

test("Tenant, Benutzer, Revision und Fahrzeugkilometer sind keine editierbaren Operations-Felder", () => {
  const valid = createSyncMutation({ entityType: "operations", entityId: "resource", resourceId: "resource", operation: "update", expectedRevision: 1,
    payload: { kind: "save", entity: "resource_details", values: { equipment_kind: "tool", operating_hours: 100 } } });
  expect(() => validateOperationsMutation(valid)).not.toThrow();
  for (const key of ["tenant_id", "actor_user_id", "revision", "current_odometer", "logbook", "status"]) {
    expect(() => validateOperationsMutation({ ...valid, payload: { ...valid.payload, values: { [key]: "unsafe" } } })).toThrow();
  }
  expect(() => validateOperationsMutation({ ...valid, expectedRevision: undefined })).toThrow();
  expect(() => validateOperationsMutation({ ...valid, payload: { ...valid.payload, tenant_id: "foreign" } })).toThrow();
});

test("Ungültige Mengen, Datumswerte und fremde Befehle werden vor dem RPC abgewiesen", () => {
  const base = createSyncMutation({ entityType: "operations", entityId: "event", resourceId: "material", operation: "create",
    payload: { kind: "stock", material_id: "material", source_id: null, destination_id: "warehouse", quantity: 1, note: "Receipt" } });
  expect(() => validateOperationsMutation(base)).not.toThrow();
  for (const patch of [{ quantity: NaN }, { quantity: Infinity }, { quantity: 0 }, { source_id: "warehouse" }, { note: "" }, { actor_user_id: "foreign" }]) {
    expect(() => validateOperationsMutation({ ...base, payload: { ...base.payload, ...patch } })).toThrow();
  }
  expect(() => validateOperationsMutation({ ...base, payload: { kind: "sql", values: "drop table" } })).toThrow();
});

test("Berechnete Lagerbestände werden niemals als Stammdatenmutation zurückgeschrieben", () => {
  const material = { id: "MAT-1", name: "Material", revision: 1, stockTotal: 7, stockByLocation: { warehouse: 7 } };
  expect(prepareMasterDataMutations("material", [material], [{ ...material, stockTotal: 8 }]).mutations).toEqual([]);
  const changed = prepareMasterDataMutations("material", [material], [{ ...material, name: "Updated" }]);
  expect(changed.mutations[0].payload).toEqual({ id: "MAT-1", name: "Updated" });
});

test("Sammel-Wareneingang validiert eindeutige Positionen, Lagerort und Mengen", () => {
  const item = { item_id: "22222222-2222-4222-8222-222222222222", quantity: 2.5 };
  const mutation = createSyncMutation({ entityType: "operations", entityId: "11111111-1111-4111-8111-111111111111", resourceId: "order", operation: "update", expectedRevision: 4,
    payload: { kind: "receive_batch", location_id: "warehouse", document_id: null, note: "Delivery", items: [item] } });
  expect(validateOperationsMutation(mutation).kind).toBe("receive_batch");
  for (const patch of [{ items: [] }, { items: [item, item] }, { location_id: "" }, { items: [{ ...item, quantity: 0 }] },
    { items: [{ ...item, quantity: Infinity }] }, { items: [{ ...item, quantity: 0.0001 }] }, { tenant_id: "foreign" }]) {
    expect(() => validateOperationsMutation({ ...mutation, payload: { ...mutation.payload, ...patch } })).toThrow();
  }
});
