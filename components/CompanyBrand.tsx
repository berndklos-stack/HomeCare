"use client";

import { useState } from "react";
import { companyLogoSource } from "@/lib/companyLogo";

export function CompanyBrand({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failedSource, setFailedSource] = useState("");
  const source = companyLogoSource(logoUrl);
  const companyName = name.trim() || "WorkCore";
  if (source && source !== failedSource) {
    // eslint-disable-next-line @next/next/no-img-element -- Tenant-uploaded data URLs must not use the image optimizer.
    return <img alt={companyName} className="company-brand-image" height={60} onError={() => setFailedSource(source)} src={source} width={220} />;
  }
  return <strong className="company-brand-name">{companyName}</strong>;
}
