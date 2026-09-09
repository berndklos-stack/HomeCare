import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { password?: string };
  const expectedPassword = process.env.REPORT_UNLOCK_PASSWORD || process.env.REPORT_RESET_PASSWORD || "kolaretorp";
  if (!payload.password || payload.password !== expectedPassword) {
    return NextResponse.json({ error: "Passwort stimmt nicht." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
