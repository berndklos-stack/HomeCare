import { billingDraftLineNet, draftNumber } from "./billingDraft";

export type ConsultingTravel = { travelKilometers?: string; travelRate?: string };

export function consultingTravelValid(value: ConsultingTravel) {
  const km = value.travelKilometers?.trim() || "";
  const rate = value.travelRate?.trim() || "";
  if (!km && !rate) return true;
  return /^\d+(?:[.,]\d{1,3})?$/.test(km) && /^\d+(?:[.,]\d{1,4})?$/.test(rate)
    && draftNumber(km) > 0 && draftNumber(km) <= 1000000 && draftNumber(rate) <= 1000000;
}

export function consultingTravelAmount(value: ConsultingTravel) {
  if (!value.travelKilometers || !consultingTravelValid(value)) return 0;
  return billingDraftLineNet({ id: "travel", kind: "Leistung", name: "Fahrtkosten", quantity: value.travelKilometers,
    unit: "km", unitPrice: value.travelRate || "0", currency: "SEK", taxRate: "0" });
}

export function consultingTravelTotal(entries: ConsultingTravel[]) {
  return entries.reduce((cents, entry) => cents + Math.round(consultingTravelAmount(entry) * 100), 0) / 100;
}
