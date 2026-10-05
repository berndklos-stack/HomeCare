import { expect, test } from "@playwright/test";
import { createSyncMutation, enqueueSyncMutation, markMutationSyncing, type SyncMutation } from "../lib/syncQueue";

test.use({ isMobile: true, hasTouch: true });

for (const mode of ["overview", "field"] as const) test(`fünf Berichte ohne Fotos (${mode}): Ressourcen und Entwürfe bleiben stabil`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/")) requests.push(request.url()); });
  await page.addInitScript(() => {
    const timers = new Set<number>();
    const timerDetails = new Map<number, { delay: number | undefined; origin: string }>();
    const intervals = new Set<number>();
    const timeout = window.setTimeout.bind(window);
    const clearTimeout = window.clearTimeout.bind(window);
    const interval = window.setInterval.bind(window);
    const clearInterval = window.clearInterval.bind(window);
    window.setTimeout = ((fn: TimerHandler, delay?: number, ...args: unknown[]) => {
      const id = timeout(() => { timers.delete(id); timerDetails.delete(id); if (typeof fn === "function") fn(...args); }, delay);
      const origin = new Error().stack?.split("\n").find((line) => line.includes("http")) ?? "unknown";
      timerDetails.set(id, { delay, origin });
      timers.add(id); return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = (id) => { if (typeof id === "number") { timers.delete(id); timerDetails.delete(id); } clearTimeout(id); };
    window.setInterval = ((...args: Parameters<typeof window.setInterval>) => { const id = interval(...args); intervals.add(id); return id; }) as typeof window.setInterval;
    window.clearInterval = (id) => { if (typeof id === "number") intervals.delete(id); clearInterval(id); };
    const listeners = new Set<string>();
    const ids = new WeakMap<object, number>();
    let serial = 0;
    for (const [targetName, target] of [["window", window], ["document", document]] as const) {
      const add = target.addEventListener.bind(target);
      const remove = target.removeEventListener.bind(target);
      const key = (type: string, listener: object, options?: boolean | AddEventListenerOptions) => {
        if (!ids.has(listener)) ids.set(listener, ++serial);
        return `${targetName}:${type}:${ids.get(listener)}:${typeof options === "boolean" ? options : Boolean(options?.capture)}`;
      };
      target.addEventListener = ((type: string, listener: EventListener, options?: boolean | AddEventListenerOptions) => {
        if (listener) listeners.add(key(type, listener, options));
        add(type, listener, options);
      }) as typeof target.addEventListener;
      target.removeEventListener = ((type: string, listener: EventListener, options?: boolean | EventListenerOptions) => {
        if (listener) listeners.delete(key(type, listener, options));
        remove(type, listener, options);
      }) as typeof target.removeEventListener;
    }
    Object.assign(window, { reportTimerDetails: () => Array.from(timerDetails.values()), reportMetrics: () => ({
      timers: timers.size,
      // Next's dev indicator schedules 200/500ms animation timers when other
      // parallel tests compile routes. Keep them observable but not attributed
      // to the report lifecycle. Only exclude the immediate known devtools caller.
      appTimers: Array.from(timerDetails.values()).filter((timer) => !timer.origin.includes("node_modules_next_dist_compiled_next-devtools")).length,
      intervals: intervals.size, listeners: listeners.size,
      queue: JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]").filter((m: { entityType: string }) => ["report", "field_progress", "job_note"].includes(m.entityType)).length,
      queueBytes: (localStorage.getItem("workcore-sync-mutations-v1") || "").length }) });
    if (!localStorage.getItem("transition-fixture")) {
      localStorage.setItem("transition-fixture", "1");
      localStorage.setItem("kolaretorp-reports", JSON.stringify(Array.from({ length: 5 }, (_, index) => ({
        id: `TRANS-${index}`, jobId: `TRANS-JOB-${index}`, objectId: "OBJ-1001", revision: 1,
        title: `Wechselbericht ${index}`, date: `2026-09-${20 + index}`, summary: "Start", customerComment: "",
        checklistResults: [], media: [], visibleToCustomer: true,
      }))));
    }
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  if (mode === "field") {
    await page.evaluate(() => {
      const template = { objectId: "OBJ-1001", customerId: "CUS-1", type: "Kontrolle", priority: "normal", assignedTo: "Test", description: "", internalNotes: "", customService: null, billable: false, material: "-", workMinutes: 15, schedule: { type: "einmalig", frequency: "wöchentlich", interval: 1, weekdays: [], end: "nie", endDate: "", occurrences: 0 } };
      localStorage.setItem("kolaretorp-jobs", JSON.stringify(Array.from({ length: 5 }, (_, index) => ({ ...template,
        id: `TRANS-JOB-${index}`, title: `Wechselbericht ${index}`, status: "erledigt", dueDate: `${20 + index}.09.2026`, checklist: ["Kontrolle"], serviceIds: [], schedule: { ...template.schedule, type: "einmalig" },
      }))));
      const reports = JSON.parse(localStorage.getItem("kolaretorp-reports") || "[]");
      reports.forEach((report: { checklistResults: unknown[] }) => { report.checklistResults = [{ id: "Kontrolle", title: "Kontrolle", completed: true, minutes: 15, note: "", photos: [] }]; });
      localStorage.setItem("kolaretorp-reports", JSON.stringify(reports));
    });
    await page.reload();
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("nav-field").click();
  } else await page.getByRole("button", { name: /^5 Berichte$/ }).click();
  const snapshots: Array<Record<string, number>> = [];
  const timerSnapshots: unknown[] = [];
  const sample = async () => {
    await page.waitForTimeout(1000);
    snapshots.push({ ...await page.evaluate(() => (window as unknown as { reportMetrics: () => Record<string, number> }).reportMetrics()), requests: requests.length });
    timerSnapshots.push(await page.evaluate(() => (window as unknown as { reportTimerDetails: () => unknown }).reportTimerDetails()));
  };
  await sample();
  for (let index = 0; index < 5; index++) {
    if (mode === "field") {
      await page.getByTestId("nav-field").click();
      await page.getByRole("button", { name: /^Abgeschlossene Berichte/ }).click();
    }
    await page.getByRole("button", { name: new RegExp(`Wechselbericht ${index}`) }).first().click();
    if (mode === "field") {
      await page.getByRole("textbox", { name: /^Hinweis / }).first().pressSequentially("Checkliste ohne Fotos.");
      await page.getByRole("textbox", { name: "Einsatznotiz", exact: true }).pressSequentially(" Ein neuer Entwurf ohne Fotos.");
      await page.getByRole("button", { name: "Bericht speichern", exact: true }).click();
    } else {
      await page.getByRole("textbox", { name: "Berichtstext", exact: true }).pressSequentially(" Ein neuer Entwurf ohne Fotos.");
      await page.getByRole("button", { name: `Bericht Wechselbericht ${index} Schließen`, exact: true }).click();
    }
    await sample();
  }
  console.log("REPORT_METRICS", JSON.stringify(snapshots));
  console.log("REPORT_TIMER_ORIGINS", JSON.stringify(timerSnapshots));
  await test.info().attach("report-metrics", { body: JSON.stringify(snapshots, null, 2), contentType: "application/json" });
  await test.info().attach("report-timer-origins", { body: JSON.stringify(timerSnapshots, null, 2), contentType: "application/json" });
  const settledRequests = requests.length;
  await page.waitForTimeout(10_000);
  const idleRequests = requests.slice(settledRequests);
  console.log("REPORT_IDLE_REQUESTS", JSON.stringify(idleRequests));
  // The global vehicle-position poll is expected every 15 seconds, independent
  // of report selection. No report/media/background request loop is allowed.
  expect(idleRequests.length).toBeLessThanOrEqual(1);
  expect(idleRequests.every((url) => new URL(url).pathname === "/api/vehicle-positions")).toBe(true);
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  for (let index = 0; index < 5; index++) {
    const report = await page.evaluate((id) => JSON.parse(localStorage.getItem("kolaretorp-reports") || "[]").find((r: { id: string }) => r.id === id), `TRANS-${index}`);
    expect(report.summary).toContain("Ein neuer Entwurf ohne Fotos.");
  }
  // Each saved field report retains create/delete pairs for progress and note,
  // plus its report update. Lifecycle changes are intentionally not discarded.
  expect(snapshots.at(-1)!.queue).toBeLessThanOrEqual(mode === "field" ? 25 : 5);
  expect(snapshots.at(-1)!.intervals).toBe(snapshots[1].intervals);
  expect(snapshots.at(-1)!.listeners).toBeLessThanOrEqual(snapshots[1].listeners);
  expect(snapshots.at(-1)!.appTimers).toBeLessThanOrEqual(snapshots[1].appTimers + 1);
  if (mode === "field") {
    await page.getByTestId("nav-field").click();
    await page.getByRole("button", { name: /^Abgeschlossene Berichte/ }).click();
    await page.getByRole("button", { name: /Wechselbericht 0/ }).first().click();
    await page.getByRole("textbox", { name: "Einsatznotiz", exact: true }).fill("Noch nicht abgeschlossener Entwurf");
    await page.reload();
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("nav-field").click();
    await page.getByRole("button", { name: /^Abgeschlossene Berichte/ }).click();
    await page.getByRole("button", { name: /Wechselbericht 0/ }).first().click();
    await expect(page.getByRole("textbox", { name: "Einsatznotiz", exact: true })).toHaveValue("Noch nicht abgeschlossener Entwurf");
  }
});

test("nur ungesendete Berichtsedits werden zusammengefasst, Serverrevision bleibt geschützt", () => {
  const edit = (revision: number) => createSyncMutation({ entityId: "R", entityType: "report", resourceId: "R", operation: "update", expectedRevision: revision, payload: { summary: `Text ${revision}` } });
  let queue: SyncMutation[] = [];
  queue = enqueueSyncMutation(queue, edit(1));
  for (let count = 0; count < 100; count++) queue = enqueueSyncMutation(queue, edit(2));
  expect(queue).toHaveLength(1);
  expect(queue[0]).toMatchObject({ expectedRevision: 1, payload: { summary: "Text 2" } });
  const syncing = markMutationSyncing(queue, queue[0].id);
  expect(enqueueSyncMutation(syncing, edit(2))).toHaveLength(2);
  expect(enqueueSyncMutation([{ ...queue[0], attempts: 1 }], edit(2))).toHaveLength(2);
  expect(enqueueSyncMutation([{ ...queue[0], status: "conflict" }], edit(2))).toHaveLength(2);
  expect(enqueueSyncMutation(queue, edit(500))).toHaveLength(2);
  const deletion = { ...edit(101), operation: "delete" as const };
  expect(enqueueSyncMutation(enqueueSyncMutation(queue, deletion), edit(102))).toHaveLength(3);
  for (const entityType of ["field_progress", "job_note"] as const) {
    const creation = { ...edit(1), entityType, expectedRevision: undefined, operation: "create" as const };
    const change = { ...edit(1), entityType, payload: { note: "neu", completed: true } };
    const compacted = enqueueSyncMutation([creation], change);
    expect(compacted).toHaveLength(1);
    expect(compacted[0]).toMatchObject({ id: creation.id, operation: "create", expectedRevision: undefined, payload: change.payload });
    expect(enqueueSyncMutation([{ ...creation, attempts: 1 }], change)).toHaveLength(2);
  }
});
