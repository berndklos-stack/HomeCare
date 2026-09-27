import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "jobs.manage");
  if (isAuthError(auth)) return auth;
  const payload = await request.json().catch(() => ({})) as { password?: string };
  const expectedPassword = process.env.REPORT_UNLOCK_PASSWORD || process.env.REPORT_RESET_PASSWORD;
  if (!expectedPassword) return NextResponse.json({ error: "Freigabe ist nicht konfiguriert." }, { status: 503 });
  if (!payload.password || payload.password !== expectedPassword) {
    return NextResponse.json({ error: "Passwort stimmt nicht." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
