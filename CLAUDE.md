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
│   │   └── route.ts              # POST — exchanges OAuth code for tokens
│   ├── components/
│   │   ├── habits/
│   │   │   ├── HabitButton.tsx   # Single habit UI (increment / edit / delete)
│   │   │   └── AddHabit.tsx      # Add habit form
│   │   ├── notes/
│   │   │   ├── NoteButton.tsx    # Single note UI
│   │   │   └── AddNote.tsx       # Add note form
│   │   ├── HabitsView.tsx        # Client Component — useOptimistic + handlers
│   │   ├── HistoryView.tsx       # Historical snapshots view
│   │   ├── BottomNavigation.tsx  # Today / History tab switch
│   │   ├── LoginView.tsx         # Shown when not authenticated
│   │   ├── TimezoneDetector.tsx  # Sets tz cookie on mount (no visible UI)
│   │   └── Modal.tsx             # Reusable modal wrapper
│   ├── actions/
│   │   ├── _shared.ts            # getServerContext, readState, commitState, cookie helpers
│   │   ├── auth.ts               # loginAction, logoutAction, setTimezoneAction
│   │   ├── habits.ts             # increment/add/delete/editHabitAction
│   │   └── notes.ts              # add/edit/deleteNoteAction
│   ├── page.tsx                  # Async Server Component — fetches & renders habits
│   └── layout.tsx
└── lib/
    ├── types/
    │   ├── habit.ts              # IHabit
    │   ├── note.ts               # INote
    │   ├── dailySnapshot.ts      # IDailySnapshot
    │   └── habitsData.ts         # IHabitsAndNotesData (combined payload)
    ├── utils/
    │   └── date.ts               # getDateString(), getDate00()
    ├── googleSheets/
    │   └── googleSheetsApi.ts    # Google Sheets utilities (read/write/parse)
    └── habits/
        └── stateHelpers.ts       # computeTodayAndFillHistory, buildEmptySnapshot
```

## Server Actions (`src/app/actions/`)

Shared infrastructure (`_shared.ts` — not exported to client):

- `getServerContext()` — refresh token → access token → spreadsheet ID → today's date
- `readState(ctx)` — read Sheets → parse → compute today's snapshot
- `commitState(ctx, habits, notes, snapshots)` — write Sheets + revalidatePath('/')

Auth (`auth.ts`):

- `loginAction(refreshToken)` — stores `google_refresh_token` cookie only (no Google API calls)
- `logoutAction()` — clears `google_refresh_token` cookie
- `setTimezoneAction(tz)` — stores `tz` cookie

Habits / Notes — each action follows this pattern:

1. `getServerContext()` — refresh token, get access token, find spreadsheet, get today's date
2. `readState(ctx)` — read spreadsheet, parse rows, compute today's snapshot
3. Apply mutation in memory
4. `commitState(ctx, ...)` — write to Sheets, revalidatePath('/')

## Data Models

```typescript
// src/lib/types/habit.ts
interface IHabit {
  id: string;   // deterministic hash of habit name (stable across parses)
  text: string; // Habit name = spreadsheet column header
}

// src/lib/types/note.ts
interface INote {
  id: string;   // deterministic hash of note name
  name: string; // Note name = spreadsheet column header
}

// src/lib/types/dailySnapshot.ts
interface IDailySnapshot {
  date: string; // "YYYY-MM-DD"
  habits: Array<{
    habitId: string;
    habitNeedCount: number;
    habitDidCount: number;
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
