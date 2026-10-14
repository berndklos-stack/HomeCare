"use client";
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { defaultLayoutPreferences, navigationOrder, orderedIds, validateLayoutOrder, vehicleBlockOrder, type LayoutPreferenceKey, type LayoutPreferences } from '@/lib/layoutPreferences';

export function useLayoutPreferences(enabled = true) {
  const [preferences, setPreferences] = useState(defaultLayoutPreferences);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setReady(false);
    void apiFetch('/api/layout-preferences', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('LAYOUT_UNAVAILABLE');
      const { preferences: value } = await response.json();
      if (controller.signal.aborted) return;
      setPreferences({ navigationOrder: orderedIds(value?.navigationOrder, navigationOrder), vehicleBlockOrder: orderedIds(value?.vehicleBlockOrder, vehicleBlockOrder) });
      setReady(true); setError(false);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [refresh, enabled]);
  async function save(key: LayoutPreferenceKey, value: string[]) {
    if (!ready || savingRef.current) return;
    validateLayoutOrder(key, value);
    savingRef.current = true; setSaving(true);
    try {
      const response = await apiFetch('/api/layout-preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) });
      if (!response.ok) throw new Error('LAYOUT_SAVE_FAILED');
      const { preferences: saved } = await response.json() as { preferences: LayoutPreferences };
      setPreferences({ navigationOrder: orderedIds(saved.navigationOrder, navigationOrder), vehicleBlockOrder: orderedIds(saved.vehicleBlockOrder, vehicleBlockOrder) });
      setError(false);
    } catch { setError(true); }
    finally { savingRef.current = false; setSaving(false); }
  }
  return { preferences, ready, saving, error, save, retry: () => setRefresh((value) => value + 1) };
}
export type LayoutPreferencesController = ReturnType<typeof useLayoutPreferences>;
