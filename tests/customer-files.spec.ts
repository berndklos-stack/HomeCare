import { expect, test } from "@playwright/test";
import { collectCustomerFiles, customerArchivePaths, safeArchiveName } from "../lib/customerFiles";
import { readablePortalFile } from "../lib/portalFiles";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { removeUnreferencedPrivateMedia } from "../lib/server/privateMediaAccess";
import type { SupabaseClient } from "@supabase/supabase-js";

test("Gemeinsam verwendete Originaldateien werden beim Entfernen eines Berichtsanhangs erhalten", async () => {
  let liveReferences: number | null = 1, removed = 0;
  const filters: unknown[][] = [];
  const builder = {
    select: () => builder,
    eq: (...args: unknown[]) => { filters.push(args); return builder; },
    is: async () => ({ count: liveReferences, error: null }),
  };
  const client = { from: () => builder, storage: { from: () => ({ remove: async () => { removed++; return { error: null }; } }) } } as unknown as SupabaseClient;
  await removeUnreferencedPrivateMedia(client, "T", "T/file.jpg");
  expect(removed).toBe(0);
  await expect(removeUnreferencedPrivateMedia(client, "T", "OTHER/file.jpg")).rejects.toThrow("Mandanten");
  expect(filters).toContainEqual(["tenant_id", "T"]);
  expect(filters).toContainEqual(["storage_path", "T/file.jpg"]);
  liveReferences = null;
  await expect(removeUnreferencedPrivateMedia(client, "T", "T/file.jpg")).rejects.toThrow("Dateiverweise");
  expect(removed).toBe(0);
  liveReferences = 0;
  await removeUnreferencedPrivateMedia(client, "T", "T/file.jpg");
  expect(removed).toBe(1);
});

test("Dateiübersicht trennt Kunden und freigegebene von internen Berichten", () => {
  const objects = [{ id: "O1", name: "Objekt", ownerCustomerId: "C1" }, { id: "O2", name: "Fremd", ownerCustomerId: "C2" }];
  const attachment = { id: "A", name: "Plan.pdf", storagePath: "tenant/plan.pdf" };
  const base = { jobId: "J1", objectId: "O1", date: "2026-11-15", checklistResults: [], attachments: [attachment] };
  const reports = [{ ...base, id: "R1", visibleToCustomer: true }, { ...base, id: "R2", visibleToCustomer: false, attachments: [{ ...attachment, id: "B", storagePath: "tenant/internal.pdf" }] }, { ...base, id: "R3", objectId: "O2", visibleToCustomer: true }];
  const jobs = [{ id: "J1", title: "Auftrag", customerId: "C1", objectId: "O1", consulting: { entries: [{ id: "E", date: "2026-11-15", attachments: [{ ...attachment, id: "C", storagePath: "tenant/unreleased.pdf" }] }] } }];
  expect(collectCustomerFiles("C1", objects, jobs, reports)).toHaveLength(3);
  const portal = collectCustomerFiles("C1", objects, jobs, reports, true);
  expect(portal).toHaveLength(1);
  expect(portal[0].source).toContain("tenant%2Fplan.pdf");
  expect(collectCustomerFiles("C3", objects, jobs, reports, true)).toHaveLength(0);
});

test("ZIP-Pfade sind sicher, gruppiert und auch bei Namensgleichheit eindeutig", () => {
  const base = { id: "A", name: "../Plan.pdf", category: "document" as const, jobId: "J/1", jobTitle: "Montage", source: "/api/private-media?path=test" };
  const paths = customerArchivePaths([base, base, { ...base, name: "Foto.jpg", category: "image" }]);
  expect(paths[0]).toBe("Dokumente/Montage-J_1/_Plan.pdf");
  expect(paths[1]).toBe("Dokumente/Montage-J_1/_Plan (2).pdf");
  expect(paths[2]).toBe("Bilder/Montage-J_1/Foto.jpg");
  expect(safeArchiveName("../../C:\\test\u0000")).not.toMatch(/[\\/\u0000]/);
});

test("Portaldownload benötigt freigegebenen Eigentümer und passenden Mandantenpfad", () => {
  expect(readablePortalFile({ owner_id: "R", storage_path: "T/file.jpg" }, new Set(["R"]), "T")).toBe(true);
  expect(readablePortalFile({ owner_id: "OTHER", storage_path: "T/file.jpg" }, new Set(["R"]), "T")).toBe(false);
  expect(readablePortalFile({ owner_id: "R", storage_path: "OTHER/file.jpg" }, new Set(["R"]), "T")).toBe(false);
  expect(readablePortalFile({ owner_id: "R", storage_path: "T/../other/file.jpg" }, new Set(["R"]), "T")).toBe(false);
});

test("Portaldateien und Direktdownloads sind ohne Anmeldung gesperrt", async ({ request }) => {
  for (const url of ["/api/portal/files", "/api/portal/files?id=foreign-id"]) {
    const response = await request.get(url);
    expect(response.status()).toBe(401);
  }
  const internal = await request.get("/api/customer-files?customerId=foreign&id=private", { headers: { "X-WorkCore-E2E-Bypass": "0" } });
  expect(internal.status()).toBe(401);
});

for (const width of [390, 1440]) test(`Kundenportal zeigt freigegebene Downloads und sammelt sie als ZIP ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem("sb-auth-demo-auth-token", JSON.stringify({ access_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwb3J0YWwtdGVzdCJ9.test", refresh_token: "test-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: "portal-test", email: "portal@example.invalid", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-11-16T00:00:00Z" } }));
  });
  await page.route("**/api/auth/context", route => route.fulfill({ json: { portalAccess: [{ tenantId: "T" }] } }));
  await page.route("**/api/portal/context", route => route.fulfill({ json: { customer: { id: "C", name: "Portalkunde" }, tenant: { id: "T", name: "Testfirma" }, objects: [], jobs: [], reports: [], messages: [], billing: [] } }));
  await page.route("**/api/portal/files**", route => {
    const id = new URL(route.request().url()).searchParams.get("id");
    return id ? route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4 portal" }) : route.fulfill({ json: { files: [{ id: "F", name: "Freigegebener Plan.pdf", category: "document", jobId: "J", jobTitle: "Montage", source: "/api/portal/files?id=F" }] } });
  });
  await page.goto("/portal");
  const files = page.getByRole("region", { name: "Bilder und Dokumente", exact: true });
  await expect(files.getByText("Freigegebener Plan.pdf", { exact: true })).toBeVisible({ timeout: 20000 });
  const downloaded = page.waitForEvent("download");
  await files.getByRole("button", { name: "Alle angezeigten als ZIP", exact: true }).click();
  const result = await downloaded;
  expect(result.suggestedFilename()).toBe("Portalkunde.zip");
    expect(Object.keys(unzipSync(readFileSync((await result.path())!)))).toEqual(["Dokumente/Montage-J/Freigegebener Plan.pdf"]);
  await page.screenshot({ path: info.outputPath("portal-downloads.png") });
  expect(await files.evaluate(element => [element, ...element.querySelectorAll("*")].filter(item => item.scrollWidth > item.clientWidth + 1).map(item => ({ tag: item.tagName, class: item.className, width: item.clientWidth, scroll: item.scrollWidth })))).toEqual([]);
});
