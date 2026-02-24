import { cookies } from "next/headers";
import { UserRefreshClient } from "google-auth-library";
import HabitsView from "./HabitsView";
import LoginView from "./components/LoginView";
import TimezoneDetector from "./components/TimezoneDetector";
import { readSpreadsheetData, parseSpreadsheetRows } from "@/src/lib/googleSheets/googleSheetsApi";
import { computeTodayAndFillHistory } from "@/src/lib/habits/stateHelpers";

export default async function Page() {
  const store = await cookies();
  const refreshToken = store.get("google_refresh_token")?.value;
  const spreadsheetId = store.get("spreadsheet_id")?.value;
  const tz = store.get("tz")?.value ?? "UTC";

  // Not authenticated — show login screen
  if (!refreshToken || !spreadsheetId) {
    return (
      <>
        <TimezoneDetector serverTz={tz} />
        <LoginView />
      </>
    );
  }

  // Compute today's date string using client timezone
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

  try {
    // Refresh access token server-side
    const client = new UserRefreshClient(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      refreshToken
    );
    const { credentials } = await client.refreshAccessToken();
    const accessToken = credentials.access_token!;

    // Read and parse Sheets data
    const rows = await readSpreadsheetData(accessToken, spreadsheetId);
    const { habits, notes, snapshots } = rows
      ? parseSpreadsheetRows(rows)
      : { habits: [], notes: [], snapshots: [] };

    // Compute today's snapshot and fill any gaps in history
    const { todaySnapshot, allSnapshots } = computeTodayAndFillHistory(
      habits,
      notes,
      snapshots,
      todayStr
    );

    // Spreadsheet URL from cookie (set during login)
    const spreadsheetUrl = store.get("spreadsheet_url")?.value ?? "";

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
    // Token expired or Sheets error — show login
    return (
      <>
        <TimezoneDetector serverTz={tz} />
        <LoginView />
      </>
    );
  }
}
