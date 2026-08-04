/**
 * Daily refresh: fetch a curated list of council/museum/park/festival "what's on"
 * pages, ask Gemini to extract real, current family-friendly activities from each
 * page's text, and insert any that are genuinely new and not already in the DB.
 *
 * No Google Search grounding is used here — that requires a billing-enabled Gemini
 * project and returned 429 RESOURCE_EXHAUSTED on this free-tier key. Instead this
 * script does its own fetching (like the geocode route already does for Nominatim)
 * and only asks Gemini to structure text it was actually given, which keeps this
 * free to run and keeps sourceUrl honest (it's the page we fetched, not a URL Gemini
 * invented).
 *
 * Usage:
 *   npx tsx scripts/refresh-activities-gemini.ts            # dry run, prints what it would insert
 *   npx tsx scripts/refresh-activities-gemini.ts --write     # actually inserts
 *   npx tsx scripts/refresh-activities-gemini.ts --write --limit=20
 *
 * Requires GEMINI_API_KEY, either already exported in the environment or set in
 * this project's .env file (read manually below — this script has no other
 * dependency on dotenv).
 */

import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const ROOT = join(__dirname, "..");

const ALLOWED_CATEGORIES = [
  "Museum & Heritage",
  "Sports",
  "Nature",
  "Multi-activity Camp",
  "STEM",
  "Arts & Crafts",
  "Music & Drama",
];

const SOURCES_FILE = join(ROOT, "scripts", "gemini-sources.json");

// Recurring "what's on" hub pages, not one-off event pages, so they stay useful run
// after run. Spans museums/galleries, parks, councils, and festivals across Greater
// London per the site's coverage. Grown over time by discover-sources-gemini.ts
// (run monthly, separately from this daily script) rather than hardcoded here.
function loadSources(): { name: string; url: string }[] {
  const raw = JSON.parse(readFileSync(SOURCES_FILE, "utf-8")) as { name: string; url: string }[];
  return raw.map(({ name, url }) => ({ name, url }));
}

type GeminiActivity = {
  title: string;
  description: string;
  category: string[];
  borough: string;
  venue: string;
  address: string;
  ageMin: number;
  ageMax: number;
  isFree: boolean;
  priceMin: number;
  priceMax: number;
  startDate: string;
  endDate: string;
  times?: string;
  sourceName?: string;
  sourceUrl: string;
};

function loadApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const envFile = readFileSync(join(ROOT, ".env"), "utf-8");
    for (const line of envFile.split("\n")) {
      const match = line.match(/^GEMINI_API_KEY\s*=\s*"?([^"\n]*)"?\s*$/);
      if (match) return match[1];
    }
  } catch {
    // no .env file, fall through
  }
  console.error("Error: GEMINI_API_KEY not set in the environment or in .env");
  process.exit(1);
}

async function fetchExistingTitles(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.activity.findMany({ select: { title: true } });
  return rows.map((r) => r.title);
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return htmlToText(html).slice(0, 8000);
  } catch {
    return null;
  }
}

function buildPrompt(
  source: { name: string; url: string },
  pageText: string,
  existingTitles: string[],
  maxPerSource: number
): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Below is the visible text scraped from this web page:
Source name: ${source.name}
Source URL: ${source.url}

--- PAGE TEXT START ---
${pageText}
--- PAGE TEXT END ---

From ONLY the text above, extract up to ${maxPerSource} real, family-friendly activities, \
events, camps or drop-ins for a London kids/family activity finder ("family-friendly" \
includes all-ages events, not just children-only ones). Today's date is ${today} — only \
include activities whose end date (or the page's general validity) is on or after today. \
If the page doesn't clearly describe any dated, bookable activity (e.g. it's just a generic \
"visit us" page with no specific events), return an empty array.

Do not invent any detail not supported by the text — if a field isn't stated, make a \
reasonable inference only for things like age range or price where the text implies it \
(e.g. "for all the family" implies ageMin 0); otherwise omit optional fields.

Do not include any of these activities that are already in the database (match by title, \
skip near-duplicates too): ${existingTitles.join(" | ") || "(none yet)"}

category must be an array containing one or more of exactly these values (no others): \
${ALLOWED_CATEGORIES.join(", ")}

borough must be a real Greater London borough name, written without an ampersand \
(e.g. "Kensington and Chelsea", not "Kensington & Chelsea"), or "City of London". Infer it \
from the venue/address if the page doesn't state it outright.

Respond with ONLY a raw JSON array (no markdown code fences, no commentary before or after), \
where each element has exactly these fields:
{
  "title": string,
  "description": string (1-3 sentences),
  "category": string[] (from the allowed list above),
  "borough": string,
  "venue": string,
  "address": string (street address, no borough/city/postcode needed),
  "ageMin": number,
  "ageMax": number,
  "isFree": boolean,
  "priceMin": number (0 if isFree),
  "priceMax": number (0 if isFree),
  "startDate": string (YYYY-MM-DD),
  "endDate": string (YYYY-MM-DD),
  "times": string (optional, e.g. "Mon-Fri 10am-4pm"),
  "sourceName": string (optional, defaults to "${source.name}"),
  "sourceUrl": string (use "${source.url}" unless the text literally shows a more specific URL)
}`;
}

// Free tier is capped at 20 requests/minute in addition to a daily quota. With one
// call per source this is easy to trip, so retry a 429 using its own "retry in Xs"
// hint before giving up.
function parseRetryAfterSeconds(message: string): number {
  const match = message.match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(Number(match[1])) + 1 : 15;
}

async function callGemini(apiKey: string, prompt: string, attempt = 1): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (res.status === 429 && attempt <= 3) {
    const body = await res.text();
    const waitSeconds = parseRetryAfterSeconds(body);
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    return callGemini(apiKey, prompt, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error(`Unexpected Gemini response shape: ${JSON.stringify(json).slice(0, 500)}`);
  return text;
}

function extractJsonArray(text: string): unknown[] {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error(`No JSON array found in response: ${stripped.slice(0, 300)}`);
  return JSON.parse(stripped.slice(start, end + 1));
}

function isValid(entry: unknown, todayStr: string): entry is GeminiActivity {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.title !== "string" || !e.title.trim()) return false;
  if (typeof e.description !== "string" || !e.description.trim()) return false;
  if (!Array.isArray(e.category) || e.category.length === 0) return false;
  if (!(e.category as unknown[]).every((c) => ALLOWED_CATEGORIES.includes(String(c)))) return false;
  if (typeof e.borough !== "string" || !e.borough.trim()) return false;
  if (typeof e.venue !== "string" || !e.venue.trim()) return false;
  if (typeof e.address !== "string" || !e.address.trim()) return false;
  if (typeof e.ageMin !== "number" || typeof e.ageMax !== "number" || e.ageMin > e.ageMax) return false;
  if (typeof e.isFree !== "boolean") return false;
  if (typeof e.priceMin !== "number" || typeof e.priceMax !== "number") return false;
  if (typeof e.startDate !== "string" || Number.isNaN(Date.parse(e.startDate))) return false;
  if (typeof e.endDate !== "string" || Number.isNaN(Date.parse(e.endDate))) return false;
  if (e.endDate < todayStr) return false;
  if (typeof e.sourceUrl !== "string" || !/^https?:\/\//.test(e.sourceUrl)) return false;
  return true;
}

async function geocode(activity: GeminiActivity): Promise<{ lat: number; lng: number } | null> {
  const candidates = [
    [activity.venue, activity.address, activity.borough, "London"],
    [activity.address, activity.borough, "London"],
    [activity.venue, activity.borough, "London"],
    [activity.address, "London"],
    [activity.venue, "London"],
  ].map((parts) => parts.filter(Boolean).join(", "));

  for (const candidate of candidates) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", candidate);
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "gb");

    const res = await fetch(url, {
      headers: { "User-Agent": "london-kids-activities-cron/1.0" },
    });
    await new Promise((resolve) => setTimeout(resolve, 1100)); // Nominatim: max 1 req/sec
    if (!res.ok) continue;

    const results = (await res.json()) as { lat: string; lon: string }[];
    if (results.length > 0) {
      return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 15;
  const maxPerSource = 4;

  const apiKey = loadApiKey();
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  const log = (msg: string) => {
    console.log(msg);
    try {
      mkdirSync(join(ROOT, "logs"), { recursive: true });
      appendFileSync(join(ROOT, "logs", "gemini-refresh.log"), `[${new Date().toISOString()}] ${msg}\n`);
    } catch {
      // logging is best-effort
    }
  };

  try {
    log(`Starting refresh (${write ? "WRITE" : "DRY RUN"}, limit=${limit})`);

    // Flip anything whose endDate has passed to status "expired" so it drops out of the
    // public listing (which only shows status: "published"), independent of whether new
    // activities are found below.
    const todayStr = new Date().toISOString().slice(0, 10);
    const expiredWhere = { endDate: { lt: new Date(todayStr) }, status: { not: "expired" } };
    if (write) {
      const { count } = await prisma.activity.updateMany({ where: expiredWhere, data: { status: "expired" } });
      log(`Marked ${count} activities as expired.`);
    } else {
      const count = await prisma.activity.count({ where: expiredWhere });
      log(`Would mark ${count} activities as expired.`);
    }

    const SOURCES = loadSources();
    const existingTitles = await fetchExistingTitles(prisma);
    const existingLower = new Set(existingTitles.map((t) => t.toLowerCase()));

    let inserted = 0;
    let skippedInvalid = 0;
    let skippedDuplicate = 0;
    let skippedGeocode = 0;
    let sourcesFetchFailed = 0;

    for (const source of SOURCES) {
      if (inserted >= limit) break;

      const pageText = await fetchPageText(source.url);
      if (!pageText || pageText.length < 200) {
        sourcesFetchFailed++;
        log(`  fetch failed or too short, skipping source: ${source.name} (${source.url})`);
        continue;
      }

      let rawEntries: unknown[];
      try {
        const prompt = buildPrompt(source, pageText, existingTitles, maxPerSource);
        await new Promise((resolve) => setTimeout(resolve, 3500)); // stay under the free tier's 20 req/min cap
        const text = await callGemini(apiKey, prompt);
        rawEntries = extractJsonArray(text);
      } catch (err) {
        log(`  Gemini call failed for ${source.name}: ${err}`);
        continue;
      }

      for (const raw of rawEntries) {
        if (inserted >= limit) break;
        if (!isValid(raw, todayStr)) {
          skippedInvalid++;
          continue;
        }
        const activity = raw;
        if (existingLower.has(activity.title.toLowerCase())) {
          skippedDuplicate++;
          continue;
        }

        const coords = await geocode(activity);
        if (!coords) {
          skippedGeocode++;
          log(`  geocode failed, skipping: "${activity.title}"`);
          continue;
        }

        log(`  + "${activity.title}" (${activity.borough}) [${source.name}] -> draft`);
        if (write) {
          await prisma.activity.create({
            data: {
              title: activity.title,
              description: activity.description,
              category: activity.category.join(", "),
              borough: activity.borough,
              venue: activity.venue,
              address: activity.address,
              lat: coords.lat,
              lng: coords.lng,
              ageMin: activity.ageMin,
              ageMax: activity.ageMax,
              isFree: activity.isFree,
              priceMin: activity.priceMin,
              priceMax: activity.priceMax,
              startDate: new Date(activity.startDate),
              endDate: new Date(activity.endDate),
              times: activity.times ?? null,
              sourceName: activity.sourceName ?? source.name,
              sourceUrl: activity.sourceUrl,
              // Auto-discovered listings need a human to review before going live.
              status: "draft",
            },
          });
        }
        existingLower.add(activity.title.toLowerCase());
        inserted++;
      }
    }

    log(
      `Done. ${write ? "Inserted" : "Would insert"} ${inserted}, skipped ${skippedDuplicate} duplicates, ` +
        `${skippedInvalid} invalid, ${skippedGeocode} geocode failures, ${sourcesFetchFailed} sources unreachable.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
