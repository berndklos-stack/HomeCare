import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { formatGoogleAddress, type GoogleGeocodeResult } from "@/lib/googleAddress";

export const runtime = "nodejs";

type GoogleGeocodeResponse = {
  error_message?: string;
  results?: GoogleGeocodeResult[];
  status?: string;
};

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "resources.manage");
  if (isAuthError(auth)) return auth;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API-Key fehlt.", provider: "google" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const latitude = Number(searchParams.get("lat"));
  const longitude = Number(searchParams.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "GPS-Koordinaten fehlen.", provider: "google" }, { status: 400 });
  }

  const params = new URLSearchParams({
    key: apiKey,
    language: "sv",
    latlng: `${latitude},${longitude}`,
    region: "se",
    result_type: "street_address|premise|subpremise|route",
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  const payload = await response.json() as GoogleGeocodeResponse;
  const result = payload.results?.[0];
  if (!response.ok || payload.status !== "OK" || !result) {
    return NextResponse.json({
      error: payload.error_message || payload.status || "Google-Adresse wurde nicht gefunden.",
      provider: "google",
    }, { status: 502 });
  }

  return NextResponse.json({
    address: formatGoogleAddress(result),
    formattedAddress: result.formatted_address ?? "",
    provider: "google",
  });
}
