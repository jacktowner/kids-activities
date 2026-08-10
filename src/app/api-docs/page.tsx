import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API | London Kids Activities",
  description: "Free public API for the London Kids Activities dataset.",
};

const PARAMS: Array<{ name: string; description: string }> = [
  { name: "q", description: "Free-text search across title, description and venue." },
  { name: "borough", description: "Comma-separated list of boroughs, e.g. Lambeth,Greenwich." },
  { name: "category", description: "A single category, e.g. Sports." },
  { name: "age", description: "Child's age in years; returns activities whose age range includes it." },
  { name: "freeOnly", description: "true to return only free activities." },
  { name: "priceMax", description: "Maximum price." },
  { name: "dateFrom", description: "ISO date (YYYY-MM-DD); excludes activities that end before this date." },
  { name: "dateTo", description: "ISO date (YYYY-MM-DD); excludes activities that start after this date." },
  { name: "limit", description: "Rows per request. Default 50, max 200." },
  { name: "offset", description: "Rows to skip, for paging through results." },
];

const EXAMPLE_RESPONSE = `{
  "activities": [
    {
      "id": "clx1a2b3c",
      "title": "Summer Art Camp",
      "description": "…",
      "category": "Arts, Crafts",
      "borough": "Lambeth",
      "venue": "Brixton Community Centre",
      "address": "…",
      "lat": 51.4613,
      "lng": -0.1156,
      "ageMin": 5,
      "ageMax": 11,
      "isFree": false,
      "priceMin": 20,
      "priceMax": 25,
      "startDate": "2026-08-17T00:00:00.000Z",
      "endDate": "2026-08-21T00:00:00.000Z",
      "times": "9am - 3pm",
      "sourceName": "Brixton Community Centre",
      "sourceUrl": "https://example.org/summer-art-camp",
      "imageUrl": null,
      "featured": false
    }
  ],
  "total": 137,
  "limit": 50,
  "offset": 0
}`;

export default function ApiDocsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 w-full flex-1 flex flex-col gap-8">
      <div className="space-y-2">
        <Link href="/" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
          &larr; Back to activities
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
          API
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
          A free, public, read-only API for the activities on this site. No API key or
          authentication required. Use it to pull our listings into your own site or app.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Endpoint</h2>
        <pre className="rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm p-3 overflow-x-auto">
          <code>GET /api/v1/activities</code>
        </pre>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Only published, non-expired activities are returned. All query parameters are
          optional and can be combined.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          Query parameters
        </h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Parameter</th>
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {PARAMS.map((p) => (
                <tr key={p.name}>
                  <td className="px-3 py-2 font-mono text-teal-700 dark:text-teal-400 whitespace-nowrap align-top">
                    {p.name}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {p.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          Example response
        </h2>
        <pre className="rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm p-3 overflow-x-auto">
          <code>{EXAMPLE_RESPONSE}</code>
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Notes</h2>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
          <li>Responses are JSON, CORS-enabled for use from browser JavaScript.</li>
          <li>This is a best-effort hobby project — no uptime guarantee, and the response shape may gain new fields over time (existing fields won&apos;t be removed or repurposed without notice here).</li>
          <li>Please link back to this site if you display the data publicly.</li>
        </ul>
      </section>
    </div>
  );
}
