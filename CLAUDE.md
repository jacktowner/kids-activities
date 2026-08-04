@AGENTS.md

# Project overview

A London kids-activities finder (originally South London-only, now covering all Greater
London boroughs): parents search/filter holiday clubs, camps and drop-in activities by
borough, category, age, price and date, browse them as cards or on a map, and view a
dedicated detail page per activity. There's a password-gated admin console for managing
listings (create/edit/delete, mark as featured).

## Stack

- Next.js 16.2.11, App Router, React 19.
- Prisma 7 + SQLite, via `@prisma/adapter-better-sqlite3` (Prisma 7 requires an adapter —
  there is no `url` in the `datasource` block; the connection string is passed to the
  adapter in `src/lib/prisma.ts` instead). Adapter class is `PrismaBetterSqlite3` (note
  capitalization — not `PrismaBetterSQLite3`).
- Generated Prisma client lives at `src/generated/prisma/` (not the default
  `node_modules/.prisma`), imported as `@/generated/prisma/client`.
- DB file is `dev.db` at the project root (not `prisma/dev.db`);
  `DATABASE_URL="file:./dev.db"` in `.env`.
- Leaflet + react-leaflet for maps, loaded client-side only (`dynamic(..., { ssr: false })`)
  since Leaflet touches `window`.
- Tailwind CSS v4 (`@tailwindcss/postcss`), dark mode via a `.dark` class toggled by
  `ThemeToggle` + an inline `beforeInteractive` script in `layout.tsx` (avoids a flash of
  wrong theme).

## Next.js 16 breaking changes seen in this codebase (heed `AGENTS.md`)

- `middleware.ts` has been renamed/replaced: this project uses `src/proxy.ts` (exporting
  `proxy()` + a `config.matcher`), not `middleware.ts`. Confirmed against
  `node_modules/next/dist/docs/02-pages/04-api-reference/02-file-conventions/proxy.md`.
- Route `searchParams` (and `params`) are `Promise`s in Server Components — must be
  `await`ed (e.g. `src/app/admin/page.tsx`'s `Props = { searchParams: Promise<{...}> }`).
- The project's ESLint config enforces stricter React rules than plain React/Next docs
  assume (likely React Compiler mode):
  - `react-hooks/set-state-in-effect` — flags synchronous `setState` inside a `useEffect`
    body.
  - `react-hooks/refs` — flags reading/writing `ref.current` **during render**, which
    forbids the classic react.dev "compare a ref to a prop to reset state" pattern. The
    working alternative used in this codebase: extract the state into a child component
    and `key` it by the signature that should reset it, so a remount does the reset
    instead (see `ActivityListPanel` in `src/components/ExplorePage.tsx`).
- Before writing Next.js code that feels like "standard" App Router usage, check
  `node_modules/next/dist/docs/` — training data assumptions about Next.js APIs and
  conventions may not hold in this version.

## Data model (`prisma/schema.prisma`)

`Activity` model: `title`, `description`, `category`, `borough`, `venue`,
`address`, `lat`/`lng`, `ageMin`/`ageMax`, `isFree`, `priceMin`/`priceMax`, `startDate`/
`endDate`, `times`, `sourceName`/`sourceUrl` (link to the original listing), `imageUrl`,
`featured` (boolean — pins the activity to the top of listings regardless of sort order),
`ownerId` (nullable — `null` for admin-created rows, set for user-submitted listings).
`User` (email/passwordHash/passwordSalt, scrypt-hashed) and `Session` (opaque random
token = the cookie value, DB-backed so logout actually revokes it) support regular-user
accounts.

## Two parallel auth systems — do not conflate them

- **Admin** (`src/lib/auth.ts`): one shared password (`ADMIN_PASSWORD` env var), cookie
  `admin_session` = a *deterministic* sha256 of that password (same value every login, no
  DB row, can't be revoked short of changing the password). Gates `/admin/*`.
- **Regular users** (`src/lib/user-auth.ts`): real per-user accounts, scrypt password
  hashing, cookie `user_session` = a random per-login token stored in the `Session` table
  (revocable — logout deletes the row). Gates `/account/*`.
- `src/lib/request-actor.ts`'s `resolveActor(request)` is the single place that resolves
  "who is making this request" (`admin` / `user` / `none`) — every mutating API route
  (`/api/activities*`, `/api/geocode`, `/api/admin/upload`) uses this instead of checking
  either cookie directly. Admin wins if both cookies happen to be valid. Regular users can
  only PATCH/DELETE activities where `ownerId` matches their own id (enforced in the
  Prisma `where` clause, not a separate read-then-check); admins bypass that check
  entirely. "Featured" is admin-only — forced to `false` server-side for non-admin writes
  regardless of what the client sends.
- `src/proxy.ts` gates both `/admin/:path*` and `/account/:path*`, but the `/account`
  branch only checks *cookie presence* (no DB call) — real validation happens in each
  page/route via `getSessionUser`. This is deliberate: the admin check is a pure
  no-I/O comparison, safe wherever `proxy.ts` runs, but the user-session check is
  DB-backed (Prisma), which may not be safe to call from the same place. Treat the proxy's
  `/account` gate as a UX nicety, not the security boundary.
- `src/components/admin/ActivityForm.tsx` is shared by both consoles via `hideFeatured`
  and `redirectTo` props — `/account/*` pages pass `hideFeatured redirectTo="/account"`.

## Key files

- `src/app/page.tsx` → renders `src/components/ExplorePage.tsx`, the main client-side
  search/filter/list/map experience.
- `src/components/FilterPanel.tsx` — search, "When"/"Where" (borough), child's age,
  free-only + price slider, in a collapsible "more filters" section.
- `src/components/ExplorePage.tsx` — owns filters/sort/view state; `sortActivities()`
  sorts by name/date/price/subjects while always pinning `featured` activities first;
  `ActivityListPanel` implements infinite scroll (windows the already-fetched list via
  `IntersectionObserver`, `PAGE_SIZE = 12`), keyed by the filter+sort signature so it
  remounts (and resets pagination) when either changes.
- `src/app/activity/[id]/page.tsx` — dedicated per-activity detail page (map, full
  description, link to the original source).
- `src/app/admin/*` — password-gated console: sortable listings table
  (`?sort=&dir=` search params, `src/app/admin/page.tsx`), create/edit form
  (`src/components/admin/ActivityForm.tsx`, includes the "featured" checkbox), delete.
- `src/lib/auth.ts` — cookie-based admin session (`ADMIN_COOKIE = "admin_session"`,
  `sessionToken()`/`checkPassword()`/`isValidSessionCookie()`), password from
  `ADMIN_PASSWORD` env var. Login via `POST /api/admin/login`; `src/proxy.ts` gates all
  `/admin/*` routes except `/admin/login`.
- `src/app/api/activities/route.ts` — public listing API; `GET` supports
  `q`/`borough`/`category`/`age`/`freeOnly`/`priceMax`/`dateFrom`/`dateTo` query params,
  always orders `featured` first then `startDate` ascending, and always excludes activities
  whose `endDate` is in the past (expired listings never show, independent of any date
  filter passed in — see `where.AND` in that file); `POST` requires any authenticated actor
  (admin or user, via `resolveActor`), not admin-only.
- `public/illustrations/kids-playing.svg` — unDraw "Children" illustration, recolored to
  the site's teal accent and given a low opacity, used as a fixed background image
  (wired in `src/app/globals.css`).
- `src/app/account/*` — password-gated-per-user console (signup/login/dashboard/new/edit)
  so regular visitors can submit and manage their own listings; publishes immediately, no
  admin approval queue. See "Two parallel auth systems" above.

## Automated daily listing refresh (Gemini + system crontab)

Two standalone scripts, run via the *system* crontab (not an in-process scheduler —
`crontab -l` on this machine, entries live alongside two unrelated jobs from
`~/contract-jobs`). Both use the free-tier Gemini API (`GEMINI_API_KEY` in `.env`, loaded
by the scripts themselves since cron's environment won't have it exported) via plain
`generateContent` REST calls — **not** Google Search grounding, which returned
`429 RESOURCE_EXHAUSTED` on this key because grounding requires a billing-enabled Gemini
project. Everything here works on the free tier by having the scripts do their own
fetching instead of asking Gemini to browse.

- `scripts/refresh-activities-gemini.ts` — runs daily at 5am
  (`0 5 * * * cd ... && npx tsx scripts/refresh-activities-gemini.ts --write --limit=15`,
  logs to `logs/gemini-refresh.log`). First flips any activity whose `endDate` has passed
  to `status: "expired"` (so it drops out of the public listing regardless of whether the
  rest of the run finds anything). Then fetches each URL in `scripts/gemini-sources.json`,
  strips it to plain text, and asks Gemini to extract real, non-expired, family-friendly
  activities from *only* that text (so `sourceUrl` is always a page the script actually
  fetched, never a Gemini-invented URL). Validates every field, skips anything already in
  the DB (by title) or missing an allowed category/valid dates, geocodes via the same
  Nominatim cascade as `src/app/api/geocode/route.ts`, then inserts directly via Prisma
  with `status: "draft"` — auto-discovered listings need an admin to review and hit
  "Publish" in `/admin` before they appear on the public site (see "Activity status" below).
  It does **not** touch `prisma/seed.ts` (that file is model-of-the-original-30 record
  only; see the destructive-`main()` warning above, still applies to any other script).
  Default is a dry run (prints what it would insert/expire); needs `--write` to actually
  write. Retries once-per-minute-limit 429s using the API's own "retry in Xs" hint, and
  paces itself (~3.5s between sources) to stay under the free tier's 20 requests/minute cap.
- `scripts/discover-sources-gemini.ts` — runs weekly (Mondays, 4am), grows the source list
  over time so it isn't a fixed hardcoded set forever. Asks Gemini (from training
  knowledge only, since grounding isn't available) to suggest new "what's on" hub-page
  URLs, biased toward London boroughs with `<3` activities in the DB, then **independently
  verifies every suggestion by fetching it** (must return real content with
  family/event-ish keywords) before appending it to `scripts/gemini-sources.json` — a
  hallucinated or dead URL from Gemini is simply discarded, never trusted. Also defaults to
  dry run; needs `--write`. Capped at 5 new sources/run.
- Both scripts fetch pages with a browser-like `User-Agent`; some sites (British Museum,
  Science Museum as of this writing) still 403/block them — treated as an expected,
  logged-and-skipped source, not an error.

## Activity status: draft / published / expired

`Activity.status` (plain `String @default("published")`, not a Prisma enum — SQLite's
connector doesn't support native enums, same reasoning as the free-text `category`/
`borough` fields; validated in the app instead via `ActivityStatus` in
`src/types/activity.ts` and `ALLOWED_STATUSES` in `src/lib/activity-input.ts`).

- **Public site** (`GET /api/activities`) only ever returns `status: "published"` (plus
  the pre-existing `endDate >= today` backstop) — drafts and expired listings never show.
- **Admin/user-created listings still publish immediately** — `toActivityData` defaults to
  `"published"` when the client doesn't send a status, and regular-user writes force
  `status: "published"` server-side (`src/app/api/activities/route.ts` POST,
  `src/app/api/activities/[id]/route.ts` PATCH), mirroring how `featured` is forced to
  `false` for non-admins. Only admin can set `draft`/`expired` manually, via the status
  dropdown in `ActivityForm` (hidden on `/account/*` forms via the existing `hideFeatured`
  prop — same prop now also hides the status control and forces `published`).
- **Auto-discovered listings start as `draft`** (see `refresh-activities-gemini.ts` above)
  — they need a human to hit "Publish" in `/admin` before they're public.
- `src/app/admin/page.tsx` has status filter tabs (`?status=all|published|draft|expired`)
  and a status badge per row; `PublishActivityButton` does a quick
  `PATCH /api/activities/[id]/status` (a separate, minimal endpoint —
  `PATCH /api/activities/[id]` always rebuilds the *entire* record from
  `toActivityData`, so it can't be used for a single-field change without re-sending every
  other field too).

# Session management

This project's conversations tend to run long (many sequential feature requests in one thread), which triggers frequent auto-compaction. To reduce it:

- Prefer starting a new session (`/clear`) per distinct task or feature rather than continuing one long-running conversation. Nothing is lost — completed work is in git, and CLAUDE.md/memory carry over.
- Delegate exploratory/read-heavy work (searching for code, reading many files) to subagents so raw file contents and search results don't pile up in the main context.
- Avoid re-reading large files repeatedly once their contents are already known in-session.
