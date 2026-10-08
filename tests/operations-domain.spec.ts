import { test, expect } from "@playwright/test";
import { stockAt, validateStockMovement, lowStock, purchaseStatus, maintenanceStatus, nextMaintenance, operationsLabels, type StockMovement } from "../lib/operations";

const movement = (id: string, sourceId: string | null, destinationId: string | null, quantity: number): StockMovement => ({
  id, sourceId, destinationId, quantity, materialId: "material", actorId: "actor", note: "Test booking", occurredAt: "2026-10-07T12:00:00Z",
});

test("Eingang, Verbrauch, Rückgabe und Umlagerung haben nachvollziehbare Standortbestände", () => {
  const receipt = movement("receipt", null, "warehouse", 10);
  const transfer = movement("transfer", "warehouse", "vehicle", 3);
  const issue = movement("issue", "vehicle", null, 2);
  const returned = movement("return", null, "vehicle", 1);
  const ledger = [receipt, transfer, issue, returned];
  expect(stockAt(ledger, "material")).toBe(9);
  expect(stockAt(ledger, "material", "warehouse")).toBe(7);
  expect(stockAt(ledger, "material", "vehicle")).toBe(2);
  expect(stockAt([...ledger, receipt], "material")).toBe(9);
  expect(() => stockAt([...ledger, { ...receipt, quantity: 11 }], "material")).toThrow("ID reused");
  expect(lowStock(2, 3)).toBe(true);
  expect(lowStock(3, 3)).toBe(false);
});

test("Buchungen ohne Menge, Benutzer, Grund oder gültige Standorte werden abgewiesen", () => {
  const valid = movement("id", null, "warehouse", 1);
  for (const patch of [{ quantity: 0 }, { quantity: -1 }, { quantity: NaN }, { quantity: Infinity },
    { actorId: "" }, { note: " " }, { destinationId: null }, { sourceId: "warehouse" }, { occurredAt: "invalid" }]) {
    expect(() => validateStockMovement({ ...valid, ...patch })).toThrow();
  }
  expect(stockAt([movement("a", null, "warehouse", 0.1), movement("b", null, "warehouse", 0.2)], "material")).toBe(0.3);
});

test("Bestellstatus berücksichtigt alle Positionen und schützt Entwürfe sowie Überlieferung", () => {
  const line = { id: "line", quantity: 10, receivedQuantity: 0, unitPrice: 12.5 };
  expect(purchaseStatus("draft", [line])).toBe("draft");
  expect(purchaseStatus("ordered", [line])).toBe("ordered");
  expect(purchaseStatus("ordered", [{ ...line, receivedQuantity: 4 }])).toBe("partially_received");
  expect(purchaseStatus("partially_received", [{ ...line, receivedQuantity: 10 }])).toBe("received");
  expect(purchaseStatus("received", [{ ...line, receivedQuantity: 10 }, { ...line, id: "other", receivedQuantity: 0 }])).toBe("partially_received");
  expect(() => purchaseStatus("ordered", [{ ...line, receivedQuantity: 11 }])).toThrow();
  expect(() => purchaseStatus("cancelled", [{ ...line, receivedQuantity: 1 }])).toThrow();
  expect(() => purchaseStatus("ordered", [])).toThrow();
});

test("Wartungswarnung nutzt Datum, Kilometer und Betriebsstunden ohne fehlende Werte zu erfinden", () => {
  const reading = { date: "2026-10-07", mileage: 10000, hours: 100 };
  expect(maintenanceStatus({ dueDate: "2026-10-06" }, reading)).toBe("overdue");
  expect(maintenanceStatus({ dueDate: "2026-10-14" }, reading)).toBe("due_soon");
  expect(maintenanceStatus({ dueDate: "2026-11-01" }, reading)).toBe("upcoming");
  expect(maintenanceStatus({ dueMileage: 9999 }, reading)).toBe("overdue");
  expect(maintenanceStatus({ dueHours: 110 }, reading)).toBe("due_soon");
  expect(maintenanceStatus({ dueMileage: 9999 }, { date: reading.date })).toBe("upcoming");
  expect(maintenanceStatus({ dueDate: "2026-10-06" }, reading, true)).toBe("completed");
});

test("Wartungsabschluss berechnet Folgewerte ab Abschluss und lässt Einmalgrenzen nicht wieder aufleben", () => {
  expect(nextMaintenance({ dueDate: "2026-10-01", intervalDays: 30, intervalMileage: 5000, intervalHours: 100 },
    { date: "2026-10-07", mileage: 10100, hours: 110 })).toMatchObject({ dueDate: "2026-11-06", dueMileage: 15100, dueHours: 210 });
  expect(nextMaintenance({ intervalDays: 1 }, { date: "2028-02-28" }).dueDate).toBe("2028-02-29");
  expect(nextMaintenance({ dueDate: "2026-10-01", intervalMileage: 5000 }, { date: "2026-10-07", mileage: 10000 }).dueDate).toBeNull();
  expect(() => nextMaintenance({ intervalMileage: 5000 }, { date: "2026-10-07" })).toThrow("reading");
  expect(() => nextMaintenance({ intervalDays: 0 }, { date: "2026-10-07" })).toThrow();
  expect(() => nextMaintenance({}, { date: "2026-02-30" })).toThrow();
});

test("neue Modul- und Statusbegriffe sind in DE, SV und EN vorhanden", () => {
  for (const row of Object.values(operationsLabels)) for (const language of ["de", "sv", "en"] as const) expect(row[language].length).toBeGreaterThan(0);
});
