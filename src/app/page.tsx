import { cookies } from "next/headers";
import { UserRefreshClient } from "google-auth-library";
import HabitsClient from "./HabitsClient";
import {
  findSpreadsheetByName,
  readSpreadsheetData,
  parseSpreadsheetRows,
  SPREADSHEET_NAME,
  HabitsData,
} from "@/src/lib/googleSheets/googleSheetsApi";

type InitialData = HabitsData & { spreadsheetId: string; spreadsheetUrl: string };

async function fetchInitialData(refreshToken: string): Promise<InitialData | null> {
  try {
    const client = new UserRefreshClient(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      refreshToken
    );
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) return null;

    const accessToken = credentials.access_token;

    const spreadsheet = await findSpreadsheetByName(accessToken, SPREADSHEET_NAME);
    if (!spreadsheet) return null;

    const rows = await readSpreadsheetData(accessToken, spreadsheet.id);
    if (!rows) return null;

    return {
      ...parseSpreadsheetRows(rows),
      spreadsheetId: spreadsheet.id,
      spreadsheetUrl: spreadsheet.url,
    };
  } catch {
    // SSR failed gracefully — client will load via SWR
    return null;
  }
}

export default async function Page() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("google_refresh_token")?.value ?? null;

  const initialData = refreshToken ? await fetchInitialData(refreshToken) : null;

  return <HabitsClient initialData={initialData} />;
}
