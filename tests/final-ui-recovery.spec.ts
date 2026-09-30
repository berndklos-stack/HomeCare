import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyObjectMediaSignedUrls,
  objectMediaPathsToSign,
  objectMediaSignedUrlTtlSeconds,
} from "../lib/server/objectMediaProjection";

test("mobile Vor-Ort-Auswahl öffnet den richtigen Auftrag lokal und übersteht Reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const legacySectionWrites: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/sync-sections") && request.method() !== "GET") {
      legacySectionWrites.push(request.method());
    }
  });

  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByTestId("nav-field").click();
  await expect(page.getByText("Offene Aufträge", { exact: true })).toBeVisible();

  await page.context().setOffline(true);
  await page.getByRole("button", { name: /Gartenpflege und Sichtprüfung/ }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Gartenpflege und Sichtprüfung" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("kolaretorp-active-job-id") || "null"))).toBe("JOB-2408-OCC-20260802");
  await page.context().setOffline(false);

  await page.reload();
  await page.getByTestId("nav-field").click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Gartenpflege und Sichtprüfung" })).toBeVisible();
  expect(legacySectionWrites).toEqual([]);
});

test("activeJobId ist kein Legacy-Sync-Bereich mehr", () => {
  const pageSource = readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
  const routeSource = readFileSync(path.join(process.cwd(), "app/api/sync-sections/route.ts"), "utf8");
  expect(pageSource).not.toContain('"accountingAccounts" | "activeJobId"');
  expect(pageSource).not.toContain('persistSnapshotNow({ activeJobId:');
  expect(routeSource).not.toContain('  "activeJobId",');
});

test("private Objektbilder erhalten nur mandanteneigene kurzlebige URLs", () => {
  const tenantId = "00000000-0000-0000-0000-000000000001";
  const ownPath = `${tenantId}/object-photos/photo.jpg`;
  const foreignPath = "00000000-0000-0000-0000-000000000002/object-photos/foreign.jpg";
  const rows = [
    { deleted_at: null, preview_url: "/api/private-media?path=old", storage_path: ownPath },
    { deleted_at: null, preview_url: "https://storage.example/foreign", storage_path: foreignPath },
  ];

  expect(objectMediaSignedUrlTtlSeconds).toBeLessThanOrEqual(15 * 60);
  expect(objectMediaPathsToSign(rows, tenantId)).toEqual([ownPath]);
  expect(applyObjectMediaSignedUrls(rows, tenantId, new Map([[ownPath, "https://storage.example/signed-own"]]))).toEqual([
    { deleted_at: null, preview_url: "https://storage.example/signed-own", storage_path: ownPath },
    { deleted_at: null, preview_url: null, storage_path: null },
  ]);
});

test("Objektmedien behandeln Data-URLs, fehlende Quellen und Tombstones sicher", () => {
  const tenantId = "00000000-0000-0000-0000-000000000001";
  const dataUrl = "data:image/png;base64,ZmFrZQ==";
  const rows = [
    { deleted_at: null, preview_url: dataUrl, storage_path: null },
    { deleted_at: null, preview_url: null, storage_path: null },
    { deleted_at: "2026-09-30T10:00:00Z", preview_url: dataUrl, storage_path: null },
  ];

  expect(applyObjectMediaSignedUrls(rows, tenantId, new Map())).toEqual([
    { deleted_at: null, preview_url: dataUrl, storage_path: null },
    { deleted_at: null, preview_url: null, storage_path: null },
  ]);
});
