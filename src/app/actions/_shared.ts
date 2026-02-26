import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { UserRefreshClient } from "google-auth-library";
import {
  findSpreadsheetByName,
  readSpreadsheetData,
  parseSpreadsheetRows,
  writeSpreadsheetData,
  SPREADSHEET_NAME,
} from "@/src/lib/googleSheets/googleSheetsApi";
import { computeTodayAndFillHistory } from "@/src/lib/habits/stateHelpers";
import IHabit from "@/src/lib/types/habit";
import INote from "@/src/lib/types/note";
import IDailySnapshot from "@/src/lib/types/dailySnapshot";

// ─────────────────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────────────────

export const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

export async function setCookie(name: string, value: string) {
  (await cookies()).set(name, value, COOKIE_OPTS);
}

export async function deleteCookie(name: string) {
  (await cookies()).delete(name);
}

// ─────────────────────────────────────────────────────────
// Server context (shared by all mutation actions)
// ─────────────────────────────────────────────────────────

export type ServerContext = {
  accessToken: string;
  spreadsheetId: string;
  todayStr: string;
};

export async function getServerContext(): Promise<ServerContext> {
  const store = await cookies();
  const refreshToken = store.get("google_refresh_token")?.value;
  const tz = store.get("tz")?.value ?? "UTC";

  if (!refreshToken) throw new Error("Not authenticated");

  // --- Access token: use cached or refresh ---
  let accessToken = store.get("google_access_token")?.value;
  const tokenExpiry = Number(store.get("google_token_expiry")?.value ?? "0");

  if (!accessToken || tokenExpiry <= Date.now() + 60_000) {
    const client = new UserRefreshClient(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      refreshToken
    );
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) throw new Error("Token refresh failed");

    accessToken = credentials.access_token;
    const maxAge = credentials.expiry_date
      ? Math.max(0, Math.floor((credentials.expiry_date - Date.now()) / 1000))
      : 3600;
    store.set("google_access_token", accessToken, { ...COOKIE_OPTS, maxAge });
    store.set("google_token_expiry", String(credentials.expiry_date ?? Date.now() + maxAge * 1000), {
      ...COOKIE_OPTS,
      maxAge,
    });
  }

  // --- Spreadsheet ID: use cached or lookup ---
  let spreadsheetId = store.get("google_spreadsheet_id")?.value;

  if (!spreadsheetId) {
    const spreadsheet = await findSpreadsheetByName(accessToken, SPREADSHEET_NAME);
    if (!spreadsheet) throw new Error("Spreadsheet not found");
    spreadsheetId = spreadsheet.id;
    store.set("google_spreadsheet_id", spreadsheetId, COOKIE_OPTS);
  }

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  return { accessToken, spreadsheetId, todayStr };
}

/** Read + parse current Sheets data, compute today's snapshot, return full mutable state. */
export async function readState(ctx: ServerContext) {
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
export async function commitState(
  ctx: ServerContext,
  habits: IHabit[],
  notes: INote[],
  snapshots: IDailySnapshot[]
) {
  await writeSpreadsheetData(ctx.accessToken, ctx.spreadsheetId, habits, notes, snapshots);
  revalidatePath("/");
}
