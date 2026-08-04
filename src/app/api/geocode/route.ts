import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveActor } from "@/lib/request-actor";

type NominatimResult = { lat: string; lon: string; display_name: string };

export async function GET(request: NextRequest) {
  const actor = await resolveActor(request);
  if (actor.kind === "none") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const address = request.nextUrl.searchParams.get("address")?.trim();
  const venue = request.nextUrl.searchParams.get("venue")?.trim();
  const borough = request.nextUrl.searchParams.get("borough")?.trim();
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!address && !venue && !q) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  // Nominatim treats a comma-joined query as a structured address hierarchy —
  // one unrecognized component (e.g. a venue name it doesn't have indexed, or
  // a street that doesn't match its data exactly) can make the whole query
  // return zero results even though a simpler variant would match. Try a
  // handful of candidates from most to least specific and use the first hit.
  const candidates = q
    ? [q]
    : dedupe([
        [venue, address, borough, "London"],
        [address, borough, "London"],
        [venue, borough, "London"],
        [address, "London"],
        [venue, "London"],
      ].map((parts) => parts.filter(Boolean).join(", ")));

  for (const candidate of candidates) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", candidate);
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "gb");

    const res = await fetch(url, {
      headers: {
        "User-Agent": "london-kids-activities-admin/1.0",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
    }

    const results = (await res.json()) as NominatimResult[];
    if (results.length > 0) {
      const [{ lat, lon, display_name }] = results;
      return NextResponse.json({ lat: Number(lat), lng: Number(lon), displayName: display_name });
    }
  }

  return NextResponse.json({ error: "No match found for that address" }, { status: 404 });
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
