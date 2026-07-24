import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidSessionCookie } from "@/lib/auth";

type NominatimResult = { lat: string; lon: string; display_name: string };

export async function GET(request: NextRequest) {
  if (!isValidSessionCookie(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "gb");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "south-london-kids-activities-admin/1.0",
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
  }

  const results = (await res.json()) as NominatimResult[];
  if (results.length === 0) {
    return NextResponse.json({ error: "No match found for that address" }, { status: 404 });
  }

  const [{ lat, lon, display_name }] = results;
  return NextResponse.json({ lat: Number(lat), lng: Number(lon), displayName: display_name });
}
