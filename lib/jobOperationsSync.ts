import type { SyncMutation, SyncMutationOperation } from "@/lib/syncQueue";

export type RevisionMeta = { revision?: number; updatedAt?: string };
export type RevisionedTimeEntry = Record<string, unknown> & { id: string; revision?: number; updatedAt?: string };
export type RevisionedJob = Record<string, unknown> & {
  consulting?: Record<string, unknown> & { entries?: RevisionedTimeEntry[] };
  id: string;
  revision?: number;
  updatedAt?: string;
};
export type RevisionedProgress = Record<string, unknown> & { revision?: number; updatedAt?: string };
export type PlannedJobMutation = {
  entityId: string;
  entityType: "field_progress" | "job" | "job_note" | "job_time_entry";
  expectedRevision?: number;
  operation: SyncMutationOperation;
  payload: Record<string, unknown>;
  resourceId: string;
};

const transient = new Set(["deletedAt", "id", "revision", "updatedAt"]);
const payload = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([key]) => !transient.has(key)));
const fingerprint = (value: Record<string, unknown>) => JSON.stringify(payload(value));

function jobPayload(job: RevisionedJob) {
  const result = payload(job);
  const consulting = job.consulting;
  if (consulting) result.consulting = Object.fromEntries(Object.entries(consulting).filter(([key]) => key !== "entries"));
  return result;
}

export function prepareJobMutations<T extends RevisionedJob>(currentJobs: T[], nextJobs: T[], now = new Date().toISOString()) {
  const currentById = new Map(currentJobs.map((job) => [job.id, job]));
  const nextIds = new Set(nextJobs.map((job) => job.id));
  const mutations: PlannedJobMutation[] = [];
  const jobs = nextJobs.map((job) => {
    const current = currentById.get(job.id);
    let revision = current?.revision;
    let updatedAt = current?.updatedAt;
    if (!current) {
      revision = 1; updatedAt = now;
      mutations.push({ entityId: job.id, entityType: "job", operation: "create", payload: jobPayload(job), resourceId: job.id });
    } else if (JSON.stringify(jobPayload(current)) !== JSON.stringify(jobPayload(job))) {
      const expectedRevision = current.revision ?? 1;
      revision = expectedRevision + 1; updatedAt = now;
      mutations.push({ entityId: job.id, entityType: "job", expectedRevision, operation: "update", payload: jobPayload(job), resourceId: job.id });
    }
    const currentEntries = new Map(((current?.consulting?.entries ?? []) as RevisionedTimeEntry[]).map((entry) => [entry.id, entry]));
    const nextEntries = (job.consulting?.entries ?? []) as RevisionedTimeEntry[];
    const nextEntryIds = new Set(nextEntries.map((entry) => entry.id));
    const entries = nextEntries.map((entry) => {
      const previous = currentEntries.get(entry.id);
      if (!previous) {
        mutations.push({ entityId: entry.id, entityType: "job_time_entry", operation: "create", payload: payload(entry), resourceId: job.id });
        return { ...entry, revision: 1, updatedAt: now };
      }
      if (fingerprint(previous) === fingerprint(entry)) return { ...entry, revision: previous.revision, updatedAt: previous.updatedAt };
      const expectedRevision = previous.revision ?? 1;
      mutations.push({ entityId: entry.id, entityType: "job_time_entry", expectedRevision, operation: "update", payload: payload(entry), resourceId: job.id });
      return { ...entry, revision: expectedRevision + 1, updatedAt: now };
    });
    currentEntries.forEach((entry) => {
      if (!nextEntryIds.has(entry.id)) mutations.push({ entityId: entry.id, entityType: "job_time_entry", expectedRevision: entry.revision ?? 1, operation: "delete", payload: {}, resourceId: job.id });
    });
    const consulting = job.consulting ? { ...job.consulting, entries } : undefined;
    return { ...job, consulting, revision, updatedAt } as T;
  });
  currentJobs.forEach((job) => {
    if (!nextIds.has(job.id)) mutations.push({ entityId: job.id, entityType: "job", expectedRevision: job.revision ?? 1, operation: "delete", payload: {}, resourceId: job.id });
  });
  return { jobs, mutations };
}

function flattenProgress(progress: Record<string, Record<string, RevisionedProgress>>) {
  const rows = new Map<string, { jobId: string; payload: Record<string, unknown>; progressKey: string; task: RevisionedProgress; taskId: string }>();
  Object.entries(progress).forEach(([progressKey, tasks]) => {
    const [jobId, workDate] = progressKey.split("::", 2);
    Object.entries(tasks).forEach(([taskId, task]) => rows.set(`${progressKey}:${taskId}`, {
      jobId,
      payload: { ...payload(task), taskId, workDate: workDate || null },
      progressKey,
      task,
      taskId,
    }));
  });
  return rows;
}

export function prepareProgressMutations(
  current: Record<string, Record<string, RevisionedProgress>>,
  next: Record<string, Record<string, RevisionedProgress>>,
  now = new Date().toISOString(),
) {
  const currentRows = flattenProgress(current);
  const nextRows = flattenProgress(next);
  const mutations: PlannedJobMutation[] = [];
  const progress = structuredClone(next);
  nextRows.forEach((row, id) => {
    const previous = currentRows.get(id);
    if (!previous) {
      mutations.push({ entityId: id, entityType: "field_progress", operation: "create", payload: row.payload, resourceId: row.jobId });
      progress[row.progressKey][row.taskId] = { ...row.task, revision: 1, updatedAt: now };
    } else if (JSON.stringify(previous.payload) !== JSON.stringify(row.payload)) {
      const expectedRevision = previous.task.revision ?? 1;
      mutations.push({ entityId: id, entityType: "field_progress", expectedRevision, operation: "update", payload: row.payload, resourceId: row.jobId });
      progress[row.progressKey][row.taskId] = { ...row.task, revision: expectedRevision + 1, updatedAt: now };
    }
  });
  currentRows.forEach((row, id) => {
    if (!nextRows.has(id)) mutations.push({
      entityId: id,
      entityType: "field_progress",
      expectedRevision: row.task.revision ?? 1,
      operation: "delete",
      payload: { taskId: row.taskId, workDate: row.payload.workDate },
      resourceId: row.jobId,
    });
  });
  return { mutations, progress };
}

export function prepareNoteMutations(
  current: Record<string, string>, next: Record<string, string>, meta: Record<string, RevisionMeta>, now = new Date().toISOString(),
) {
  const mutations: PlannedJobMutation[] = [];
  const nextMeta = { ...meta };
  const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
  keys.forEach((key) => {
    const [jobId, workDate] = key.split("::", 2);
    const before = current[key] ?? "";
    const after = next[key] ?? "";
    if (before === after) return;
    const expectedRevision = meta[key]?.revision;
    mutations.push({
      entityId: `${key}:note`, entityType: "job_note", expectedRevision,
      operation: after ? (expectedRevision === undefined ? "create" : "update") : "delete",
      payload: after ? { note: after, workDate: workDate || null } : { workDate: workDate || null }, resourceId: jobId,
    });
    if (after) nextMeta[key] = { revision: expectedRevision === undefined ? 1 : expectedRevision + 1, updatedAt: now };
    else delete nextMeta[key];
  });
  return { meta: nextMeta, mutations, notes: next };
}

const active = (queue: SyncMutation[], type: SyncMutation["entityType"]) => queue.filter((item) => item.entityType === type && !["synced", "conflict"].includes(item.status));

export function overlayPendingJobOperations<T extends RevisionedJob>(
  jobs: T[], progress: Record<string, Record<string, RevisionedProgress>>, notes: Record<string, string>, noteMeta: Record<string, RevisionMeta>, queue: SyncMutation[],
) {
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  active(queue, "job").forEach((mutation) => {
    if (mutation.operation === "delete") jobsById.delete(mutation.entityId);
    else {
      const previous = jobsById.get(mutation.entityId);
      const consulting = mutation.payload.consulting;
      const next = { ...(previous ?? { id: mutation.entityId }), ...mutation.payload, id: mutation.entityId, revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1, updatedAt: mutation.updatedAt } as T;
      if (consulting && typeof consulting === "object" && !Array.isArray(consulting)) {
        next.consulting = { ...previous?.consulting, ...consulting, entries: previous?.consulting?.entries ?? [] };
      }
      jobsById.set(mutation.entityId, next);
    }
  });
  active(queue, "job_time_entry").forEach((mutation) => {
    const job = jobsById.get(mutation.resourceId); if (!job) return;
    const entries = new Map(((job.consulting?.entries ?? []) as RevisionedTimeEntry[]).map((entry) => [entry.id, entry]));
    if (mutation.operation === "delete") entries.delete(mutation.entityId);
    else entries.set(mutation.entityId, { ...(entries.get(mutation.entityId) ?? { id: mutation.entityId }), ...mutation.payload, id: mutation.entityId, revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1, updatedAt: mutation.updatedAt });
    jobsById.set(job.id, { ...job, consulting: { ...(job.consulting ?? {}), entries: Array.from(entries.values()) } } as T);
  });
  const nextProgress = structuredClone(progress);
  active(queue, "field_progress").forEach((mutation) => {
    const taskId = String(mutation.payload.taskId ?? mutation.entityId.slice(mutation.entityId.lastIndexOf(":") + 1));
    const workDate = typeof mutation.payload.workDate === "string" ? mutation.payload.workDate : "";
    const key = workDate ? `${mutation.resourceId}::${workDate}` : mutation.resourceId;
    nextProgress[key] ??= {};
    if (mutation.operation === "delete") delete nextProgress[key][taskId];
    else nextProgress[key][taskId] = { ...(nextProgress[key][taskId] ?? {}), ...mutation.payload, revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1, updatedAt: mutation.updatedAt };
  });
  const nextNotes = { ...notes }; const nextMeta = { ...noteMeta };
  active(queue, "job_note").forEach((mutation) => {
    const workDate = typeof mutation.payload.workDate === "string" ? mutation.payload.workDate : "";
    const key = workDate ? `${mutation.resourceId}::${workDate}` : mutation.resourceId;
    if (mutation.operation === "delete") { delete nextNotes[key]; delete nextMeta[key]; }
    else { nextNotes[key] = String(mutation.payload.note ?? ""); nextMeta[key] = { revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1, updatedAt: mutation.updatedAt }; }
  });
  return { jobs: Array.from(jobsById.values()), noteMeta: nextMeta, notes: nextNotes, progress: nextProgress };
}
