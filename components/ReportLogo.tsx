"use client";
import { reportBrandingSnapshot } from "@/lib/reportBranding";
import { companyLogoSource } from "@/lib/companyLogo";
import { useObjectMediaImage } from "@/lib/useObjectMediaImage";

export function ReportLogo() {
  const branding = reportBrandingSnapshot();
  const image = useObjectMediaImage({ previewUrl: companyLogoSource(branding.logoUrl), storagePath: branding.logoStoragePath });
  // eslint-disable-next-line @next/next/no-img-element -- Printable, tenant-specific logo with authenticated blob loading.
  return image.url ? <img alt={branding.name || "Firmenlogo"} src={image.url} className="report-company-logo"/> : <span className="report-company-logo-name">{branding.name}</span>;
}
