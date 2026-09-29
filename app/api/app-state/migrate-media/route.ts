import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "media.manage");
  if (isAuthError(auth)) return auth;
  return NextResponse.json({ error: "LEGACY_MEDIA_MIGRATION_RETIRED" }, { status: 410 });
}
