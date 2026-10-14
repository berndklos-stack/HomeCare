export type StandardTrip = {
  id: string;
  label: string;
  startAddress: string;
  endAddress: string;
  purpose: string;
  tripType: 'Dienstfahrt' | 'Privatfahrt' | 'Arbeitsweg';
  visited: string;
  distanceKm?: number | null;
  waypoints: { id: string; address: string; note: string; odometer?: string }[];
};

export type DrivenTrip = {
  id: string; date: string; startAddress: string; endAddress: string; purpose: string;
  tripType: StandardTrip['tripType']; visited: string; kilometers: string;
  startOdometer: string; endOdometer: string; status?: string;
  waypoints?: StandardTrip['waypoints'];
};

export function projectStandardTripDistances(trips: unknown, distances: { standard_trip_id: string; distance_km: number | null }[] = []) {
  if (!Array.isArray(trips)) return [];
  const byId = new Map(distances.map((distance) => [distance.standard_trip_id, distance.distance_km]));
  return trips.filter((trip) => trip && typeof trip === 'object' && typeof trip.id === 'string').map((trip) => ({
    ...trip, distanceKm: byId.get(trip.id) == null ? null : Number(byId.get(trip.id)),
  }));
}

export function standardTripFromDrive(trip: DrivenTrip, id: string): StandardTrip {
  let distanceKm: number | null = null;
  try { distanceKm = parseStandardTripDistance(trip.kilometers); } catch { /* Fall back to the recorded odometer difference. */ }
  if (distanceKm == null && trip.startOdometer.trim() && trip.endOdometer.trim()) {
    const difference = Number(trip.endOdometer.replace(',', '.')) - Number(trip.startOdometer.replace(',', '.'));
    try { distanceKm = parseStandardTripDistance(String(Math.round(difference * 1000) / 1000)); } catch { /* Invalid historic readings are not copied. */ }
  }
  return prepareStandardTrip({
    id, label: trip.purpose.trim() || trip.startAddress + ' → ' + trip.endAddress,
    startAddress: trip.startAddress, endAddress: trip.endAddress, purpose: trip.purpose,
    tripType: trip.tripType, visited: trip.visited, waypoints: trip.waypoints ?? [], distanceKm,
  }, []);
}

export function parseStandardTripDistance(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) throw new Error('distance');
  const distance = Number(normalized);
  if (!Number.isFinite(distance) || distance <= 0 || distance > 999999.999) throw new Error('distance');
  return distance;
}

export function standardTripOdometers(start: string, distance?: number | null) {
  const normalized = start.trim().replace(',', '.');
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized) || !Number.isFinite(Number(normalized)) || distance == null || !Number.isFinite(distance) || distance <= 0) {
    return { endOdometer: '', kilometers: '' };
  }
  return { endOdometer: String(Math.round((Number(normalized) + distance) * 1000) / 1000), kilometers: String(distance) };
}

export function prepareStandardTrip(draft: StandardTrip, trips: StandardTrip[]): StandardTrip {
  const label = draft.label.trim();
  if (!label || !draft.startAddress.trim() || !draft.endAddress.trim()) throw new Error('required');
  if (trips.some((trip) => trip.id !== draft.id && trip.label.trim().toLocaleLowerCase() === label.toLocaleLowerCase())) throw new Error('duplicate');
  if (draft.distanceKm != null) parseStandardTripDistance(String(draft.distanceKm));
  return {
    id: draft.id, label, startAddress: draft.startAddress.trim(), endAddress: draft.endAddress.trim(),
    purpose: draft.purpose.trim(), tripType: draft.tripType,
    visited: draft.tripType === 'Dienstfahrt' ? draft.visited.trim() : '',
    ...(draft.distanceKm !== undefined ? { distanceKm: draft.distanceKm } : {}),
    waypoints: draft.waypoints.filter((point) => point.address.trim()).map((point, index) => ({
      id: draft.id + '-WAY-' + (index + 1), address: point.address.trim(), note: point.note.trim(), odometer: '',
    })),
  };
}
