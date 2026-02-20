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

- Minimize API/network calls (batch where possible, debounce uploads)
- Prefer refactoring over duplication
- Keep components small and focused
- Write clean, typed TypeScript — no `any`

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
│   ├── api/auth/google/
│   │   ├── route.ts              # Google OAuth handler
│   │   └── refresh-token/route.ts # Token refresh endpoint
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
│   │   └── useGoogleSheets.ts    # All Google Sheets logic
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
    ├── features/
    │   ├── habitsAndNotes/
    │   │   ├── habitsSlice.ts
    │   │   ├── notesSlice.ts
    │   │   ├── snapshotsSlice.ts
    │   │   └── thunks.ts
    │   └── googleSheets/
    │       ├── googleSheetsSlice.ts
    │       └── thunks.ts
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

1. User authenticates → refresh token stored in `localStorage`
2. On load: find or create `"My habits tracker"` spreadsheet via Drive API v3
3. Read existing data or populate from local state
4. On every state change: debounced (500ms) `batchUpdate` upload to Sheets API v4

**Spreadsheet format:**

- Row 0: category headers (`"Habits"`, `"Notes"`)
- Row 1: column names (habit/note names)
- Row 2+: daily rows — date in col 0, habit values as `"actual/needed"`, note texts

**Google State machine** (`src/app/types/googleState.ts`):
`NOT_CONNECTED` → `HAS_REFRESH_TOKEN` → `CONNECTED` / `ERROR`
During sync: `UPDATING`

**Key functions in `useGoogleSheets.ts`:**

- `makeAuthenticatedRequest()` — auto-refreshes access token when expired
- `getDataCheckEmpty()` — load from Sheets or create spreadsheet on first login
- `uploadDataToGoogle()` — debounced full sync to Sheets
- `populateSpreadsheetWithHabits()` — atomic `batchUpdate` write

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
