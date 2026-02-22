import { cookies } from "next/headers";
import { UserRefreshClient } from "google-auth-library";
import HabitsView from "./HabitsView";
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
    const client = new UserRefreshClient(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      refreshToken
    );
    const { credentials } = await client.refreshAccessToken();
    const accessToken = credentials.access_token!;

    // Find or create the spreadsheet — no cached ID needed
    let spreadsheet = await findSpreadsheetByName(accessToken, SPREADSHEET_NAME);
    if (!spreadsheet) {
      spreadsheet = await createSpreadsheet(accessToken, [], [], []);
    }

    const rows = await readSpreadsheetData(accessToken, spreadsheet.id);
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
          spreadsheetUrl={spreadsheet.url}
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
