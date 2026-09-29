import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

function retired() {
  return NextResponse.json({ error: "APP_STATE_RETIRED", message: "Der relationale Datenbestand ist maßgeblich." }, { status: 410 });
}

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  return isAuthError(auth) ? auth : retired();
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.write");
  return isAuthError(auth) ? auth : retired();
}

export const PUT = POST;
