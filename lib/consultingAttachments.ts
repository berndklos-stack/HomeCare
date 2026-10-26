export type ConsultingAttachment = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  storagePath: string;
};

export const consultingAttachmentAccept = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

export function consultingAttachmentAllowed(file: { name: string; type: string; size: number }) {
  return file.size > 0 && file.size <= 4 * 1024 * 1024 && /\.(?:jpe?g|png|webp|heic|heif|pdf|docx?|xlsx?|txt|csv)$/i.test(file.name)
    && !/html|svg|javascript|executable/i.test(file.type);
}

export function consultingAttachmentSource(file: ConsultingAttachment) {
  return file.storagePath ? `/api/private-media?path=${encodeURIComponent(file.storagePath)}` : "";
}
