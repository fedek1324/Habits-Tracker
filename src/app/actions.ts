"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { UserRefreshClient } from "google-auth-library";
import {
  findSpreadsheetByName,
  readSpreadsheetData,
  parseSpreadsheetRows,
  writeSpreadsheetData,
  createSpreadsheet,
  SPREADSHEET_NAME,
} from "@/src/lib/googleSheets/googleSheetsApi";
import { computeTodayAndFillHistory } from "@/src/lib/habits/stateHelpers";
import IHabbit from "@/src/app/types/habbit";
import INote from "@/src/app/types/note";
import IDailySnapshot from "@/src/app/types/dailySnapshot";

// ─────────────────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────────────────

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

async function setCookie(name: string, value: string) {
  (await cookies()).set(name, value, COOKIE_OPTS);
}

async function deleteCookie(name: string) {
  (await cookies()).delete(name);
}

// ─────────────────────────────────────────────────────────
// Server context (shared by all mutation actions)
// ─────────────────────────────────────────────────────────

type ServerContext = {
  accessToken: string;
  spreadsheetId: string;
  todayStr: string;
};

async function getServerContext(): Promise<ServerContext> {
  const store = await cookies();
  const refreshToken = store.get("google_refresh_token")?.value;
  const spreadsheetId = store.get("spreadsheet_id")?.value;
  const tz = store.get("tz")?.value ?? "UTC";

  if (!refreshToken || !spreadsheetId) throw new Error("Not authenticated");

  const client = new UserRefreshClient(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    refreshToken
  );
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error("Token refresh failed");

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

  return { accessToken: credentials.access_token, spreadsheetId, todayStr };
}

/** Read + parse current Sheets data, compute today's snapshot, return full mutable state. */
async function readState(ctx: ServerContext) {
  const rows = await readSpreadsheetData(ctx.accessToken, ctx.spreadsheetId);
  const { habits, notes, snapshots } = rows
    ? parseSpreadsheetRows(rows)
    : { habits: [], notes: [], snapshots: [] };
  const { todaySnapshot, allSnapshots } = computeTodayAndFillHistory(
    habits,
    notes,
    snapshots,
    ctx.todayStr
  );
  return { habits, notes, todaySnapshot, allSnapshots };
}

/** Write full state back to Sheets and trigger page revalidation. */
async function commitState(
  ctx: ServerContext,
  habits: IHabbit[],
  notes: INote[],
  snapshots: IDailySnapshot[]
) {
  await writeSpreadsheetData(ctx.accessToken, ctx.spreadsheetId, habits, notes, snapshots);
  revalidatePath("/");
}

// ─────────────────────────────────────────────────────────
// Auth actions
// ─────────────────────────────────────────────────────────

export async function loginAction(
  refreshToken: string,
  accessToken: string
): Promise<void> {
  // Refresh to get a guaranteed-fresh token
  const client = new UserRefreshClient(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    refreshToken
  );
  const { credentials } = await client.refreshAccessToken();
  const freshToken = credentials.access_token ?? accessToken;

  // Find or create spreadsheet
  let spreadsheet = await findSpreadsheetByName(freshToken, SPREADSHEET_NAME);
  if (!spreadsheet) {
    spreadsheet = await createSpreadsheet(freshToken, [], [], []);
  }

  await setCookie("google_refresh_token", refreshToken);
  await setCookie("spreadsheet_id", spreadsheet.id);
  await setCookie("spreadsheet_url", spreadsheet.url);

  revalidatePath("/");
}

export async function logoutAction(): Promise<void> {
  await deleteCookie("google_refresh_token");
  await deleteCookie("spreadsheet_id");
  revalidatePath("/");
}

export async function setTimezoneAction(tz: string): Promise<void> {
  await setCookie("tz", tz);
  revalidatePath("/");
}

// ─────────────────────────────────────────────────────────
// Habit actions
// ─────────────────────────────────────────────────────────

export async function incrementHabitAction(
  habitId: string,
  newCount: number
): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    habbits: todaySnapshot.habbits.map((h) =>
      h.habbitId === habitId ? { ...h, habbitDidCount: newCount } : h
    ),
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, habits, notes, updatedSnapshots);
}

export async function addHabitAction(
  habit: IHabbit,
  needCount: number
): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedHabits = [...habits, habit];
  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    habbits: [
      ...todaySnapshot.habbits,
      { habbitId: habit.id, habbitNeedCount: needCount, habbitDidCount: 0 },
    ],
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, updatedHabits, notes, updatedSnapshots);
}

export async function deleteHabitAction(habitId: string): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    habbits: todaySnapshot.habbits.filter((h) => h.habbitId !== habitId),
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, habits, notes, updatedSnapshots);
}

export async function editHabitAction(
  habit: IHabbit,
  needCount: number,
  actualCount: number
): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedHabits = habits.map((h) => (h.id === habit.id ? habit : h));
  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    habbits: todaySnapshot.habbits.map((h) =>
      h.habbitId === habit.id
        ? { ...h, habbitNeedCount: needCount, habbitDidCount: actualCount }
        : h
    ),
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, updatedHabits, notes, updatedSnapshots);
}

// ─────────────────────────────────────────────────────────
// Note actions
// ─────────────────────────────────────────────────────────

export async function addNoteAction(note: INote, text: string): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedNotes = [...notes, note];
  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    notes: [...todaySnapshot.notes, { noteId: note.id, noteText: text }],
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, habits, updatedNotes, updatedSnapshots);
}

export async function editNoteAction(
  noteId: string,
  newName: string,
  newText: string
): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedNotes = notes.map((n) =>
    n.id === noteId ? { ...n, name: newName } : n
  );
  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    notes: todaySnapshot.notes.map((n) =>
      n.noteId === noteId ? { ...n, noteText: newText } : n
    ),
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, habits, updatedNotes, updatedSnapshots);
}

export async function deleteNoteAction(noteId: string): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    notes: todaySnapshot.notes.filter((n) => n.noteId !== noteId),
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, habits, notes, updatedSnapshots);
}
