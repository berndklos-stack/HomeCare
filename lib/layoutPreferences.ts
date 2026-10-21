export const navigationOrder = ['dashboard', 'objects', 'customers', 'jobs', 'planning', 'field', 'time', 'tracking', 'communication', 'billing', 'analytics', 'inventory', 'portal', 'masterData'] as const;
export const vehicleBlockOrder = ['standardTrips', 'documents', 'maintenance'] as const;
export type LayoutPreferences = { navigationOrder: string[]; vehicleBlockOrder: string[] };
export type LayoutPreferenceKey = keyof LayoutPreferences;
export const defaultLayoutPreferences = (): LayoutPreferences => ({ navigationOrder: [...navigationOrder], vehicleBlockOrder: [...vehicleBlockOrder] });
export function orderedIds(stored: unknown, allowed: readonly string[]): string[] {
  const values = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string' && allowed.includes(id)) : [];
  return [...new Set([...values, ...allowed])];
}
export function validateLayoutOrder(key: unknown, value: unknown): asserts value is string[] {
  const allowed = key === 'navigationOrder' ? navigationOrder : key === 'vehicleBlockOrder' ? vehicleBlockOrder : null;
  if (!allowed || !Array.isArray(value) || value.length !== allowed.length || new Set(value).size !== value.length || value.some((id) => typeof id !== 'string' || !(allowed as readonly string[]).includes(id))) throw new Error('INVALID_LAYOUT_ORDER');
}
export function moveLayoutItem(ids: string[], id: string, direction: -1 | 1) {
  const from = ids.indexOf(id), to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const result = [...ids];
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}
