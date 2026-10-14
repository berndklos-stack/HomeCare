"use client";

import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { createStableId } from '@/lib/syncQueue';
import { prepareStandardTrip, type StandardTrip } from '@/lib/standardTrips';

const labels = {
  de: { title: 'Standardfahrten', add: 'Neue Standardfahrt anlegen', empty: 'Keine Standardfahrten', name: 'Bezeichnung der Standardfahrt', start: 'Startadresse', end: 'Zieladresse', purpose: 'Zweck / Anlass', visited: 'Name / besucht bei', type: 'Art der Fahrt', business: 'Dienstfahrt', private: 'Privatfahrt', commute: 'Arbeitsweg', waypoint: 'Zwischenstopp', note: 'Notiz', addWaypoint: 'Zwischenstopp hinzufügen', edit: 'Standardfahrt bearbeiten', remove: 'Standardfahrt löschen', removeWaypoint: 'Zwischenstopp entfernen', save: 'Standardfahrt speichern', cancel: 'Abbrechen', required: 'Bitte Namen, Startadresse und Zieladresse erfassen.', duplicate: 'Eine Standardfahrt mit diesem Namen ist bereits vorhanden.', confirm: 'Diese Standardfahrt wirklich löschen?' },
  sv: { title: 'Standardresor', add: 'Skapa ny standardresa', empty: 'Inga standardresor', name: 'Standardresans namn', start: 'Startadress', end: 'Måladress', purpose: 'Syfte / ärende', visited: 'Namn / besökt hos', type: 'Typ av resa', business: 'Tjänsteresa', private: 'Privatresa', commute: 'Arbetsresa', waypoint: 'Mellanstopp', note: 'Notering', addWaypoint: 'Lägg till mellanstopp', edit: 'Redigera standardresa', remove: 'Radera standardresa', removeWaypoint: 'Ta bort mellanstopp', save: 'Spara standardresa', cancel: 'Avbryt', required: 'Ange namn, startadress och måladress.', duplicate: 'Det finns redan en standardresa med detta namn.', confirm: 'Vill du radera standardresan?' },
  en: { title: 'Standard trips', add: 'Create standard trip', empty: 'No standard trips', name: 'Standard trip name', start: 'Start address', end: 'Destination address', purpose: 'Purpose', visited: 'Name / visited', type: 'Trip type', business: 'Business trip', private: 'Private trip', commute: 'Commute', waypoint: 'Stop', note: 'Note', addWaypoint: 'Add stop', edit: 'Edit standard trip', remove: 'Delete standard trip', removeWaypoint: 'Remove stop', save: 'Save standard trip', cancel: 'Cancel', required: 'Enter a name, start address and destination address.', duplicate: 'A standard trip with this name already exists.', confirm: 'Delete this standard trip?' },
};

export function StandardTripsEditor({ trips, language, onChange, onEditingChange }: {
  trips: StandardTrip[];
  language: 'de' | 'sv' | 'en';
  onChange: (trips: StandardTrip[]) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const t = labels[language];
  const [draft, setDraft] = useState<StandardTrip | null>(null);
  const [error, setError] = useState('');
  function edit(value: StandardTrip | null) {
    setDraft(value); setError(''); onEditingChange(Boolean(value));
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    try {
      const saved = prepareStandardTrip(draft, trips);
      onChange(trips.some((trip) => trip.id === saved.id) ? trips.map((trip) => trip.id === saved.id ? saved : trip) : [...trips, saved]);
      edit(null);
    } catch (problem) { setError(problem instanceof Error && problem.message === 'duplicate' ? t.duplicate : t.required); }
  }
  return <section className="wide resource-standard-trips" aria-label={t.title}>
    <div className="standard-trips-heading"><h3>{t.title}</h3>
      <button className="ghost-button create-button" disabled={Boolean(draft)} onClick={() => edit({ id: createStableId('STANDARD'), label: '', startAddress: '', endAddress: '', purpose: '', visited: '', tripType: 'Dienstfahrt', waypoints: [] })} type="button"><Plus size={16}/>{t.add}</button>
    </div>
    {trips.length ? <ul className="standard-trips-list">{trips.map((trip) => <li key={trip.id}>
      <div><strong>{trip.label}</strong><span>{trip.startAddress} → {trip.endAddress}</span></div>
      <div className="standard-trips-actions">
        <button className="icon-button" disabled={Boolean(draft)} aria-label={t.edit + ' ' + trip.label} title={t.edit} onClick={() => edit(structuredClone(trip))} type="button"><Pencil size={16}/></button>
        <button className="icon-button danger" disabled={Boolean(draft)} aria-label={t.remove + ' ' + trip.label} title={t.remove} onClick={() => { if (window.confirm(t.confirm)) onChange(trips.filter((item) => item.id !== trip.id)); }} type="button"><Trash2 size={16}/></button>
      </div>
    </li>)}</ul> : !draft && <p>{t.empty}</p>}
    {draft && <form className="standard-trip-editor" onSubmit={save} noValidate>
      <label><span>{t.name}</span><input autoFocus required value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })}/></label>
      <label><span>{t.type}</span><select value={draft.tripType} onChange={(event) => setDraft({ ...draft, tripType: event.target.value as StandardTrip['tripType'] })}>
        <option value="Dienstfahrt">{t.business}</option><option value="Privatfahrt">{t.private}</option><option value="Arbeitsweg">{t.commute}</option>
      </select></label>
      <label><span>{t.start}</span><input required value={draft.startAddress} onChange={(event) => setDraft({ ...draft, startAddress: event.target.value })}/></label>
      <label><span>{t.end}</span><input required value={draft.endAddress} onChange={(event) => setDraft({ ...draft, endAddress: event.target.value })}/></label>
      <label><span>{t.purpose}</span><input value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })}/></label>
      {draft.tripType === 'Dienstfahrt' && <label><span>{t.visited}</span><input value={draft.visited} onChange={(event) => setDraft({ ...draft, visited: event.target.value })}/></label>}
      {draft.waypoints.map((point, index) => <div className="standard-trip-waypoint" key={point.id}>
        <label><span>{t.waypoint + ' ' + (index + 1)}</span><input value={point.address} onChange={(event) => setDraft({ ...draft, waypoints: draft.waypoints.map((item) => item.id === point.id ? { ...item, address: event.target.value } : item) })}/></label>
        <label><span>{t.note + ' ' + (index + 1)}</span><input value={point.note} onChange={(event) => setDraft({ ...draft, waypoints: draft.waypoints.map((item) => item.id === point.id ? { ...item, note: event.target.value } : item) })}/></label>
        <button className="icon-button danger" aria-label={t.removeWaypoint + ' ' + (index + 1)} title={t.removeWaypoint} onClick={() => setDraft({ ...draft, waypoints: draft.waypoints.filter((item) => item.id !== point.id) })} type="button"><Trash2 size={16}/></button>
      </div>)}
      <button className="ghost-button standard-trip-add-stop" onClick={() => setDraft({ ...draft, waypoints: [...draft.waypoints, { id: createStableId('WAY'), address: '', note: '' }] })} type="button"><Plus size={16}/>{t.addWaypoint}</button>
      {error && <p className="standard-trip-error" role="alert">{error}</p>}
      <div className="standard-trip-editor-actions"><button className="ghost-button" onClick={() => edit(null)} type="button"><X size={16}/>{t.cancel}</button><button className="ghost-button" type="submit"><Check size={16}/>{t.save}</button></div>
    </form>}
  </section>;
}
