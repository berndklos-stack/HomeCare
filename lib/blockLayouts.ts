export type BlockLayouts = Record<string, string[]>;

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]{0,79}$/.exec(value)?.[0] === value;
}

// Scope und Eintraege sind ausschliesslich stabile UI-IDs, keine Fachdaten.
export function validateBlockLayout(scope: unknown, order: unknown): { scope: string; order: string[] } {
  if (!validId(scope) || !Array.isArray(order) || order.length > 64) {
    throw new Error('INVALID_BLOCK_LAYOUT');
  }
  const ids: string[] = [];
  for (const id of order) {
    if (!validId(id)) throw new Error('INVALID_BLOCK_LAYOUT');
    ids.push(id);
  }
  if (new Set(ids).size !== ids.length) throw new Error('INVALID_BLOCK_LAYOUT');
  return { scope, order: ids };
}

export function mergeVisibleBlockOrder(stored: string[] | undefined, visible: string[], next: string[]): string[] {
  const previous = validateBlockLayout('merge', stored ?? []).order;
  const shown = validateBlockLayout('merge', visible).order;
  const reordered = validateBlockLayout('merge', next).order;
  const visibleIds = new Set(shown);
  if (reordered.length !== shown.length || reordered.some((id) => !visibleIds.has(id))) {
    throw new Error('INVALID_BLOCK_LAYOUT');
  }
  const storedIds = new Set(previous);
  const slots = [...previous, ...shown.filter((id) => !storedIds.has(id))];
  let index = 0;
  const merged = slots.map((id) => visibleIds.has(id) ? reordered[index++] : id);
  return validateBlockLayout('merge', merged).order;
}
