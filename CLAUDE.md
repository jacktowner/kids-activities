@AGENTS.md

# Project overview

A South London kids-activities finder: parents search/filter holiday clubs, camps and
drop-in activities by borough, category, age, price and date, browse them as cards or on
a map, and view a dedicated detail page per activity. There's a password-gated admin
console for managing listings (create/edit/delete, mark as featured).

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
  always orders `featured` first then `startDate` ascending; `POST` is admin-only.
- `public/illustrations/kids-playing.svg` — unDraw "Children" illustration, recolored to
  the site's teal accent and given a low opacity, used as a fixed background image
  (wired in `src/app/globals.css`).
- `src/app/account/*` — password-gated-per-user console (signup/login/dashboard/new/edit)
  so regular visitors can submit and manage their own listings; publishes immediately, no
  admin approval queue. See "Two parallel auth systems" above.

# Session management

This project's conversations tend to run long (many sequential feature requests in one thread), which triggers frequent auto-compaction. To reduce it:

- Prefer starting a new session (`/clear`) per distinct task or feature rather than continuing one long-running conversation. Nothing is lost — completed work is in git, and CLAUDE.md/memory carry over.
- Delegate exploratory/read-heavy work (searching for code, reading many files) to subagents so raw file contents and search results don't pile up in the main context.
- Avoid re-reading large files repeatedly once their contents are already known in-session.
