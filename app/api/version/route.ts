import { NextResponse } from "next/server";
import { appVersion } from "@/lib/appVersion";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      deployedAt: new Date().toISOString(),
      version: appVersion.version,
      databaseProject: process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0] : null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
