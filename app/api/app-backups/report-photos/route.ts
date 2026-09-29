import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "backups.manage");
  if (isAuthError(auth)) return auth;
  return NextResponse.json({ error: "LEGACY_PHOTO_RECOVERY_RETIRED" }, { status: 410 });
}

export const POST = GET;
