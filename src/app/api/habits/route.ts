import { NextRequest, NextResponse } from "next/server";
import { UserRefreshClient } from "google-auth-library";
import {
  findSpreadsheetByName,
  readSpreadsheetData,
  parseSpreadsheetRows,
  TokenExpiredError,
  SPREADSHEET_NAME,
} from "@/src/lib/googleSheets/googleSheetsApi";

// GET /api/habits
// Headers:
//   Authorization: Bearer <accessToken>
//   X-Refresh-Token: <refreshToken>
//
// Response: { habits, notes, snapshots, spreadsheetId, spreadsheetUrl, newAccessToken? }
//           | { found: false, habits: [], notes: [], snapshots: [] }
export async function GET(request: NextRequest) {
  const accessTokenHeader = request.headers.get("Authorization");
  const refreshToken = request.headers.get("X-Refresh-Token");

  if (!accessTokenHeader || !refreshToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accessToken = accessTokenHeader.replace("Bearer ", "");
  let newAccessToken: string | undefined;

  async function fetchData() {
    const spreadsheet = await findSpreadsheetByName(accessToken, SPREADSHEET_NAME);
    if (!spreadsheet) {
      return NextResponse.json({ found: false, habits: [], notes: [], snapshots: [] });
    }

    const rows = await readSpreadsheetData(accessToken, spreadsheet.id);
    const data = rows ? parseSpreadsheetRows(rows) : { habits: [], notes: [], snapshots: [] };

    return NextResponse.json({
      ...data,
      found: true,
      spreadsheetId: spreadsheet.id,
      spreadsheetUrl: spreadsheet.url,
      ...(newAccessToken ? { newAccessToken } : {}),
    });
  }

  try {
    return await fetchData();
  } catch (err) {
    if (!(err instanceof TokenExpiredError)) {
      console.error("GET /api/habits error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Token expired — refresh using server-side UserRefreshClient
    try {
      const client = new UserRefreshClient(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        refreshToken
      );
      const { credentials } = await client.refreshAccessToken();
      if (!credentials.access_token) throw new Error("No access token in refresh response");

      accessToken = credentials.access_token;
      newAccessToken = credentials.access_token;

      return await fetchData();
    } catch (refreshErr) {
      console.error("GET /api/habits token refresh error:", refreshErr);
      return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
    }
  }
}
