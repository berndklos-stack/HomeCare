import { expect, test } from "@playwright/test";
import { customerServicePrice, mergeCustomerConditionEdits, validCustomerServiceCondition } from "../lib/customerServiceConditions";
import { prepareCustomerMutations, overlayPendingCustomerMutations } from "../lib/customerSync";
import { createSyncMutation, nextPendingMutation, readSyncQueue, syncQueueStorageKey } from "../lib/syncQueue";

test("Kundenpreise, Nullpreis und Stammdatenvorgabe", () => {
  const service = { id: "S1", price: "450", currency: "SEK" };
  expect(customerServicePrice(service)).toEqual({ price: "450", currency: "SEK" });
  expect(customerServicePrice(service, [{ id: "X", serviceId: "S1", unitPrice: "0", currency: "SEK" }])).toEqual({ price: "0", currency: "SEK" });
  expect(customerServicePrice(service, [{ id: "X", serviceId: "S1", unitPrice: "396,125", currency: "EUR" }])).toEqual({ price: "396,125", currency: "EUR" });
  for (const unitPrice of ["-1", "NaN", "1e3", "1.23456", "100000001"]) expect(validCustomerServiceCondition({ serviceId: "S1", unitPrice, currency: "SEK" })).toBe(false);
  expect(validCustomerServiceCondition({ serviceId: "S1", unitPrice: "", currency: "SEK" })).toBe(false);
});

test("Konditionen werden separat versioniert und offline wiederhergestellt", () => {
  const customer = { id: "C", contact: "Kontakt", email: "test@example.invalid", phone: "", serviceConditions: [] };
  const next = { ...customer, serviceConditions: [{ id: "CSC", serviceId: "S", unitPrice: "400", currency: "SEK" }] };
  const plan = prepareCustomerMutations([customer], [next]);
  const mutation = plan.mutations.find(item => item.entityType === "customer_service_condition")!;
  expect(mutation).toMatchObject({ entityId: "CSC", operation: "create", resourceId: "C", payload: { unitPrice: "400", currency: "SEK", serviceId: "S" } });
  expect(plan.mutations.filter(item => item.entityType === "customer")).toHaveLength(0);
  const queue = [createSyncMutation(mutation)];
  expect(overlayPendingCustomerMutations([customer], queue)[0].serviceConditions).toMatchObject([{ unitPrice: "400", revision: 1 }]);
  expect(readSyncQueue({ getItem: key => key === syncQueueStorageKey ? JSON.stringify(queue) : null, setItem: () => {} })).toHaveLength(1);
  const deletion = prepareCustomerMutations(plan.customers, [customer]).mutations.find(item => item.entityType === "customer_service_condition")!;
  expect(deletion).toMatchObject({ operation: "delete", expectedRevision: 1 });
});

test("Neue Zuordnung wartet auf Kunden- und Leistungsanlage", () => {
  const service = createSyncMutation({ entityId: "S", entityType: "service", operation: "create", resourceId: "S", payload: {} });
  const customer = createSyncMutation({ entityId: "C", entityType: "customer", operation: "create", resourceId: "C", payload: {} });
  const condition = createSyncMutation({ entityId: "CSC", entityType: "customer_service_condition", operation: "create", resourceId: "C", payload: { serviceId: "S" } });
  expect(nextPendingMutation([{ ...service, status: "failed" }, { ...customer, status: "synced" }, condition])).toBeUndefined();
  expect(nextPendingMutation([{ ...service, status: "synced" }, { ...customer, status: "failed" }, condition])).toBeUndefined();
  expect(nextPendingMutation([{ ...service, status: "synced" }, { ...customer, status: "synced" }, condition])?.id).toBe(condition.id);
});

test("Komma und native Dezimalstellen erzeugen keine wiederholten Preisänderungen", () => {
  const customer = { id: "C", contact: "Kontakt", email: "test@example.invalid", phone: "", serviceConditions: [{ id: "CSC", serviceId: "S", unitPrice: "396.1250", currency: "SEK", revision: 4 }] };
  const next = { ...customer, serviceConditions: [{ ...customer.serviceConditions[0], unitPrice: "396,125" }] };
  expect(prepareCustomerMutations([customer], [next]).mutations.filter(item => item.entityType === "customer_service_condition")).toHaveLength(0);
});

test("Andere Kundenfelder und unveränderte Konditionen überschreiben keine neueren Preise", () => {
  const before = [{ id: "A", serviceId: "S1", unitPrice: "400", currency: "SEK", revision: 1 }, { id: "B", serviceId: "S2", unitPrice: "300", currency: "SEK", revision: 1 }];
  const current = [{ ...before[0], unitPrice: "450", revision: 2 }, before[1]];
  const next = [before[0], { ...before[1], unitPrice: "250" }];
  expect(mergeCustomerConditionEdits(current, before, next)).toMatchObject([{ id: "A", unitPrice: "450" }, { id: "B", unitPrice: "250" }]);
  expect(() => mergeCustomerConditionEdits(current, before, [{ ...before[0], unitPrice: "500" }, before[1]])).toThrow("zwischenzeitlich");
  expect(() => mergeCustomerConditionEdits(current, before, [before[1]])).toThrow("zwischenzeitlich");
});
