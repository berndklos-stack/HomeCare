import DOMPurify from "dompurify";

const svgNamespace = "http://www.w3.org/2000/svg";
const unsafeLogo = () => new Error("UNSAFE_SVG_LOGO");

function safeReferences(value: string) {
  // Reject obfuscated CSS and anything except references within this document.
  if (/@|\\|\/\*/.test(value)) return false;
  if (/\b(?:image-set|image|src|paint|expression)\s*\(/i.test(value)) return false;
  return !/url\s*\(/i.test(value.replace(/url\(\s*["']?#[\w.-]+["']?\s*\)/gi, ""));
}

function svgLength(value: string | null, fallback: number) {
  if (!value) return fallback;
  const match = value.match(/^\s*(\d+(?:\.\d+)?)(px|mm|cm|in|pt|pc)?\s*$/i);
  if (!match) throw unsafeLogo();
  const factors: Record<string, number> = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, pt: 96 / 72, pc: 16 };
  return Number(match[1]) * (factors[match[2]?.toLowerCase() ?? "px"] ?? 1);
}

export async function prepareCompanyLogoFile(file: File) {
  if (file.type !== "image/svg+xml" && !/\.svg$/i.test(file.name)) return file;
  if (file.size > 2 * 1024 * 1024) throw unsafeLogo();
  const text = await file.text();
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(text)) throw unsafeLogo();
  const document = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = document.documentElement;
  if (document.querySelector("parsererror") || root.localName !== "svg" || root.namespaceURI !== svgNamespace) throw unsafeLogo();
  for (const element of document.querySelectorAll("*")) {
    if (element.namespaceURI !== svgNamespace || /^(script|foreignObject|image|feImage|a|animate|animateMotion|animateTransform|set)$/i.test(element.localName)) throw unsafeLogo();
    for (const attribute of element.attributes) {
      if (/^on/i.test(attribute.localName) || attribute.localName === "base") throw unsafeLogo();
      if (attribute.localName === "href" && !/^#[\w.-]+$/.test(attribute.value)) throw unsafeLogo();
      if (!safeReferences(attribute.value)) throw unsafeLogo();
    }
    if (element.localName === "style" && !safeReferences(element.textContent ?? "")) throw unsafeLogo();
  }
  const box = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (box && (box.length !== 4 || !box.every(Number.isFinite))) throw unsafeLogo();
  const width = box?.[2] ?? svgLength(root.getAttribute("width"), 300);
  const height = box?.[3] ?? svgLength(root.getAttribute("height"), 150);
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) throw unsafeLogo();
  if (!box) root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const scale = Math.min(1, 900 / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  root.setAttribute("width", String(targetWidth));
  root.setAttribute("height", String(targetHeight));
  // CSS must not override the decode size and allocate an enormous bitmap.
  for (const [axis, size] of [["width", targetWidth], ["height", targetHeight]] as const) {
    root.style.setProperty(axis, `${size}px`, "important");
    root.style.setProperty(`max-${axis}`, `${size}px`, "important");
    root.style.setProperty(`min-${axis}`, "0px", "important");
  }
  const sanitized = DOMPurify.sanitize(new XMLSerializer().serializeToString(root), {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["foreignObject", "image", "feImage", "script", "animate", "animateMotion", "animateTransform", "set"],
  });
  return new File([sanitized], "company-logo.svg", { type: "image/svg+xml" });
}
