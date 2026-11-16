export type CustomerServiceCondition = {
  id: string;
  serviceId: string;
  unitPrice: string;
  currency: string;
  revision?: number;
  updatedAt?: string;
};

export function validCustomerServiceCondition(value: { serviceId?: unknown; unitPrice?: unknown; currency?: unknown }) {
  if (typeof value.serviceId !== "string" || !value.serviceId.trim()) return false;
  if (value.unitPrice === "" && value.currency === "") return true;
  if (typeof value.unitPrice !== "string" || !/^\d+(?:[.,]\d{1,4})?$/.test(value.unitPrice)) return false;
  const price = Number(value.unitPrice.replace(",", "."));
  return Number.isFinite(price) && price >= 0 && price <= 100000000 && typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency);
}

export function customerServicePrice(service: { id: string; price: string; currency: string }, conditions: CustomerServiceCondition[] = []) {
  const condition = conditions.find((item) => item.serviceId === service.id);
  return condition && condition.unitPrice !== "" && validCustomerServiceCondition(condition)
    ? { price: condition.unitPrice, currency: condition.currency }
    : { price: service.price, currency: service.currency };
}

function priceKey(item: CustomerServiceCondition) {
  return JSON.stringify([item.serviceId, item.unitPrice === "" ? "" : Number(item.unitPrice.replace(",", ".")), item.currency]);
}

export function mergeCustomerConditionEdits(current: CustomerServiceCondition[], before: CustomerServiceCondition[], next: CustomerServiceCondition[]) {
  const merged = new Map(current.map(item => [item.id, item]));
  for (const old of before) {
    const changed = next.find(item => item.id === old.id);
    if (changed && priceKey(changed) === priceKey(old)) continue;
    const live = merged.get(old.id);
    if ((!live && changed) || (live && priceKey(live) !== priceKey(old))) throw new Error("Die Kundenkonditionen wurden zwischenzeitlich geändert. Bitte den Kunden erneut öffnen.");
    if (changed && live) merged.set(old.id, { ...changed, revision: live.revision });
    else merged.delete(old.id);
  }
  for (const added of next.filter(item => !before.some(old => old.id === item.id))) {
    if ([...merged.values()].some(item => item.serviceId === added.serviceId)) throw new Error("Diese Leistung wurde dem Kunden bereits zugeordnet. Bitte den Kunden erneut öffnen.");
    merged.set(added.id, added);
  }
  return [...merged.values()];
}
