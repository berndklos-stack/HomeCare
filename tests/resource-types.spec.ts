import { expect, test } from "@playwright/test";
import { defaultResourceTypes, missingResourceFields, resourceFieldCatalog, resourceIsVehicle, validateResourceType, visibleResourceFields } from "../lib/resourceTypes";
import { createSyncMutation, nextPendingMutation, normalizeSyncQueue } from "../lib/syncQueue";

test("Ressourcentypen sind frei benennbar; Mäher haben keine Fahrzeugfelder", () => {
  const mower = { ...defaultResourceTypes[2], name: "Eigener Aufsitzmäher" };
  expect(() => validateResourceType(mower)).not.toThrow();
  const fields = visibleResourceFields(mower).map((field) => field.key);
  expect(fields).toEqual(expect.arrayContaining(["operatingHours", "serialNumber", "maintenanceIntervalValue"]));
  expect(fields).not.toEqual(expect.arrayContaining(["licensePlate"]));
  expect(fields).not.toContain("taxCountry");
  expect(fields).not.toContain("logbookActive");
});

test("Konfiguration schützt Pflichtfelder, Katalog und Reihenfolge", () => {
  const type = structuredClone(defaultResourceTypes[2]);
  type.fields.find((field) => field.key === "serialNumber")!.order = 0;
  type.fields.find((field) => field.key === "name")!.order = 1;
  expect(visibleResourceFields(type)[0].key).toBe("serialNumber");
  type.fields.find((field) => field.key === "operatingHours")!.required = true;
  expect(missingResourceFields(type, { name: "Mower", operatingHours: 0 })).toEqual([]);
  expect(missingResourceFields(type, { name: "Mower" }).map((field) => field.key)).toEqual(["operatingHours"]);
  const duplicate = structuredClone(type);
  duplicate.fields[1] = duplicate.fields[0];
  expect(() => validateResourceType(duplicate)).toThrow();
  type.fields[0].enabled = false;
  expect(() => validateResourceType(type)).toThrow();
  expect(resourceFieldCatalog).toHaveLength(34);
});

test("Fahrzeugkompatibilität und dauerhafte Offline-Typmutation", () => {
  expect(resourceIsVehicle({ type: "Fahrzeug" })).toBe(true);
  expect(resourceIsVehicle({ type: "Sonderfahrzeug", resourceTypeCategory: "vehicle" })).toBe(true);
  expect(resourceIsVehicle({ type: "Maschine" })).toBe(false);
  const mutation = createSyncMutation({ entityType: "resource_type", entityId: defaultResourceTypes[2].id,
    resourceId: defaultResourceTypes[2].id, operation: "update", expectedRevision: 7, payload: { ...defaultResourceTypes[2] } });
  expect(normalizeSyncQueue(JSON.parse(JSON.stringify([mutation])))).toMatchObject([{ id: mutation.id, expectedRevision: 7, entityType: "resource_type" }]);
});

test("Offline-Typabhängigkeiten bleiben geschützt, andere Datensätze synchronisieren weiter", () => {
  const type = createSyncMutation({ entityType: "resource_type", entityId: defaultResourceTypes[2].id,
    resourceId: defaultResourceTypes[2].id, operation: "create", payload: { ...defaultResourceTypes[2] } });
  const resource = createSyncMutation({ entityType: "resource", entityId: "mower", resourceId: "mower", operation: "create", payload: { resourceTypeId: type.entityId } });
  const other = createSyncMutation({ entityType: "resource", entityId: "other", resourceId: "other", operation: "update", payload: {} });
  expect(nextPendingMutation([type, resource])).toBe(type);
  expect(nextPendingMutation([{ ...type, status: "failed" }, resource, other])).toBe(other);
  expect(nextPendingMutation([{ ...type, status: "synced" }, resource])).toBe(resource);
  const edit = { ...type, id: "next", operation: "update" as const, expectedRevision: 1 };
  expect(nextPendingMutation([{ ...type, status: "conflict" }, edit])).toBeUndefined();
});
