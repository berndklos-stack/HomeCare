export type OperationsLanguage = "de" | "sv" | "en";
export type ResourceKind = "vehicle" | "machine" | "tool" | "equipment" | "trailer" | "other";
export type ResourceAvailability = "available" | "in_use" | "maintenance" | "repair" | "unavailable" | "archived";
export type PurchaseStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled";
export type MaintenanceStatus = "upcoming" | "due_soon" | "overdue" | "completed";

export type StockMovement = {
  id: string; materialId: string; quantity: number; sourceId: string | null; destinationId: string | null;
  occurredAt: string; actorId: string; jobId?: string; projectId?: string; note: string;
};
export type PurchaseLine = { id: string; quantity: number; receivedQuantity: number; unitPrice: number };
export type MaintenanceThresholds = {
  dueDate?: string | null; dueMileage?: number | null; dueHours?: number | null;
  intervalDays?: number | null; intervalMileage?: number | null; intervalHours?: number | null;
};

const finiteNonnegative = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field}: invalid quantity`);
};

export function validateStockMovement(movement: StockMovement) {
  if (!movement.id || !movement.materialId || !movement.actorId || !movement.note.trim()) throw new Error("Movement identity, actor and reason are required");
  if (!Number.isFinite(movement.quantity) || movement.quantity <= 0) throw new Error("Movement quantity must be positive");
  if ((!movement.sourceId && !movement.destinationId) || movement.sourceId === movement.destinationId) throw new Error("Movement locations must differ");
  if (!Number.isFinite(Date.parse(movement.occurredAt))) throw new Error("Invalid movement timestamp");
  return movement;
}

export function stockAt(movements: StockMovement[], materialId: string, locationId?: string) {
  const seen = new Map<string, string>();
  let quantity = 0;
  for (const movement of movements) {
    validateStockMovement(movement);
    const signature = JSON.stringify(movement);
    if (seen.has(movement.id)) {
      if (seen.get(movement.id) !== signature) throw new Error("Movement ID reused with different content");
      continue;
    }
    seen.set(movement.id, signature);
    if (movement.materialId !== materialId) continue;
    if (movement.destinationId && (!locationId || movement.destinationId === locationId)) quantity += movement.quantity;
    if (movement.sourceId && (!locationId || movement.sourceId === locationId)) quantity -= movement.quantity;
  }
  return Math.round(quantity * 1000) / 1000;
}

export function lowStock(quantity: number, minimum: number) {
  finiteNonnegative(minimum, "minimum");
  if (!Number.isFinite(quantity)) throw new Error("Invalid stock");
  return quantity < minimum;
}

export function purchaseStatus(current: PurchaseStatus, lines: PurchaseLine[]): PurchaseStatus {
  for (const line of lines) {
    finiteNonnegative(line.quantity, "ordered");
    finiteNonnegative(line.receivedQuantity, "received");
    finiteNonnegative(line.unitPrice, "price");
    if (line.quantity <= 0 || line.receivedQuantity > line.quantity) throw new Error("Invalid purchase line quantities");
  }
  if (current === "draft" || current === "cancelled") {
    if (lines.some((line) => line.receivedQuantity > 0)) throw new Error("Draft or cancelled order cannot contain receipts");
    return current;
  }
  if (!lines.length) throw new Error("Ordered purchase requires items");
  if (lines.every((line) => line.receivedQuantity === line.quantity)) return "received";
  return lines.some((line) => line.receivedQuantity > 0) ? "partially_received" : "ordered";
}

function dateValue(value: string) {
  const result = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== value) throw new Error("Invalid date");
  return result;
}

export function maintenanceStatus(plan: MaintenanceThresholds, readings: { date: string; mileage?: number; hours?: number }, completed = false): MaintenanceStatus {
  const today = dateValue(readings.date).getTime();
  if (completed) return "completed";
  const distances: number[] = [];
  if (plan.dueDate) distances.push((dateValue(plan.dueDate).getTime() - today) / 86400000);
  for (const [due, current, warning] of [[plan.dueMileage, readings.mileage, 500], [plan.dueHours, readings.hours, 10]] as const) {
    if (due != null) {
      finiteNonnegative(due, "due");
      if (current != null) {
        finiteNonnegative(current, "reading");
        distances.push((due - current) * 7 / warning);
      }
    }
  }
  if (distances.some((distance) => distance < 0)) return "overdue";
  if (distances.some((distance) => distance <= 7)) return "due_soon";
  return "upcoming";
}

export function nextMaintenance(plan: MaintenanceThresholds, completion: { date: string; mileage?: number; hours?: number }): MaintenanceThresholds {
  const date = dateValue(completion.date);
  const next: MaintenanceThresholds = { ...plan, dueDate: null, dueMileage: null, dueHours: null };
  if (plan.intervalDays != null) {
    if (!Number.isInteger(plan.intervalDays) || plan.intervalDays <= 0) throw new Error("Invalid date interval");
    date.setUTCDate(date.getUTCDate() + plan.intervalDays);
    next.dueDate = date.toISOString().slice(0, 10);
  }
  for (const [interval, reading, key] of [
    [plan.intervalMileage, completion.mileage, "dueMileage"], [plan.intervalHours, completion.hours, "dueHours"],
  ] as const) {
    if (interval != null) {
      if (!Number.isFinite(interval) || interval <= 0 || reading == null) throw new Error("Recurring meter maintenance requires a completion reading");
      finiteNonnegative(reading, "reading");
      next[key] = reading + interval;
    }
  }
  return next;
}

export const operationsLabels = {
  inventory: { de: "Material & Lager", sv: "Material och lager", en: "Materials & inventory" },
  purchasing: { de: "Lieferanten & Einkauf", sv: "Leverantörer och inköp", en: "Suppliers & purchasing" },
  resources: { de: "Ressourcen", sv: "Resurser", en: "Resources" },
  maintenance: { de: "Wartung & Prüfungen", sv: "Underhåll och besiktningar", en: "Maintenance & inspections" },
  draft: { de: "Entwurf", sv: "Utkast", en: "Draft" },
  ordered: { de: "Bestellt", sv: "Beställd", en: "Ordered" },
  partially_received: { de: "Teilweise erhalten", sv: "Delvis mottagen", en: "Partially received" },
  received: { de: "Erhalten", sv: "Mottagen", en: "Received" },
  cancelled: { de: "Storniert", sv: "Avbruten", en: "Cancelled" },
  upcoming: { de: "Anstehend", sv: "Kommande", en: "Upcoming" },
  due_soon: { de: "Bald fällig", sv: "Snart förfallen", en: "Due soon" },
  overdue: { de: "Überfällig", sv: "Förfallen", en: "Overdue" },
  completed: { de: "Erledigt", sv: "Slutförd", en: "Completed" },
} as const;
