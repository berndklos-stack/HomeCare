import { NextResponse } from "next/server";

export const runtime = "nodejs";

type OdometerPayload = {
  imageDataUrl?: string;
};

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const outputText = (payload as { output_text?: unknown }).output_text;
  if (typeof outputText === "string") return outputText;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  return output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    return content.map((part) => {
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    });
  }).join("\n");
}

function normalizeOdometer(value: string) {
  const raw = value.replace(/\s/g, "").replace(/[^\d,.]/g, "");
  const match = raw.match(/\d[\d,.]{1,12}/);
  if (!match) return "";
  const normalized = match[0].replace(/[,.](?=\d{3}\b)/g, "").replace(",", ".");
  const number = Math.round(Number(normalized));
  if (!Number.isFinite(number) || number <= 0) return "";
  return String(number);
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY fehlt." }, { status: 500 });
    }

    const payload = await request.json() as OdometerPayload;
    if (!payload.imageDataUrl?.startsWith("data:image/")) {
      return NextResponse.json({ error: "Bild fehlt." }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: [
              {
                text: "Lies den Kilometerstand vom Fahrzeug-Tacho im Bild. Antworte nur mit der Zahl ohne Einheit. Wenn kein plausibler Kilometerstand erkennbar ist, antworte leer.",
                type: "input_text",
              },
              {
                image_url: payload.imageDataUrl,
                type: "input_image",
              },
            ],
            role: "user",
          },
        ],
        max_output_tokens: 40,
        model: process.env.OPENAI_ODOMETER_MODEL || "gpt-4.1-mini",
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const responseText = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: `Kilometerstand konnte nicht gelesen werden: ${response.status} ${responseText}` }, { status: 502 });
    }

    const result = responseText ? JSON.parse(responseText) : {};
    const text = extractOutputText(result);
    const odometer = normalizeOdometer(text);
    return NextResponse.json({ odometer, raw: text });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kilometerstand konnte nicht gelesen werden." }, { status: 500 });
  }
}
