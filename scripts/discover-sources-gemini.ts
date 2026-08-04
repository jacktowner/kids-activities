/**
 * Periodic (monthly) companion to refresh-activities-gemini.ts: asks Gemini to
 * suggest new "what's on" hub pages (council/museum/park/festival sites) that
 * aren't already in scripts/gemini-sources.json, biased towards boroughs the DB
 * currently has little or no coverage of, then independently verifies each
 * suggestion by actually fetching it before trusting it.
 *
 * This does NOT use Google Search grounding (that requires a billing-enabled
 * Gemini project, see refresh-activities-gemini.ts) — Gemini is only asked to
 * recall plausible URLs from its training knowledge, which may be wrong or
 * outdated. Every candidate is fetched and must return real, substantial page
 * content before it's added, so a hallucinated or dead URL is simply discarded
 * rather than trusted.
 *
 * Usage:
 *   npx tsx scripts/discover-sources-gemini.ts            # dry run, prints candidates + validation result
 *   npx tsx scripts/discover-sources-gemini.ts --write     # actually appends validated sources to the JSON file
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const ROOT = join(__dirname, "..");
const SOURCES_FILE = join(ROOT, "scripts", "gemini-sources.json");
const MAX_NEW_SOURCES_PER_RUN = 5;

const LONDON_BOROUGHS = [
  "Barking and Dagenham", "Barnet", "Bexley", "Brent", "Bromley", "Camden",
  "City of London", "Croydon", "Ealing", "Enfield", "Greenwich", "Hackney",
  "Hammersmith and Fulham", "Haringey", "Harrow", "Havering", "Hillingdon",
  "Hounslow", "Islington", "Kensington and Chelsea", "Kingston upon Thames",
  "Lambeth", "Lewisham", "Merton", "Newham", "Redbridge",
  "Richmond upon Thames", "Southwark", "Sutton", "Tower Hamlets",
  "Waltham Forest", "Wandsworth", "Westminster",
];

type Source = { name: string; url: string; addedAt: string };

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

function loadSources(): Source[] {
  return JSON.parse(readFileSync(SOURCES_FILE, "utf-8"));
}

function saveSources(sources: Source[]) {
  writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + "\n");
}

async function underrepresentedBoroughs(prisma: PrismaClient): Promise<string[]> {
  const counts = await prisma.activity.groupBy({ by: ["borough"], _count: true });
  const byBorough = new Map(counts.map((c) => [c.borough, c._count]));
  return LONDON_BOROUGHS.filter((b) => (byBorough.get(b) ?? 0) < 3);
}

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
    const waitSeconds = parseRetryAfterSeconds(await res.text());
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    return callGemini(apiKey, prompt, attempt + 1);
  }

  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 500)}`);
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

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A candidate is only trusted if it's fetchable AND its content actually looks
// like a family/events listing page, not just any page that happens to 200.
const CONTENT_KEYWORDS = ["famil", "kid", "child", "event", "holiday", "half term", "half-term", "what's on", "whats on", "activit"];

async function validateCandidate(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const text = htmlToText(await res.text()).toLowerCase();
    if (text.length < 500) return false;
    return CONTENT_KEYWORDS.some((kw) => text.includes(kw));
  } catch {
    return false;
  }
}

async function main() {
  const write = process.argv.includes("--write");
  const apiKey = loadApiKey();
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  const log = (msg: string) => {
    console.log(msg);
    try {
      mkdirSync(join(ROOT, "logs"), { recursive: true });
      appendFileSync(join(ROOT, "logs", "gemini-discover.log"), `[${new Date().toISOString()}] ${msg}\n`);
    } catch {
      // logging is best-effort
    }
  };

  try {
    const sources = loadSources();
    const existingUrls = new Set(sources.map((s) => s.url));
    const gaps = await underrepresentedBoroughs(prisma);

    log(`Starting source discovery (${write ? "WRITE" : "DRY RUN"}). Underrepresented boroughs: ${gaps.join(", ") || "(none)"}`);

    const prompt = `I run a London kids/family activity finder website that regularly scrapes \
"what's on" hub pages (council pages, museums, galleries, parks, festivals, libraries, \
leisure centres) for real, current family-friendly events and activities.

Here are hub pages I already check (do not suggest these again):
${sources.map((s) => `- ${s.name}: ${s.url}`).join("\n")}

These London boroughs currently have little or no coverage in my source list — please \
prioritise suggestions for these boroughs where you can: ${gaps.join(", ") || "(none, all covered)"}

Suggest up to 10 NEW "what's on" / family activities / events hub page URLs (not individual \
one-off event pages — recurring hub pages that list current activities and get updated over \
time) from official council, museum, gallery, park, leisure centre, library or festival \
websites in Greater London. It's fine if some of your URL guesses turn out to be wrong or \
outdated — I will independently verify each one by fetching it before using it, so just give \
your best guesses rather than omitting uncertain ones.

Respond with ONLY a raw JSON array (no markdown fences, no commentary), each element:
{ "name": string (organisation name), "url": string (the hub page URL) }`;

    const text = await callGemini(apiKey, prompt);
    const rawCandidates = extractJsonArray(text) as { name?: unknown; url?: unknown }[];

    let added = 0;
    let rejected = 0;
    let skippedExisting = 0;

    for (const raw of rawCandidates) {
      if (added >= MAX_NEW_SOURCES_PER_RUN) break;
      if (typeof raw.name !== "string" || typeof raw.url !== "string" || !/^https?:\/\//.test(raw.url)) {
        rejected++;
        continue;
      }
      if (existingUrls.has(raw.url)) {
        skippedExisting++;
        continue;
      }

      const valid = await validateCandidate(raw.url);
      if (!valid) {
        log(`  ✗ rejected (unreachable or not a listing page): ${raw.name} — ${raw.url}`);
        rejected++;
        continue;
      }

      log(`  + accepted: ${raw.name} — ${raw.url}`);
      if (write) {
        sources.push({ name: raw.name, url: raw.url, addedAt: new Date().toISOString().slice(0, 10) });
        existingUrls.add(raw.url);
      }
      added++;
    }

    if (write && added > 0) saveSources(sources);

    log(
      `Done. ${write ? "Added" : "Would add"} ${added} sources, rejected ${rejected}, ` +
        `skipped ${skippedExisting} already-known.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
