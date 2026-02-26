import { cookies } from "next/headers";
import { UserRefreshClient } from "google-auth-library";
import HabitsView from "./components/HabitsView";
import LoginView from "./components/LoginView";
import TimezoneDetector from "./components/TimezoneDetector";
import {
  findSpreadsheetByName,
  readSpreadsheetData,
  parseSpreadsheetRows,
  createSpreadsheet,
  SPREADSHEET_NAME,
} from "@/src/lib/googleSheets/googleSheetsApi";
import { computeTodayAndFillHistory } from "@/src/lib/habits/stateHelpers";

export default async function Page() {
  const store = await cookies();
  const refreshToken = store.get("google_refresh_token")?.value;
  const tz = store.get("tz")?.value ?? "UTC";

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

  if (!refreshToken) {
    return (
      <>
        <TimezoneDetector serverTz={tz} />
        <LoginView />
      </>
    );
  }

  try {
    // Access token: use cached cookie if still fresh, otherwise refresh
    let accessToken: string;
    const cachedToken = store.get("google_access_token")?.value;
    const tokenExpiry = Number(store.get("google_token_expiry")?.value ?? "0");

    if (cachedToken && tokenExpiry > Date.now() + 60_000) {
      accessToken = cachedToken;
    } else {
      const client = new UserRefreshClient(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        refreshToken
      );
      const { credentials } = await client.refreshAccessToken();
      accessToken = credentials.access_token!;
      // Note: page.tsx is a Server Component — it cannot set cookies.
      // The cache will be populated on the first Server Action call.
    }

    // Spreadsheet: use cached ID if available, otherwise find or create
    let spreadsheetId: string;
    let spreadsheetUrl: string;
    const cachedSpreadsheetId = store.get("google_spreadsheet_id")?.value;

    if (cachedSpreadsheetId) {
      spreadsheetId = cachedSpreadsheetId;
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    } else {
      let spreadsheet = await findSpreadsheetByName(accessToken, SPREADSHEET_NAME);
      if (!spreadsheet) {
        spreadsheet = await createSpreadsheet(accessToken, [], [], []);
      }
      spreadsheetId = spreadsheet.id;
      spreadsheetUrl = spreadsheet.url;
    }

    const rows = await readSpreadsheetData(accessToken, spreadsheetId);
    const { habits, notes, snapshots } = rows
      ? parseSpreadsheetRows(rows)
      : { habits: [], notes: [], snapshots: [] };

    const { todaySnapshot, allSnapshots } = computeTodayAndFillHistory(
      habits,
      notes,
      snapshots,
      todayStr
    );

    return (
      <>
        <TimezoneDetector serverTz={tz} />
        <HabitsView
          habits={habits}
          notes={notes}
          todaySnapshot={todaySnapshot}
          allSnapshots={allSnapshots}
          spreadsheetUrl={spreadsheetUrl}
          todayStr={todayStr}
        />
      </>
    );
  } catch {
    // Token expired or API error — show login
    return (
      <>
        <TimezoneDetector serverTz={tz} />
        <LoginView />
      </>
    );
  }
}
