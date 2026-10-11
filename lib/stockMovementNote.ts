const pickingNote = /^(Kommissionierung(?: verladen)?) ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function pickingIdFromMovementNote(note: unknown): string | null {
  return String(note ?? "").match(pickingNote)?.[2].toLowerCase() ?? null;
}

export function stockMovementNote(note: unknown, pickingCode?: string | null): string {
  const text = String(note ?? "");
  const picking = text.match(pickingNote);
  if (picking) return `${picking[1]}${pickingCode ? ` · ${pickingCode}` : ""}`;
  return text.replace(/^(Inventur|Korrekturbuchung|Korrigeringsbokning|Correction booking) \[[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]:\s*/i, "$1 · ");
}
