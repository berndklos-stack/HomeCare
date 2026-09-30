"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  createSyncMutation,
  discardConflictingMutations,
  enqueueSyncMutation,
  failSyncMutation,
  markMutationSyncing,
  nextPendingMutation,
  readSyncQueue,
  retrySyncMutation,
  settleSyncMutation,
  summarizeSyncQueue,
  writeSyncQueue,
  type SyncMutation,
  type SyncMutationResult,
} from "@/lib/syncQueue";

type UseSyncQueueOptions = {
  disabled?: boolean;
  onApplied?: (mutation: SyncMutation, result: SyncMutationResult) => void;
};

async function sendMutation(mutation: SyncMutation): Promise<SyncMutationResult> {
  const response = await apiFetch("/api/sync-mutations", {
    body: JSON.stringify(mutation),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = await response.json().catch(() => ({})) as SyncMutationResult & { error?: string };
  if (response.status === 409 || payload.status === "conflict") {
    return { ...payload, mutationId: mutation.id, status: "conflict" };
  }
  if (!response.ok) throw new Error(payload.error || "Synchronisierung fehlgeschlagen.");
  return { ...payload, mutationId: mutation.id, status: "synced" };
}

export function useSyncQueue({ disabled = false, onApplied }: UseSyncQueueOptions = {}) {
  const [queue, setQueue] = useState<SyncMutation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const processingRef = useRef(false);
  const onAppliedRef = useRef(onApplied);

  useEffect(() => {
    onAppliedRef.current = onApplied;
  }, [onApplied]);

  useEffect(() => {
    const hydrateId = window.setTimeout(() => {
      setQueue(readSyncQueue(window.localStorage));
      setOnline(navigator.onLine);
      setHydrated(true);
    }, 0);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.clearTimeout(hydrateId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeSyncQueue(window.localStorage, queue);
  }, [hydrated, queue]);

  const flush = useCallback(async () => {
    if (disabled || !online || processingRef.current) return;
    processingRef.current = true;
    try {
      let pending = nextPendingMutation(queue);
      let workingQueue = queue;
      while (pending && navigator.onLine) {
        workingQueue = markMutationSyncing(workingQueue, pending.id);
        setQueue(workingQueue);
        try {
          const result = await sendMutation(pending);
          workingQueue = settleSyncMutation(workingQueue, pending.id, result);
          setQueue(workingQueue);
          if (result.status === "synced") onAppliedRef.current?.(pending, result);
          if (result.status === "conflict") break;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Synchronisierung fehlgeschlagen.";
          workingQueue = failSyncMutation(workingQueue, pending.id, message);
          setQueue(workingQueue);
          break;
        }
        pending = nextPendingMutation(workingQueue);
      }
    } finally {
      processingRef.current = false;
    }
  }, [disabled, online, queue]);

  useEffect(() => {
    if (!online || disabled || !nextPendingMutation(queue)) return;
    const timeoutId = window.setTimeout(() => void flush(), 150);
    return () => window.clearTimeout(timeoutId);
  }, [disabled, flush, online, queue]);

  const enqueue = useCallback((input: Parameters<typeof createSyncMutation>[0]) => {
    const mutation = createSyncMutation(input);
    setQueue((current) => {
      const next = enqueueSyncMutation(current, mutation);
      // Persist before returning control to the UI so an immediate reload cannot
      // lose a mutation while React is still scheduling effects.
      writeSyncQueue(window.localStorage, next);
      return next;
    });
    return mutation;
  }, []);

  const retry = useCallback((mutationId?: string) => {
    setQueue((current) => retrySyncMutation(current, mutationId));
  }, []);

  const discardConflicts = useCallback((mutationId?: string) => {
    setQueue((current) => {
      const next = discardConflictingMutations(current, mutationId);
      // Persist immediately so a reload cannot restore a conflict the user
      // explicitly resolved in favor of the authoritative server record.
      writeSyncQueue(window.localStorage, next);
      return next;
    });
  }, []);

  return {
    discardConflicts,
    enqueue,
    flush,
    online,
    queue,
    retry,
    summary: useMemo(() => summarizeSyncQueue(queue), [queue]),
  };
}
