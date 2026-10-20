"use client";

import { useState } from "react";
import { companyLogoSource } from "@/lib/companyLogo";

function needsLightBackdrop(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = Math.max(1, Math.round(128 * image.naturalHeight / image.naturalWidth));
  canvas.height = Math.min(canvas.height, 128);
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let weight = 0;
    let luminance = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] / 255;
      weight += alpha;
      luminance += alpha * (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
    }
    return weight > 0 && luminance / weight < 128;
  } catch {
    // Cross-origin logos without CORS remain displayable but cannot be sampled.
    return false;
  }
}

export function CompanyBrand({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failedSource, setFailedSource] = useState("");
  const [lightSource, setLightSource] = useState("");
  const source = companyLogoSource(logoUrl);
  const companyName = name.trim() || "WorkCore";
  if (source && source !== failedSource) {
    // eslint-disable-next-line @next/next/no-img-element -- Tenant-uploaded data URLs must not use the image optimizer.
    return <img alt={companyName} className={`company-brand-image${lightSource === source ? " company-brand-image-light" : ""}`} height={60} onLoad={event => setLightSource(needsLightBackdrop(event.currentTarget) ? source : "")} onError={() => setFailedSource(source)} src={source} width={220} />;
  }
  return <strong className="company-brand-name">{companyName}</strong>;
}
