import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  overlayPendingCustomerMutations,
  prepareContactMutations,
  prepareCustomerMutations,
  primaryContactId,
  type RevisionedCustomer,
  type RevisionedCustomerContact,
} from "../lib/customerSync";
import { createSyncMutation } from "../lib/syncQueue";

function customer(overrides: Partial<RevisionedCustomer> = {}): RevisionedCustomer {
  return {
    contact: "Anna Contact",
    email: "anna@example.test",
    id: "CUSTOMER-1",
    name: "Customer One",
    objects: [],
    phone: "+46 1",
    phone2: "",
    ...overrides,
  };
}

function contact(overrides: Partial<RevisionedCustomerContact> = {}): RevisionedCustomerContact {
  return {
    customerId: "CUSTOMER-1",
    email: "anna@example.test",
    id: primaryContactId("CUSTOMER-1"),
    isPrimary: true,
    name: "Anna Contact",
    phone: "+46 1",
    phone2: "",
    ...overrides,
  };
}

test("Kunden werden datensatzweise erstellt, geändert, archiviert und gelöscht", () => {
  const created = prepareCustomerMutations([], [customer()], "2026-09-28T16:00:00.000Z");
  expect(created.mutations).toEqual(expect.arrayContaining([
    expect.objectContaining({ entityId: "CUSTOMER-1", entityType: "customer", operation: "create" }),
    expect.objectContaining({ entityType: "customer_contact", operation: "create", resourceId: "CUSTOMER-1" }),
  ]));
  expect(created.customers[0]).toMatchObject({ revision: 1 });

  const updated = prepareCustomerMutations(created.customers, [
    { ...created.customers[0], archived: true, name: "Customer One updated" },
  ], "2026-09-28T16:01:00.000Z");
  expect(updated.mutations).toContainEqual(expect.objectContaining({
    entityType: "customer",
    expectedRevision: 1,
    operation: "update",
  }));
  expect(updated.customers[0]).toMatchObject({ archived: true, revision: 2 });

  const deleted = prepareCustomerMutations(updated.customers, [], "2026-09-28T16:02:00.000Z");
  expect(deleted.mutations).toEqual([
    expect.objectContaining({ entityType: "customer", expectedRevision: 2, operation: "delete" }),
  ]);
});

test("abgeleitete Objektzuordnungen erzeugen keine Kundenmutation", () => {
  const current = customer({ contacts: [contact({ revision: 1 })], objects: ["OBJECT-1"], revision: 4 });
  const prepared = prepareCustomerMutations([current], [{ ...current, objects: ["OBJECT-2"] }]);
  expect(prepared.mutations).toEqual([]);
});

test("Ansprechpartner werden unabhängig erstellt, geändert und gelöscht", () => {
  const created = prepareContactMutations("CUSTOMER-1", [], [contact()]);
  expect(created.mutations).toEqual([expect.objectContaining({ entityType: "customer_contact", operation: "create" })]);
  const updated = prepareContactMutations("CUSTOMER-1", created.contacts, [
    { ...created.contacts[0], email: "new@example.test" },
  ]);
  expect(updated.mutations).toEqual([expect.objectContaining({ expectedRevision: 1, operation: "update" })]);
  const deleted = prepareContactMutations("CUSTOMER-1", updated.contacts, []);
  expect(deleted.mutations).toEqual([expect.objectContaining({ expectedRevision: 2, operation: "delete" })]);
});

test("Offline-Mutationen überlagern den Serverstand ohne Wiederauferstehung", () => {
  const server = customer({ contacts: [contact({ revision: 2 })], revision: 3 });
  const update = createSyncMutation({
    entityId: server.id,
    entityType: "customer",
    expectedRevision: 3,
    operation: "update",
    payload: { name: "Offline customer" },
    resourceId: server.id,
  });
  const contactDelete = createSyncMutation({
    entityId: primaryContactId(server.id),
    entityType: "customer_contact",
    expectedRevision: 2,
    operation: "delete",
    resourceId: server.id,
  });
  expect(overlayPendingCustomerMutations([server], [update, contactDelete])).toEqual([
    expect.objectContaining({ contact: "", contacts: [], name: "Offline customer", revision: 4 }),
  ]);

  const deletion = createSyncMutation({
    entityId: server.id,
    entityType: "customer",
    expectedRevision: 3,
    operation: "delete",
    resourceId: server.id,
  });
  expect(overlayPendingCustomerMutations([server], [deletion])).toEqual([]);
});

test("Legacy-Endpunkte können Kunden nicht mehr überschreiben", () => {
  const root = process.cwd();
  const sectionRoute = readFileSync(path.join(root, "app/api/sync-sections/route.ts"), "utf8");
  const appStateRoute = readFileSync(path.join(root, "app/api/app-state/route.ts"), "utf8");
  const syncRoute = readFileSync(path.join(root, "app/api/sync-mutations/route.ts"), "utf8");
  expect(sectionRoute).toContain('if ("customers" in filteredPatch)');
  expect(sectionRoute).toContain("LEGACY_CUSTOMER_READ_FALLBACK");
  expect(sectionRoute).not.toContain("saveCustomersSection");
  expect(appStateRoute).toContain("delete remaining.customers");
  expect(appStateRoute).toContain("result.customers = []");
  expect(sectionRoute).toContain("mergeLegacyCustomersWithoutResurrection");
  expect(syncRoute).toContain('membershipAllows(auth.membership, "customers.manage")');
  expect(syncRoute).toContain('"homecare_apply_customer_mutation"');
});

test("Portalzugriff bleibt kundengebunden und ignoriert Tombstones", () => {
  const root = process.cwd();
  const contextRoute = readFileSync(path.join(root, "app/api/portal/context/route.ts"), "utf8");
  const inviteRoute = readFileSync(path.join(root, "app/api/portal/invite/route.ts"), "utf8");
  expect(contextRoute).toContain('.from("homecare_customer_contacts")');
  expect(contextRoute).toContain('.eq("customer_id", customerId)');
  expect(contextRoute).toContain('.is("deleted_at", null)');
  expect(contextRoute).toContain("Kundenzugang ist nicht mehr aktiv");
  expect(inviteRoute).toContain('.is("deleted_at", null)');
});

test("Migration enthält Backfill, Revisionen, Tombstones und Abhängigkeitsschutz", () => {
  const migration = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260928160000_customer_contact_relational_cutover.sql"),
    "utf8",
  );
  expect(migration).toContain("homecare_customer_contacts");
  expect(migration).toContain("homecare_apply_customer_mutation");
  expect(migration).toContain("homecare_prevent_customer_hard_delete");
  expect(migration).toContain("Aktive abhängige Datensätze verhindern");
  expect(migration).toContain("on conflict (id) do nothing");
  expect(migration).toContain("owner_customer_id=p_entity_id");
  expect(migration).toContain("customer_id=p_entity_id");
});
