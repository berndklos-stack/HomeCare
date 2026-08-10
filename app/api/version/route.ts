import { NextResponse } from "next/server";
import { appVersion } from "@/lib/appVersion";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      deployedAt: new Date().toISOString(),
      version: appVersion.version,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
