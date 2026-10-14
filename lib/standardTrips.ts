export type StandardTrip = {
  id: string;
  label: string;
  startAddress: string;
  endAddress: string;
  purpose: string;
  tripType: 'Dienstfahrt' | 'Privatfahrt' | 'Arbeitsweg';
  visited: string;
  waypoints: { id: string; address: string; note: string; odometer?: string }[];
};

export function prepareStandardTrip(draft: StandardTrip, trips: StandardTrip[]): StandardTrip {
  const label = draft.label.trim();
  if (!label || !draft.startAddress.trim() || !draft.endAddress.trim()) throw new Error('required');
  if (trips.some((trip) => trip.id !== draft.id && trip.label.trim().toLocaleLowerCase() === label.toLocaleLowerCase())) throw new Error('duplicate');
  return {
    id: draft.id, label, startAddress: draft.startAddress.trim(), endAddress: draft.endAddress.trim(),
    purpose: draft.purpose.trim(), tripType: draft.tripType,
    visited: draft.tripType === 'Dienstfahrt' ? draft.visited.trim() : '',
    waypoints: draft.waypoints.filter((point) => point.address.trim()).map((point, index) => ({
      id: draft.id + '-WAY-' + (index + 1), address: point.address.trim(), note: point.note.trim(), odometer: '',
    })),
  };
}
