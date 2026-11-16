import { test, expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { customerMediaTarget, customerReportPdf, describeCustomerMedia, loadCustomerMedia, type CustomerMediaRow } from "../lib/server/customerFileMedia";
import { uniqueCustomerFiles } from "../lib/customerFiles";

const origin = "https://tenant.supabase.co";
const media = (id: string, path = `T/${id}.jpg`, extra = {}): CustomerMediaRow => ({ id, owner_type: "report", owner_id: "R1", name: "image.jpg", kind: "checklist_photo", storage_path: path, preview_url: null, metadata: null, ...extra });

test("Alte Originale nur ueber exakt referenzierte Storage-Objekte derselben Installation laden", () => {
  expect(customerMediaTarget(media("A"), "T", origin)).toEqual({ bucket: "homecare-private-media", path: "T/A.jpg" });
  expect(customerMediaTarget(media("A", "OTHER/A.jpg"), "T", origin)).toBeNull();
  expect(customerMediaTarget(media("A", "OTHER/A.jpg", { preview_url: `${origin}/storage/v1/object/public/homecare-media/OTHER/A.jpg` }), "T", origin)).toBeNull();
  const path = "field-photos/2026-08-13/abc-IMG_1523.jpg";
  const old = media("A", path, { preview_url: `${origin}/storage/v1/object/public/homecare-media/${path}` });
  expect(customerMediaTarget(old, "T", origin)).toEqual({ bucket: "homecare-media", path });
  expect(customerMediaTarget({ ...old, preview_url: `https://foreign.invalid/storage/v1/object/public/homecare-media/${path}` }, "T", origin)).toBeNull();
  expect(customerMediaTarget({ ...old, preview_url: `${origin}/storage/v1/object/public/homecare-media/other.jpg` }, "T", origin)).toBeNull();
  const migrated = media("A", "", { storage_path: null, preview_url: "/api/private-media?path=migrated-app-state%2Farchive%2Fphoto.jpg" });
  expect(customerMediaTarget(migrated, "T", origin)).toEqual({ bucket: "homecare-private-media", path: "migrated-app-state/archive/photo.jpg" });
  expect(customerMediaTarget({ ...migrated, preview_url: "/api/private-media?path=T%2Fphoto.jpg" }, "T", origin)).toEqual({ bucket: "homecare-private-media", path: "T/photo.jpg" });
  expect(customerMediaTarget({ ...migrated, preview_url: "/api/private-media?path=OTHER%2Fphoto.jpg" }, "T", origin)).toBeNull();
  expect(customerMediaTarget(media("A", "T/../OTHER/a.jpg"), "T", origin)).toBeNull();
  expect(customerMediaTarget(media("A", "T/%252e%252e/OTHER/a.jpg"), "T", origin)).toBeNull();
});

test("Gleicher Inhalt unter anderen Dateinamen wird zusammengefasst, Namensgleichheit allein nicht", () => {
  const base = { id: "A", name: "image.jpg", category: "image" as const, jobId: "J", jobTitle: "Auftrag", source: "/A", date: "2026-08-13" };
  const files = uniqueCustomerFiles([base, { ...base, id: "B", source: "/B", contentKey: "same" }, { ...base, id: "C", name: "IMG_1523.jpeg", source: "/C", contentKey: "same" }, { ...base, id: "D", source: "/D", contentKey: "different", date: "2026-11-16" }]);
  expect(files.map(file => file.id)).toEqual(["D", "A", "B"]);
});

function database() {
  const tenant = { tenant_id: "T", deleted_at: null };
  const data: Record<string, Record<string, unknown>[]> = {
    homecare_tenants: [{ id: "T", name: "Testbetrieb" }],
    homecare_objects: [{ ...tenant, id: "O1", name: "Eigen", owner_customer_id: "C1", archived: false }, { ...tenant, id: "O2", name: "Fremd", owner_customer_id: "C2", archived: false }],
    homecare_jobs: [{ ...tenant, id: "J1", title: "Auftrag", customer_id: "C1", object_id: "O1" }, { ...tenant, id: "J2", title: "Fremdauftrag", customer_id: "C2", object_id: "O2" }],
    homecare_reports: [{ ...tenant, id: "R1", title: "Bericht", job_id: "J1", object_id: "O1", customer_id: "C1", report_date: "2026-08-13", visible_to_customer: true }, { ...tenant, id: "INTERNAL", job_id: "J1", object_id: "O1", customer_id: "C1", visible_to_customer: false }, { ...tenant, id: "FOREIGN", job_id: "J2", object_id: "O2", customer_id: "C2", visible_to_customer: true }],
    homecare_portal_messages: [{ ...tenant, id: "MSG", report_id: "R1", subject: "Bericht", customer_id: "C1", origin: "office", delivery_status: "gesendet" }, { ...tenant, id: "UNSENT", report_id: "R1", customer_id: "C1", origin: "office", delivery_status: "fehlgeschlagen" }],
    homecare_job_time_entries: [{ ...tenant, id: "E", job_id: "J1", entry_date: "2026-11-16" }],
    homecare_media: [media("A"), media("B"), media("C"), media("INTERNAL", "T/private.jpg", { owner_id: "INTERNAL" }), media("FOREIGN", "T/foreign.jpg", { owner_id: "FOREIGN" }), media("PDF", "T/report-attachments/report.pdf", { owner_type: "portal_message", owner_id: "MSG", kind: "attachment", name: "Bericht.pdf" }), media("DRAFT", "T/draft.pdf", { owner_type: "portal_message", owner_id: "UNSENT" }), media("ENTRY", "T/entry.jpg", { owner_type: "job_time_entry", owner_id: "E" })].map(row => ({ ...tenant, ...row })),
  };
  const db = { from: (table: string) => {
    let selected = data[table] || [];
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => { selected = selected.filter(row => row[column] === value); return query; },
      is: (column: string) => { selected = selected.filter(row => row[column] == null); return query; },
      in: (column: string, values: unknown[]) => { selected = selected.filter(row => values.includes(row[column])); return query; },
      order: () => query,
      single: async () => ({ data: selected[0], error: selected.length ? null : "missing" }),
      range: async (from: number, to: number) => ({ data: selected.slice(from, to + 1), error: null }),
    }; return query;
  }, storage: { from: () => ({ info: async (path: string) => ({ data: { size: 100, etag: path === "T/B.jpg" ? "11111111111111111111111111111111" : path === "T/A.jpg" ? "11111111111111111111111111111111" : "22222222222222222222222222222222" }, error: null }) }) } } as unknown as SupabaseClient;
  return db;
}

test("Dateiquellen filtern Mandanten, Kunden, interne Berichte und ungesendete Nachrichten vor jedem Abruf", async () => {
  const db = database();
  const portal = await loadCustomerMedia(db, "T", "C1", true);
  expect(portal.records.map(row => row.id).sort()).toEqual(["A", "B", "C", "PDF"]);
  const internal = await loadCustomerMedia(db, "T", "C1", false);
  expect(internal.records.map(row => row.id)).toContain("ENTRY");
  expect(internal.records.map(row => row.id)).toContain("INTERNAL");
  expect((await loadCustomerMedia(db, "T", "C2", true, "A")).records).toEqual([]);
  expect((await loadCustomerMedia(db, "OTHER", "C1", true)).records).toEqual([]);
  const files = await describeCustomerMedia(db, "T", portal, "/api/portal/files");
  expect(files.filter(file => file.category === "report")).toHaveLength(1);
  expect(files.filter(file => file.category === "image")).toHaveLength(1);
  expect(files.every(file => file.source.startsWith("/api/portal/files?id="))).toBe(true);
});

test("Berichte ohne gespeichertes PDF sind als eigener Bericht herunterladbar, ohne interne Notizen", async () => {
  const db = database();
  const rows = await loadCustomerMedia(db, "T", "C1", false);
  const files = await describeCustomerMedia(db, "T", rows, "/api/customer-files?customerId=C1");
  expect(files.some(file => file.category === "report" && file.source.includes("reportId=INTERNAL"))).toBe(true);
  const bytes = await customerReportPdf(db, "T", { ...rows.reports[0], title: "Hauskontrolle", summary: "Alles kontrolliert", checklist_results: [{ title: "Fenster", note: "Geschlossen" }] });
  const pdf = Buffer.from(bytes).toString("latin1");
  expect(pdf).toContain("%PDF");
  expect(pdf).toContain("Hauskontrolle");
  expect(pdf).toContain("Geschlossen");
  expect(pdf).not.toContain("internal_notes");
});
