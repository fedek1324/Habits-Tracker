# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Product

A personal habit tracker for tracking daily habits — how many times per day a habit was done vs. the target. Works on any device (desktop, mobile, tablet) via the browser. Users connect their Google account once, and all data syncs automatically to a personal Google Spreadsheet so habits are accessible from any device at any time.

Key features:

- Add habits with a daily target count (e.g. "Read — 1×/day", "Push-ups — 3×/day")
- Increment habit counter with one tap
- Add daily notes
- View history of past days
- Cross-device sync via Google Sheets

## Workflow Rules

- **Always push after every change** — commit and `git push` after completing any task.

## Development Commands

- `npm run dev` — dev server with Turbopack
- `npm run dev0000` — dev server on all interfaces (0.0.0.0)
- `npm run build` — production build
- `npm start` — start production server
- `npm run lint` — lint code

## Project Overview

Next.js 15 habit tracker app. Google Sheets is the only storage — no database, no localStorage.
Google auth is always required.

## Architecture Principles

- Write clean, well-architected code — always think about structure before implementing
- After adding a new feature, refactor: simplify logic, reduce complexity, improve code structure
- Minimize API/network calls (batch where possible)
- Prefer refactoring over duplication
- Keep components small and focused
- Write clean, typed TypeScript — no `any`
- Add comments only for genuinely complex or non-obvious logic — do not comment self-explanatory code

## Tech Stack

- **Next.js 15** with App Router (`src/app/`)
- **React 19** — `useOptimistic` + `useTransition` for instant UI feedback
- **TypeScript** (strict mode)
- **Tailwind CSS** — styling + pastel color generation via HSL
- **React Icons** — icons
- **Axios** — HTTP requests (OAuth code exchange)
- **@react-oauth/google** — Google OAuth 2.0
- **google-auth-library** — `UserRefreshClient` for server-side token refresh

## Architecture: Server-first with useOptimistic

**No Redux. No SWR. No localStorage.**

```text
Page load:
  cookies (google_refresh_token + tz) → Server Component (page.tsx)
  → UserRefreshClient.refresh() → findSpreadsheetByName → readSpreadsheetData
  → parseSpreadsheetRows + computeTodayAndFillHistory (using tz cookie)
  → render full HTML with today's habits

Mutation (e.g. increment):
  user clicks → useOptimistic updates UI instantly (zero latency)
  → Server Action: refresh token → findSpreadsheetByName → read → mutate → write Sheets
  → revalidatePath('/') → Server Component re-renders with authoritative data
```

## Cookies

All cookies: `httpOnly`, `secure` in production, `sameSite: lax`, 30-day expiry.

- `google_refresh_token` — OAuth refresh token, set by `loginAction`
- `tz` — IANA timezone string (e.g. `"Europe/Moscow"`), set by `TimezoneDetector`

## Directory Structure

```text
src/
├── app/
│   ├── api/auth/google/
│   │   ├── route.ts              # POST — exchanges OAuth code for tokens
│   │   └── refresh-token/route.ts # POST — refreshes access token (legacy, unused)
│   ├── components/
│   │   ├── HabbitButton.tsx      # Single habit UI (increment / edit / delete)
│   │   ├── AddHabbit.tsx         # Add habit form
│   │   ├── NoteButton.tsx        # Single note UI
│   │   ├── AddNote.tsx           # Add note form
│   │   ├── HistoryView.tsx       # Historical snapshots view
│   │   ├── BottomNavigation.tsx  # Today / History tab switch
│   │   ├── LoginView.tsx         # Shown when not authenticated
│   │   ├── TimezoneDetector.tsx  # Sets tz cookie on mount (no visible UI)
│   │   └── Modal.tsx             # Reusable modal wrapper
│   ├── helpers/
│   │   └── date.ts               # getDateString(), getDate00()
│   ├── types/
│   │   ├── habbit.ts             # IHabbit
│   │   ├── dailySnapshot.ts      # IDailySnapshot
│   │   ├── note.ts               # INote
│   │   └── habitsData.ts         # IHabitsData (combined payload)
│   ├── actions.ts                # All Server Actions (auth + habits + notes)
│   ├── HabitsView.tsx            # Client Component — useOptimistic + handlers
│   ├── page.tsx                  # Async Server Component — fetches & renders habits
│   └── layout.tsx
└── lib/
    ├── googleSheets/
    │   └── googleSheetsApi.ts    # Google Sheets utilities (read/write/parse)
    └── habits/
        └── stateHelpers.ts       # computeTodayAndFillHistory, buildEmptySnapshot
```

## Server Actions (`src/app/actions.ts`)

Auth:

- `loginAction(refreshToken)` — stores `google_refresh_token` cookie only (no Google API calls)
- `logoutAction()` — clears `google_refresh_token` cookie
- `setTimezoneAction(tz)` — stores `tz` cookie

Habits / Notes — each action follows this pattern:

1. Read `google_refresh_token` + `tz` from cookies
2. `UserRefreshClient.refreshAccessToken()` → fresh `accessToken`
3. `findSpreadsheetByName(accessToken, SPREADSHEET_NAME)` — look up spreadsheet by name every time (no cached ID)
4. `readSpreadsheetData` → `parseSpreadsheetRows` → `computeTodayAndFillHistory`
5. Apply mutation in memory
6. `writeSpreadsheetData` — full batchUpdate
7. `revalidatePath('/')` — triggers server re-render

## Data Models

```typescript
// src/app/types/habbit.ts
interface IHabbit {
  id: string;   // deterministic hash of habit name (stable across parses)
  text: string; // Habit name = spreadsheet column header
}

// src/app/types/note.ts
interface INote {
  id: string;   // deterministic hash of note name
  name: string; // Note name = spreadsheet column header
}

// src/app/types/dailySnapshot.ts
interface IDailySnapshot {
  date: string; // "YYYY-MM-DD"
  habbits: Array<{
    habbitId: string;
    habbitNeedCount: number;
    habbitDidCount: number;
  }>;
  notes: Array<{
    noteId: string;
    noteText: string;
  }>;
}
```

**Important:** Habit/note IDs are derived from column names via `stableId()` (FNV-1a hash) in
`parseSpreadsheetRows`. They are NOT random UUIDs — this is required so Server Actions can match
client-side IDs to freshly-parsed server-side data.

## Google Sheets Format

- Row 0: category headers (`"Habits"`, `"Notes"`)
- Row 1: column names (habit/note names)
- Row 2+: daily rows — date in col 0, habit values as `"actual/needed"`, note texts

**Deletion vs. empty text invariant** (enforced in `googleSheetsApi.ts`):

The column for a habit/note always stays in Sheets (needed for history display).
Distinction is made by the **cell value**:

- `"actual/needed"` (habit) / any text (note) — item recorded that day
- `"0/needed"` (habit) / `"No text for that day"` (note) — item exists, nothing recorded (sentinel)
- `""` empty cell — item was deleted from this day's snapshot

Rules:

- **`writeSpreadsheetData`**: item present in snapshot → always write cell (use sentinel for empty note text). Item absent → cell stays empty.
- **`parseSpreadsheetRows`**: empty cell → item excluded from snapshot. Sentinel → item included with empty `noteText`.
- **`computeTodayAndFillHistory`**: copies items from last snapshot with reset values → become sentinel on next write → item survives into future days.

## Component Patterns

- Modal-based forms for all CRUD (add/edit habits, notes)
- `useOptimistic` for instant UI — mutations appear immediately, server confirms asynchronously
- Pastel colors generated from habit ID via HSL
- Form validation with per-field error states

## Date & Timezone

- `tz` cookie (IANA timezone string) set by `TimezoneDetector` component on first visit
- Server uses `new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date())` to get `"YYYY-MM-DD"`
- First visit falls back to UTC; `TimezoneDetector` corrects it immediately

## Path Alias

`@/*` maps to `src/*`
