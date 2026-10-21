import type { jsPDF } from "jspdf";
import { getActiveTenantId, tenantScopedStorageKey, apiFetch } from "./apiClient";
import { companyLogoSource } from "./companyLogo";
import { readLocalCache } from "./localCache";

export type ReportBranding = { name: string; logoUrl?: string; logoStoragePath?: string };

export function reportBrandingSnapshot(): ReportBranding {
  if (typeof window === "undefined" || (!getActiveTenantId() && process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS !== "1")) return { name: "" };
  try {
    const value = JSON.parse(readLocalCache(window.localStorage, tenantScopedStorageKey("kolaretorp-company-settings")) || "null");
    return { name: typeof value?.name === "string" ? value.name : "", logoUrl: companyLogoSource(value?.logoUrl), logoStoragePath: typeof value?.logoStoragePath === "string" ? value.logoStoragePath : "" };
  } catch { return { name: "" }; }
}

export async function reportLogoDataUrl(branding: ReportBranding = reportBrandingSnapshot()) {
  const tenant = getActiveTenantId();
  const source = companyLogoSource(branding.logoUrl);
  const path = branding.logoStoragePath;
  const sources = [source, path && !path.includes("..") ? `/api/media?path=${encodeURIComponent(path)}` : ""].filter(Boolean) as string[];
  if (!sources.length) return "";
  for (const value of sources) {
    try {
      let data = value;
      if (!value.startsWith("data:")) {
        const response = value.startsWith("/api/") ? await apiFetch(value, { cache: "no-store" }) : await fetch(value);
        if (!response.ok) throw new Error("Logo unavailable");
        const blob = await response.blob();
        if (blob.size > 2_000_000) throw new Error("Logo too large");
        data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
      }
      const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error("Logo unreadable")); element.src = data; });
      const scale = Math.min(1, 1600 / image.naturalWidth, 800 / image.naturalHeight);
      const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (getActiveTenantId() !== tenant) throw new Error("REPORT_TENANT_CHANGED");
      return canvas.toDataURL("image/png");
    } catch (error) { if (getActiveTenantId() !== tenant) throw error; }
  }
  throw new Error("Das Firmenlogo konnte nicht geladen werden. Bitte die Firmenstammdaten prüfen.");
}

export async function stampReportLogo(pdf: jsPDF, branding: ReportBranding = reportBrandingSnapshot()) {
  const data = await reportLogoDataUrl(branding);
  if (!data) return;
  const size = pdf.getImageProperties(data);
  const scale = Math.min(44 / size.width, 6 / size.height);
  const width = size.width * scale, height = size.height * scale;
  const previousPage = pdf.getCurrentPageInfo().pageNumber;
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.addImage(data, "PNG", pdf.internal.pageSize.getWidth() - 10 - width, 2, width, height, "tenant-report-logo", "FAST");
  }
  pdf.setPage(previousPage);
}

export async function excelReportLogo(branding: ReportBranding, column: number): Promise<import("write-excel-file/universal").Image[]> {
  const data = await reportLogoDataUrl(branding);
  if (!data) return [];
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = data; });
  const scale = Math.min(140 / image.naturalWidth, 32 / image.naturalHeight);
  return [{ content: await (await fetch(data)).blob(), contentType: "image/png", width: image.naturalWidth * scale, height: image.naturalHeight * scale, dpi: 96, anchor: { row: 1, column }, title: branding.name }];
}

export function reportExcelHeading(data: import("write-excel-file/universal").SheetData, branding: ReportBranding, title: string): import("write-excel-file/universal").SheetData {
  return [[{ value: branding.name, type: String, fontWeight: "bold", height: 22 }], [{ value: title, type: String, height: 22 }], [], ...data];
}
