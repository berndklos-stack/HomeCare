import { expect, test } from "@playwright/test";
import { loadCustomerDownloads } from "../lib/customerFileDownloads";
import type { CustomerFile } from "../lib/customerFiles";

const files = Array.from({ length: 12 }, (_, index): CustomerFile => ({ id: String(index), name: `${index}.pdf`, category: "document", jobId: "J", jobTitle: "Test", source: `/api/files?id=${index}` }));

test("Sammeldownload lädt drei Dateien gleichzeitig und erhält die Zuordnung", async () => {
  let active = 0, maximum = 0;
  const progress: number[] = [];
  const result = await loadCustomerDownloads(files, new AbortController(), async file => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, (12 - Number(file.id)) * 2));
    active--;
    return new Response(file.id);
  }, count => progress.push(count));
  expect(maximum).toBe(3);
  expect(progress).toEqual(files.map((_, index) => index + 1));
  expect(result.map(bytes => new TextDecoder().decode(bytes))).toEqual(files.map(file => file.id));
});

test("Parallele Antworten ohne Größenangabe teilen ein gemeinsames Limit", async () => {
  const controller = new AbortController();
  await expect(loadCustomerDownloads(files, controller, async () => new Response("1234"), () => {}, 10)).rejects.toThrow("100 MB");
  expect(controller.signal.aborted).toBe(true);
});

test("Fehlgeschlagene Datei stoppt weitere Abrufe und behält die Fehlermeldung", async () => {
  let started = 0;
  const controller = new AbortController();
  await expect(loadCustomerDownloads(files, controller, async () => {
    started++;
    return new Response(null, { status: 404 });
  }, () => {})).rejects.toThrow("404");
  expect(started).toBeLessThanOrEqual(3);
  expect(controller.signal.aborted).toBe(true);
});

test("Hängender Abruf erhält ein Zeitlimit und bricht die anderen Abrufe ab", async () => {
  let active = 0;
  await expect(loadCustomerDownloads(files, new AbortController(), async (_, signal) => {
    active++;
    return new Promise<Response>((_, reject) => signal.addEventListener("abort", () => { active--; reject(new DOMException("Aborted", "AbortError")); }, { once: true }));
  }, () => {}, 100, 20)).rejects.toThrow("Zeitlimit");
  expect(active).toBe(0);
});

test("Abbruch lädt weder weitere Dateien noch ein unvollständiges Ergebnis", async () => {
  const controller = new AbortController();
  let started = 0;
  const result = loadCustomerDownloads(files, controller, async (_, signal) => {
    started++;
    return new Promise<Response>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
  }, () => {});
  controller.abort();
  await expect(result).rejects.toThrow();
  expect(started).toBe(3);
});
