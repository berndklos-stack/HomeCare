import type { SyncMutation, SyncMutationResult } from "@/lib/syncQueue";

export type VersionedVehicleTrip = {
  deletedAt?: string;
  endOdometer?: string;
  endedAt?: string;
  id: string;
  resourceId: string;
  revision: number;
  startOdometer?: string;
  startedAt?: string;
  status: "laufend" | "abgeschlossen";
  updatedAt?: string;
};

export type VersionedMedia = {
  deletedAt?: string;
  id: string;
  revision: number;
};

export type VehicleMutationState = {
  media: VersionedMedia[];
  mutationResults: Record<string, SyncMutationResult>;
  trips: VersionedVehicleTrip[];
};

export function reconcileAuthoritativeTrips(
  serverTrips: VersionedVehicleTrip[],
  cachedTrips: VersionedVehicleTrip[],
  pendingEntityIds: Iterable<string> = [],
) {
  const pending = new Set(pendingEntityIds);
  const cachedById = new Map(cachedTrips.map((trip) => [trip.id, trip]));
  const reconciled = serverTrips.filter((trip) => !trip.deletedAt).map((serverTrip) => {
    const cached = cachedById.get(serverTrip.id);
    if (!cached || !pending.has(serverTrip.id)) return serverTrip;
    return cached.revision > serverTrip.revision ? cached : serverTrip;
  });
  const known = new Set(serverTrips.map((trip) => trip.id));
  cachedTrips.forEach((trip) => {
    if (!known.has(trip.id) && pending.has(trip.id) && !trip.deletedAt) reconciled.push(trip);
  });
  return reconciled;
}

export function reconcileAuthoritativeMedia(
  serverMedia: VersionedMedia[],
  cachedMedia: VersionedMedia[],
  pendingEntityIds: Iterable<string> = [],
) {
  const pending = new Set(pendingEntityIds);
  const serverById = new Map(serverMedia.map((item) => [item.id, item]));
  const visible = serverMedia.filter((item) => !item.deletedAt);
  cachedMedia.forEach((item) => {
    if (!serverById.has(item.id) && pending.has(item.id) && !item.deletedAt) visible.push(item);
  });
  return visible;
}

export function latestAuthoritativeOdometer(trips: VersionedVehicleTrip[], vehicleOdometer = "") {
  const completed = trips
    .filter((trip) => trip.status === "abgeschlossen" && !trip.deletedAt && String(trip.endOdometer ?? "").trim())
    .sort((first, second) => {
      const firstTime = first.endedAt ?? first.updatedAt ?? "";
      const secondTime = second.endedAt ?? second.updatedAt ?? "";
      return secondTime.localeCompare(firstTime);
    });
  return completed[0]?.endOdometer ?? vehicleOdometer;
}

function result(mutation: SyncMutation, status: SyncMutationResult["status"], record?: VersionedVehicleTrip | VersionedMedia, error?: string) {
  return {
    error,
    mutationId: mutation.id,
    record: record as unknown as Record<string, unknown> | undefined,
    status,
  } satisfies SyncMutationResult;
}

export function applyVehicleMutation(state: VehicleMutationState, mutation: SyncMutation): VehicleMutationState {
  const previousResult = state.mutationResults[mutation.id];
  if (previousResult) return state;

  if (mutation.entityType === "vehicle_media") {
    const media = state.media.find((item) => item.id === mutation.entityId);
    if (!media || (mutation.expectedRevision !== undefined && media.revision !== mutation.expectedRevision)) {
      const conflict = result(mutation, "conflict", media, "Medium wurde parallel geändert oder gelöscht.");
      return { ...state, mutationResults: { ...state.mutationResults, [mutation.id]: conflict } };
    }
    const updated = { ...media, deletedAt: mutation.operation === "delete" ? mutation.updatedAt : undefined, revision: media.revision + 1 };
    return {
      ...state,
      media: state.media.map((item) => item.id === updated.id ? updated : item),
      mutationResults: { ...state.mutationResults, [mutation.id]: result(mutation, "synced", updated) },
    };
  }

  const existing = state.trips.find((trip) => trip.id === mutation.entityId);
  if (mutation.operation === "create") {
    if (existing) {
      return { ...state, mutationResults: { ...state.mutationResults, [mutation.id]: result(mutation, "synced", existing) } };
    }
    const status = mutation.payload.status === "abgeschlossen" ? "abgeschlossen" : "laufend";
    const active = state.trips.find((trip) => trip.resourceId === mutation.resourceId && trip.status === "laufend" && !trip.deletedAt);
    if (status === "laufend" && active) {
      const conflict = result(mutation, "conflict", active, "Für dieses Fahrzeug läuft bereits eine Fahrt.");
      return { ...state, mutationResults: { ...state.mutationResults, [mutation.id]: conflict } };
    }
    const authoritativeOdometer = Number(latestAuthoritativeOdometer(state.trips.filter((trip) => trip.resourceId === mutation.resourceId)) || 0);
    const startOdometer = Number(mutation.payload.startOdometer ?? 0);
    if (startOdometer < authoritativeOdometer && mutation.payload.allowOdometerCorrection !== true) {
      const conflict = result(mutation, "conflict", undefined, "Kilometerstand liegt unter dem Serverstand.");
      return { ...state, mutationResults: { ...state.mutationResults, [mutation.id]: conflict } };
    }
    const created: VersionedVehicleTrip = {
      endOdometer: String(mutation.payload.endOdometer ?? ""),
      endedAt: String(mutation.payload.endedAt ?? "") || undefined,
      id: mutation.entityId,
      resourceId: mutation.resourceId,
      revision: 1,
      startOdometer: String(mutation.payload.startOdometer ?? ""),
      startedAt: String(mutation.payload.startedAt ?? mutation.createdAt),
      status,
      updatedAt: mutation.updatedAt,
    };
    return {
      ...state,
      trips: [...state.trips, created],
      mutationResults: { ...state.mutationResults, [mutation.id]: result(mutation, "synced", created) },
    };
  }

  if (!existing || (mutation.expectedRevision !== undefined && existing.revision !== mutation.expectedRevision)) {
    const conflict = result(mutation, "conflict", existing, "Fahrt wurde parallel geändert oder gelöscht.");
    return { ...state, mutationResults: { ...state.mutationResults, [mutation.id]: conflict } };
  }

  const updated: VersionedVehicleTrip = mutation.operation === "delete"
    ? { ...existing, deletedAt: mutation.updatedAt, revision: existing.revision + 1, updatedAt: mutation.updatedAt }
    : {
        ...existing,
        endOdometer: String(mutation.payload.endOdometer ?? existing.endOdometer ?? ""),
        endedAt: String(mutation.payload.endedAt ?? existing.endedAt ?? "") || undefined,
        revision: existing.revision + 1,
        status: mutation.payload.status === "abgeschlossen" ? "abgeschlossen" : existing.status,
        updatedAt: mutation.updatedAt,
      };
  return {
    ...state,
    trips: state.trips.map((trip) => trip.id === updated.id ? updated : trip),
    mutationResults: { ...state.mutationResults, [mutation.id]: result(mutation, "synced", updated) },
  };
}
