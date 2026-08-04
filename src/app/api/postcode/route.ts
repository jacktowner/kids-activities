import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type PostcodesIoResponse = {
  status: number;
  result?: { latitude: number; longitude: number };
};

// Public (no auth) — used by the "Activities near me" postcode search on the main
// explore page, not just admin. postcodes.io is the standard free, no-API-key UK
// postcode geocoder; proxied server-side (rather than called from the browser) to
// keep this consistent with how the rest of the app talks to external geocoders.
export async function GET(request: NextRequest) {
  const postcode = request.nextUrl.searchParams.get("postcode")?.trim();
  if (!postcode) {
    return NextResponse.json({ error: "Missing postcode" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}`
  );

  if (res.status === 404) {
    return NextResponse.json({ error: "Postcode not found" }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "Postcode lookup service unavailable" }, { status: 502 });
  }

  const data = (await res.json()) as PostcodesIoResponse;
  if (!data.result) {
    return NextResponse.json({ error: "Postcode not found" }, { status: 404 });
  }

  return NextResponse.json({ lat: data.result.latitude, lng: data.result.longitude });
}
