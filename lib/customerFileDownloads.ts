import type { CustomerFile } from "./customerFiles";

export async function loadCustomerDownloads(
  files: CustomerFile[],
  controller: AbortController,
  fetchFile: (file: CustomerFile, signal: AbortSignal) => Promise<Response>,
  onProgress: (completed: number) => void,
  limit = 100 * 1024 * 1024,
  timeoutMs = 90000,
) {
  const results = new Array<Uint8Array>(files.length);
  let next = 0, completed = 0, total = 0;
  const worker = async () => {
    while (next < files.length && !controller.signal.aborted) {
      const index = next++, file = files[index];
      const request = new AbortController();
      const abort = () => request.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(() => request.abort(), timeoutMs);
      try {
        const response = await fetchFile(file, request.signal);
        if (!response.ok) throw Error(`„${file.name}“ konnte nicht geladen werden (${response.status}).`);
        if (Number(response.headers.get("Content-Length")) > limit - total) throw Error("Die Auswahl überschreitet 100 MB. Bitte weniger Dateien auswählen.");
        const reader = response.body?.getReader();
        if (!reader) throw Error(`„${file.name}“ konnte nicht gelesen werden.`);
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            // All workers share one budget, including responses without Content-Length.
            total += chunk.value.length;
            if (total > limit) throw Error("Die Auswahl überschreitet 100 MB. Bitte weniger Dateien auswählen.");
            length += chunk.value.length;
            chunks.push(chunk.value);
          }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        if (request.signal.aborted) throw Error("Download abgebrochen.");
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        results[index] = bytes;
        onProgress(++completed);
      } catch (error) {
        if (request.signal.aborted && !controller.signal.aborted) throw Error(`„${file.name}“: Zeitlimit beim Laden überschritten. Bitte erneut versuchen.`);
        throw error;
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener("abort", abort);
      }
    }
  };
  const workers = Array.from({ length: Math.min(3, files.length) }, worker);
  try {
    await Promise.all(workers);
    if (controller.signal.aborted) throw Error("Download abgebrochen.");
    return results;
  } catch (error) {
    controller.abort();
    await Promise.allSettled(workers);
    throw error;
  }
}
