"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { reviewConflictSequence, type ConflictReview } from "@/lib/conflictReview";
import {
  createSyncMutation,
  discardConflictingMutations,
  failSyncMutation,
  markMutationSyncing,
  nextPendingMutation,
  persistSyncMutationBatch,
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
  onApplied?: (mutation: SyncMutation, result: SyncMutationResult, remainingQueue: SyncMutation[]) => void;
};

const automaticFlushBatchSize = 8;
const automaticFlushDelayMs = 750;

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
  const [queue, setQueueState] = useState<SyncMutation[]>([]);
  const queueRef = useRef<SyncMutation[]>([]);
  const setQueue = useCallback((update: SyncMutation[] | ((current: SyncMutation[]) => SyncMutation[])) => {
    const next = typeof update === "function" ? update(queueRef.current) : update;
    queueRef.current = next;
    setQueueState(next);
  }, []);
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const processingRef = useRef(false);
  const reviewEpoch = useRef(0);
  const reviewRequests = useRef(new Set<AbortController>());
  const automaticReviewSignature = useRef("");
  const onAppliedRef = useRef(onApplied);

  useEffect(() => {
    onAppliedRef.current = onApplied;
  }, [onApplied]);

  useEffect(() => {
    const requests = reviewRequests.current;
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
      reviewEpoch.current += 1;
      for (const controller of requests) controller.abort();
      requests.clear();
      window.clearTimeout(hydrateId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setQueue]);

  useEffect(() => {
    if (!hydrated) return;
    writeSyncQueue(window.localStorage, queue);
  }, [hydrated, queue]);

  const flush = useCallback(async () => {
    if (disabled || !online || processingRef.current) return;
    processingRef.current = true;
    try {
      let pending = nextPendingMutation(queueRef.current);
      let processed = 0;
      while (pending && navigator.onLine && processed < automaticFlushBatchSize) {
        processed += 1;
        const pendingId = pending.id;
        setQueue((current) => markMutationSyncing(current, pendingId));
        try {
          const result = await sendMutation(pending);
          setQueue((current) => settleSyncMutation(current, pendingId, result));
          writeSyncQueue(window.localStorage, queueRef.current);
          if (result.status === "synced") onAppliedRef.current?.(pending, result, queueRef.current);
          if (result.status === "conflict") break;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Synchronisierung fehlgeschlagen.";
          setQueue((current) => failSyncMutation(current, pendingId, message));
          break;
        }
        pending = nextPendingMutation(queueRef.current);
      }
    } finally {
      processingRef.current = false;
    }
  }, [disabled, online, setQueue]);

  useEffect(() => {
    if (!online || disabled || !nextPendingMutation(queue)) return;
    const timeoutId = window.setTimeout(() => void flush(), automaticFlushDelayMs);
    return () => window.clearTimeout(timeoutId);
  }, [disabled, flush, online, queue]);

  const enqueueMany = useCallback((inputs: Parameters<typeof createSyncMutation>[0][]) => {
    const mutations = inputs.map((input) => createSyncMutation(input));
    // Commit all related local mutations before exposing any state change.
    setQueue((current) => persistSyncMutationBatch(window.localStorage, current, mutations));
    return mutations;
  }, [setQueue]);
  const enqueue = useCallback((input: Parameters<typeof createSyncMutation>[0]) => enqueueMany([input])[0], [enqueueMany]);

  const retry = useCallback((mutationId?: string) => {
    setQueue((current) => {
      const next = retrySyncMutation(current, mutationId);
      writeSyncQueue(window.localStorage, next);
      return next;
    });
  }, [setQueue]);

  const discardConflicts = useCallback((mutationId?: string | string[]) => {
    setQueue((current) => {
      const next = discardConflictingMutations(current, mutationId);
      // Persist immediately so a reload cannot restore a conflict the user
      // explicitly resolved in favor of the authoritative server record.
      writeSyncQueue(window.localStorage, next);
      return next;
    });
  }, [setQueue]);

  const reviewConflicts = useCallback(async (ids: string[], resolve = false): Promise<ConflictReview[]> => {
    const epoch = reviewEpoch.current;
    const tenant = window.localStorage.getItem("workcore-active-tenant-id");
    const assertContext = () => {
      if (epoch !== reviewEpoch.current || tenant !== window.localStorage.getItem("workcore-active-tenant-id")) {
        throw new Error("Sitzung geändert. Konfliktprüfung abgebrochen.");
      }
    };
    const requested = new Set(ids);
    const snapshot = queueRef.current.filter((m) => m.status === "conflict" && requested.has(m.id));
    const reviews: ConflictReview[] = [];
    for (let offset = 0; offset < snapshot.length; offset += 25) {
      assertContext();
      const batch = snapshot.slice(offset, offset + 25);
      const controller = new AbortController();
      reviewRequests.current.add(controller);
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await apiFetch("/api/sync-conflicts/review", {
          method: "POST", cache: "no-store", signal: controller.signal,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(batch),
        });
        if (!response.ok) throw new Error("Serververgleich nicht verfügbar. Keine Konflikte entfernt.");
        const result = await response.json() as { reviews: ConflictReview[] };
        assertContext();
        reviews.push(...result.reviews);
      } finally { window.clearTimeout(timeout); reviewRequests.current.delete(controller); }
    }
    const checked = reviewConflictSequence(snapshot, queueRef.current, reviews);
    if (resolve) {
      assertContext();
      const safe = checked.filter((r) => r.redundant).map((r) => r.id);
      discardConflicts(safe);
    }
    return checked;
  }, [discardConflicts]);

  useEffect(() => {
    if (!hydrated || disabled || !online || nextPendingMutation(queue)) return;
    const conflicts = queue.filter((mutation) => mutation.entityType === "field_progress" && mutation.status === "conflict");
    if (!conflicts.length) return;
    const signature = queue.filter((mutation) => mutation.status !== "synced").map((mutation) => `${mutation.id}:${mutation.status}`).join("|");
    if (automaticReviewSignature.current === signature) return;
    const timer = window.setTimeout(() => {
      automaticReviewSignature.current = signature;
      void reviewConflicts(conflicts.map((mutation) => mutation.id), true).catch(() => {
        // The queue remains intact if the server comparison is unavailable.
        automaticReviewSignature.current = "";
      });
    }, automaticFlushDelayMs);
    return () => window.clearTimeout(timer);
  }, [disabled, hydrated, online, queue, reviewConflicts]);

  return {
    discardConflicts,
    enqueue,
    enqueueMany,
    flush,
    online,
    queue,
    reviewConflicts,
    retry,
    summary: useMemo(() => summarizeSyncQueue(queue), [queue]),
  };
}
