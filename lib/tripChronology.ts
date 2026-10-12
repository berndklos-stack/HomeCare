export type ChronologicalTrip = {
  id: string;
  date?: string;
  startedAt?: string;
  resourceId?: string;
  startOdometer?: string;
  endOdometer?: string;
  status?: string;
  deletedAt?: string;
};

export function tripOdometerAfterAcknowledgement(current: { currentOdometer?: string; currentOdometerDate?: string }, record: Record<string, unknown>) {
  const end = record.end_odometer == null ? NaN : Number(record.end_odometer);
  const previous = current.currentOdometer?.trim() ? Number(current.currentOdometer) : NaN;
  const date = typeof record.trip_date === "string" ? record.trip_date : "";
  if (record.status !== "abgeschlossen" || record.deleted_at || !Number.isFinite(end) || !date
    || (Number.isFinite(previous) && end < previous) || (current.currentOdometerDate && date < current.currentOdometerDate)) {
    return { currentOdometer: current.currentOdometer, currentOdometerDate: current.currentOdometerDate };
  }
  return { currentOdometer: String(end), currentOdometerDate: date };
}

export function localTripDate(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function localTripTime(startedAt?: string) {
  const time = new Date(startedAt ?? "");
  return Number.isFinite(time.getTime()) ? `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}` : "";
}

export function tripStartAt(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return "";
  const value = new Date(`${date}T${time}:00`);
  return Number.isFinite(value.getTime()) ? value.toISOString() : "";
}

function tripDate(trip: ChronologicalTrip) {
  return trip.date || (trip.startedAt ? localTripDate(new Date(trip.startedAt)) : "");
}

export function compareTripChronology(first: ChronologicalTrip, second: ChronologicalTrip) {
  const dates = tripDate(first).localeCompare(tripDate(second));
  if (dates) return dates;
  // Older entries can contain their capture time rather than the journey date.
  const time = (trip: ChronologicalTrip) => trip.startedAt && localTripDate(new Date(trip.startedAt)) === tripDate(trip)
    ? Date.parse(trip.startedAt) : new Date(`${tripDate(trip)}T00:00:00`).getTime();
  const difference = time(first) - time(second);
  return (Number.isFinite(difference) ? difference : 0) || first.id.localeCompare(second.id);
}

export function tripNeighbors<T extends ChronologicalTrip>(trips: T[], candidate: ChronologicalTrip) {
  const relevant = trips.filter((trip) => !trip.deletedAt && trip.id !== candidate.id
    && (!candidate.resourceId || !trip.resourceId || trip.resourceId === candidate.resourceId))
    .sort(compareTripChronology);
  return {
    previous: relevant.filter((trip) => compareTripChronology(trip, candidate) < 0).at(-1),
    next: relevant.find((trip) => compareTripChronology(trip, candidate) > 0),
  };
}

function odometer(value?: string) {
  return value?.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
}

export function tripChronologyWarnings(trips: ChronologicalTrip[], candidate: ChronologicalTrip) {
  let { previous, next } = tripNeighbors(trips, candidate);
  const relevant = trips.filter((trip) => !trip.deletedAt && trip.id !== candidate.id
    && (!candidate.resourceId || !trip.resourceId || candidate.resourceId === trip.resourceId));
  const validTime = (trip: ChronologicalTrip) => Boolean(trip.startedAt
    && Number.isFinite(Date.parse(trip.startedAt)) && localTripDate(new Date(trip.startedAt)) === tripDate(trip));
  const startValue = odometer(candidate.startOdometer);
  if (startValue !== undefined && (!validTime(candidate)
    || relevant.some((trip) => tripDate(trip) === tripDate(candidate) && !validTime(trip)))) {
    previous = relevant.filter((trip) => tripDate(trip) < tripDate(candidate)
      || (tripDate(trip) === tripDate(candidate) && (odometer(trip.startOdometer) ?? Infinity) <= startValue))
      .sort((a, b) => (odometer(b.endOdometer) ?? -Infinity) - (odometer(a.endOdometer) ?? -Infinity))[0];
    next = relevant.filter((trip) => tripDate(trip) > tripDate(candidate)
      || (tripDate(trip) === tripDate(candidate) && (odometer(trip.startOdometer) ?? -Infinity) > startValue))
      .sort((a, b) => (odometer(a.startOdometer) ?? Infinity) - (odometer(b.startOdometer) ?? Infinity))[0];
  }
  const previousEnd = odometer(previous?.endOdometer);
  const start = odometer(candidate.startOdometer);
  const end = odometer(candidate.endOdometer);
  const nextStart = odometer(next?.startOdometer);
  const warnings: string[] = [];
  if (previousEnd !== undefined && start !== undefined && start < previousEnd) warnings.push(`Start-Kilometerstand liegt unter dem Endstand der vorherigen Fahrt (${previousEnd} km).`);
  if (nextStart !== undefined && end !== undefined && end > nextStart) warnings.push(`End-Kilometerstand liegt ueber dem Startstand der naechsten Fahrt (${nextStart} km).`);
  if (previousEnd !== undefined && start !== undefined && start > previousEnd) warnings.push(`Vor dieser Fahrt fehlen ${start - previousEnd} km.`);
  if (nextStart !== undefined && end !== undefined && end < nextStart) warnings.push(`Nach dieser Fahrt fehlen ${nextStart - end} km.`);
  return warnings;
}

export function tripMileageGaps<T extends ChronologicalTrip>(trips: T[]) {
  const ordered = trips.filter((trip) => !trip.deletedAt && trip.status !== "laufend").sort(compareTripChronology);
  const lastByVehicle = new Map<string, T>();
  return ordered.flatMap((next) => {
    const previous = lastByVehicle.get(next.resourceId ?? "");
    lastByVehicle.set(next.resourceId ?? "", next);
    if (!previous) return [];
    const end = odometer(previous.endOdometer);
    const start = odometer(next.startOdometer);
    return end !== undefined && start !== undefined && start > end ? [{ previous, next, kilometers: start - end }] : [];
  });
}
