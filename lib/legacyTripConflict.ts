import type { SyncMutation } from "./syncQueue";

export function isLegacyTripValidationConflict(mutation: SyncMutation) {
  return mutation.entityType === "vehicle_trip" && mutation.operation === "create"
    && mutation.status === "conflict"
    && typeof mutation.payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(mutation.payload.date)
    && /^Start-Kilometerstand [0-9.]+ liegt unter dem Serverstand [0-9.]+\.$/.test(mutation.error ?? "");
}

export function overlappingLegacyTripConflict(mutation: SyncMutation, queue: SyncMutation[]) {
  if (!isLegacyTripValidationConflict(mutation)) return false;
  const start = Number(mutation.payload.startOdometer);
  const end = Number(mutation.payload.endOdometer);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return queue.some((other) => other.id !== mutation.id && isLegacyTripValidationConflict(other)
    && other.resourceId === mutation.resourceId && other.payload.date === mutation.payload.date
    && Number.isFinite(Number(other.payload.startOdometer)) && Number.isFinite(Number(other.payload.endOdometer))
    && start < Number(other.payload.endOdometer) && Number(other.payload.startOdometer) < end);
}
