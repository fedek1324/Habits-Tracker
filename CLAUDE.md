# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Development Commands

- `npm run dev` — dev server with Turbopack
- `npm run dev0000` — dev server on all interfaces (0.0.0.0)
- `npm run build` — production build
- `npm start` — start production server
- `npm run lint` — lint code

## Project Overview

Next.js 15 habit tracker app with:

- **Local-first storage** — all data in `localStorage` via Redux + middleware
- **Google Sheets sync** — authenticated users sync their data to a personal Google Spreadsheet used as a backend
- **No database** — Google Sheets is the only remote storage

## Architecture Principles

- Write clean, well-architected code — always think about structure before implementing
- After adding a new feature, refactor: simplify logic, reduce complexity, improve code structure
- Minimize API/network calls (batch where possible, debounce uploads)
- Prefer refactoring over duplication
- Keep components small and focused
- Write clean, typed TypeScript — no `any`
- Add comments only for genuinely complex or non-obvious logic — do not comment self-explanatory code

## Tech Stack

- **Next.js 15** with App Router (`src/app/`)
- **React 19**
- **TypeScript** (strict mode)
- **Redux Toolkit** — global state, no other state library
- **Tailwind CSS** — styling + pastel color generation via HSL
- **React Icons** — icons
- **Axios** — HTTP requests to Google APIs
- **@react-oauth/google** — Google OAuth 2.0

## Directory Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── auth/google/
│   │   │   ├── route.ts              # Google OAuth handler (code → tokens)
│   │   │   └── refresh-token/route.ts # Token refresh endpoint
│   │   └── habits/
│   │       └── route.ts              # GET /api/habits — reads from Google Sheets (server-side)
│   ├── components/
│   │   ├── HabbitButton.tsx      # Single habit UI (increment / edit / delete)
│   │   ├── AddHabbit.tsx         # Add habit form
│   │   ├── NoteButton.tsx        # Single note UI
│   │   ├── AddNote.tsx           # Add note form
│   │   ├── HistoryView.tsx       # Historical snapshots view
│   │   ├── BottomNavigation.tsx  # Today / History tab switch
│   │   ├── IntegrationPannel.tsx # Google Sheets sync status & button
│   │   └── Modal.tsx             # Reusable modal wrapper
│   ├── helpers/
│   │   └── date.ts               # getDateString(), getDate00()
│   ├── hooks/
│   │   └── useHabitsSync.ts      # SWR hook — polls /api/habits every 30s, updates Redux
│   ├── services/
│   │   └── apiLocalStorage.ts    # localStorage CRUD layer
│   ├── types/
│   │   ├── habbit.ts             # IHabbit
│   │   ├── dailySnapshot.ts      # IDailySnapshot
│   │   ├── note.ts               # INote
│   │   ├── googleState.ts        # GoogleState enum
│   │   └── habitsData.ts         # IHabitsData (combined payload)
│   ├── page.tsx                  # Main page — orchestrates UI & sync
│   ├── layout.tsx
│   └── StoreProvider.tsx
└── lib/
    ├── googleSheets/
    │   └── googleSheetsApi.ts    # Shared Google API utilities (no "use client")
    ├── features/
    │   ├── habitsAndNotes/
    │   │   ├── habitsSlice.ts
    │   │   ├── notesSlice.ts
    │   │   ├── snapshotsSlice.ts
    │   │   └── thunks.ts
    │   └── googleSheets/
    │       ├── googleSheetsSlice.ts
    │       └── thunks.ts         # onLogin, uploadDataToGoogle, onLogout
    ├── middleware/
    │   └── localStorageMiddleware.ts  # Persists Redux state to localStorage
    ├── hooks.ts                       # Typed useAppSelector / useAppDispatch
    └── store.ts
```

## Data Models

```typescript
// src/app/types/habbit.ts
interface IHabbit {
  id: string;   // UUID
  text: string; // Habit name
}

// src/app/types/note.ts
interface INote {
  id: string;
  name: string;
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

## localStorage Keys

| Key               | Value                              |
|-------------------|------------------------------------|
| `habits`          | `IHabbit[]`                        |
| `notes`           | `INote[]`                          |
| `dailySnapshots`  | `IDailySnapshot[]` sorted by date  |
| `habitsResetDate` | `"YYYY-MM-DD"` — last daily reset  |

## Google Sheets Integration

**Flow:**

1. User authenticates → tokens dispatched to Redux, refresh token saved to `localStorage`
2. `useHabitsSync` SWR hook detects `refreshToken` in Redux → starts polling `GET /api/habits`
3. `GET /api/habits` (server-side): refreshes access token via `UserRefreshClient`, reads spreadsheet
4. If no spreadsheet: `uploadDataToGoogle` thunk creates it from local Redux state
5. On every data change: `uploadDataToGoogle` thunk writes to Sheets via `batchUpdate`
6. SWR revalidates every 30s and on window focus

**Spreadsheet format:**

- Row 0: category headers (`"Habits"`, `"Notes"`)
- Row 1: column names (habit/note names)
- Row 2+: daily rows — date in col 0, habit values as `"actual/needed"`, note texts

**Google State machine** (`src/app/types/googleState.ts`):
`NOT_CONNECTED` → `UPDATING` → `CONNECTED` / `ERROR`

**Key modules:**

- `src/lib/googleSheets/googleSheetsApi.ts` — shared utilities: `findSpreadsheetByName`, `readSpreadsheetData`, `parseSpreadsheetRows`, `writeSpreadsheetData`, `createSpreadsheet`
- `src/app/api/habits/route.ts` — server-side `GET /api/habits`, handles token refresh via `UserRefreshClient`
- `src/app/hooks/useHabitsSync.ts` — SWR polling hook (`refreshInterval: 30_000`)
- `src/lib/features/googleSheets/thunks.ts` — `onLogin`, `uploadDataToGoogle`, `onLogout`

## Component Patterns

- Modal-based forms for all CRUD (add/edit habits, notes)
- Optimistic UI updates — Redux state updates first, persistence follows
- Pastel colors generated from habit ID via HSL
- Form validation with per-field error states

## Date Utilities (`src/app/helpers/date.ts`)

- `getDateString(date)` → `"YYYY-MM-DD"`
- `getDate00(date)` → date normalized to 00:00:00 (for day comparisons)

## Path Alias

`@/*` maps to `src/*`
