export const maxCompanyLogoLength = 1_500_000;

export function companyLogoSource(value: unknown): string {
  if (typeof value !== "string" || value.length > maxCompanyLogoLength) return "";
  if (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(value)) return value;
  if (/^https:\/\/[^\s]+$/.test(value) && value.length <= 2048) {
    try {
      const url = new URL(value);
      return url.username || url.password ? "" : value;
    } catch { return ""; }
  }
  return "";
}
