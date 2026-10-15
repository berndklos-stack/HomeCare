"use client";

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { validateBlockLayout, type BlockLayouts } from '@/lib/blockLayouts';

export function useBlockLayouts(enabled = true) {
  const [orders, setOrders] = useState<BlockLayouts>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const savingRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    savingRef.current = false;
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setReady(false); setSaving(false); setError(false);
      if (!enabled) { setOrders({}); return; }
      const response = await apiFetch('/api/block-layouts', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('BLOCK_LAYOUTS_UNAVAILABLE');
      const body = await response.json();
      const value: unknown = body?.orders;
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BLOCK_LAYOUT_RESPONSE');
      const entries = Object.entries(value).map(([scope, order]) => {
        const valid = validateBlockLayout(scope, order);
        return [valid.scope, valid.order] as const;
      });
      if (controller.signal.aborted) return;
      setOrders(Object.fromEntries(entries)); setReady(true); setError(false);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [enabled, refresh]);

  async function save(scope: string, order: string[]): Promise<void> {
    const controller = requestRef.current;
    if (!enabled || !ready || savingRef.current || !controller || controller.signal.aborted) return;
    savingRef.current = true; setSaving(true);
    try {
      const layout = validateBlockLayout(scope, order);
      const response = await apiFetch('/api/block-layouts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout), signal: controller.signal,
      });
      if (!response.ok) throw new Error('BLOCK_LAYOUT_SAVE_FAILED');
      const body = await response.json();
      const saved = validateBlockLayout(body?.scope, body?.order);
      if (saved.scope !== layout.scope) throw new Error('INVALID_BLOCK_LAYOUT_RESPONSE');
      if (controller.signal.aborted) return;
      setOrders((previous) => ({ ...previous, [saved.scope]: saved.order })); setError(false);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) { savingRef.current = false; setSaving(false); }
    }
  }

  return { orders, ready, saving, error, save, retry: () => setRefresh((value) => value + 1) };
}

export type BlockLayoutsController = ReturnType<typeof useBlockLayouts>;
