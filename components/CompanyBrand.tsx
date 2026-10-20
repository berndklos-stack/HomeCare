"use client";

import { useState } from "react";
import { companyLogoSource } from "@/lib/companyLogo";

function logoContrast(image: HTMLImageElement): "invert" | "light" | "" {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = Math.max(1, Math.round(128 * image.naturalHeight / image.naturalWidth));
  canvas.height = Math.min(canvas.height, 128);
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return "";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let weight = 0;
    let luminance = 0;
    let colorWeight = 0;
    let transparentPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] / 255;
      weight += alpha;
      if (alpha < 0.1) transparentPixels++;
      if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) - Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) > 16) colorWeight += alpha;
      luminance += alpha * (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
    }
    if (!weight || luminance / weight >= 128) return "";
    // Only transparent monochrome artwork can be inverted without changing brand colours.
    return colorWeight / weight < 0.01 && transparentPixels > canvas.width * canvas.height * 0.01 ? "invert" : "light";
  } catch {
    // Cross-origin logos without CORS remain displayable but cannot be sampled.
    return "";
  }
}

export function CompanyBrand({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failedSource, setFailedSource] = useState("");
  const [contrast, setContrast] = useState<{ source: string; mode: string }>({ source: "", mode: "" });
  const source = companyLogoSource(logoUrl);
  const companyName = name.trim() || "WorkCore";
  if (source && source !== failedSource) {
    // eslint-disable-next-line @next/next/no-img-element -- Tenant-uploaded data URLs must not use the image optimizer.
    return <img alt={companyName} className={`company-brand-image${contrast.source === source && contrast.mode ? ` company-brand-image-${contrast.mode}` : ""}`} height={60} onLoad={event => setContrast({ source, mode: logoContrast(event.currentTarget) })} onError={() => setFailedSource(source)} src={source} width={220} />;
  }
  return <strong className="company-brand-name">{companyName}</strong>;
}
