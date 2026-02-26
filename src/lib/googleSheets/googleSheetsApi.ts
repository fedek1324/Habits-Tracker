import IDailySnapshot from "@/src/lib/types/dailySnapshot";
import IHabit from "@/src/lib/types/habit";
import INote from "@/src/lib/types/note";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type HabitsData = {
  habits: IHabit[];
  notes: INote[];
  snapshots: IDailySnapshot[];
};

export type SpreadsheetInfo = {
  id: string;
  url: string;
};

type SheetRow = Array<{ userEnteredValue: { stringValue: string } }>;

// ─────────────────────────────────────────────────────────
// Stable ID generation
// ─────────────────────────────────────────────────────────

/**
 * Derives a stable, deterministic ID from a column name.
 * Must not use crypto.randomUUID() — IDs must be identical across
 * every call to parseSpreadsheetRows so Server Actions can match them.
 */
function stableId(prefix: string, name: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = (h * 0x01000193) >>> 0; // FNV-1a 32-bit
  }
  return `${prefix}-${h.toString(16).padStart(8, "0")}-${name.length.toString(16).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

export const SPREADSHEET_NAME = "My habits tracker";
const SHEET_TITLE = "Habits Data";

// ─────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────

export class TokenExpiredError extends Error {
  constructor() {
    super("Google access token expired");
  }
}

// ─────────────────────────────────────────────────────────
// Core fetch helper
// ─────────────────────────────────────────────────────────

async function apiFetch(
  accessToken: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) throw new TokenExpiredError();
  return res;
}

// ─────────────────────────────────────────────────────────
// Read operations
// ─────────────────────────────────────────────────────────

export async function findSpreadsheetByName(
  accessToken: string,
  name: string
): Promise<SpreadsheetInfo | null> {
  const res = await apiFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(name)}' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,webViewLink)`
  );

  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);

  const { files } = await res.json();
  if (!files?.length) return null;

  return { id: files[0].id, url: files[0].webViewLink };
}

export async function readSpreadsheetData(
  accessToken: string,
  spreadsheetId: string
): Promise<string[][] | null> {
  const dataRes = await apiFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_TITLE}`
  );
  if (!dataRes.ok) throw new Error(`Sheets read error: ${dataRes.status}`);

  const data = await dataRes.json();
  return data.values ?? null;
}

export function parseSpreadsheetRows(rows: string[][]): HabitsData {
  if (!rows || rows.length < 3) return { habits: [], notes: [], snapshots: [] };

  const [categoryRow, columnNamesRow, ...dataRows] = rows;
  const allColumnNames = columnNamesRow.slice(1);

  if (!allColumnNames.length) return { habits: [], notes: [], snapshots: [] };

  // Determine which columns are habits vs notes based on category row
  const habitNames: string[] = [];
  const noteNames: string[] = [];

  for (let i = 1; i < columnNamesRow.length; i++) {
    const category = categoryRow[i] ?? "";
    const colName = allColumnNames[i - 1];

    if (category === "Habits" || (category === "" && habitNames.length > 0 && noteNames.length === 0)) {
      habitNames.push(colName);
    } else if (category === "Notes" || (category === "" && noteNames.length > 0)) {
      noteNames.push(colName);
    }
  }

  // IDs must be stable across parses so Server Actions can match them.
  // We derive them deterministically from the column name (which is unique in Sheets).
  const habits: IHabit[] = habitNames.map((name) => ({ id: stableId("h", name), text: name }));
  const notes: INote[] = noteNames.map((name) => ({ id: stableId("n", name), name }));

  const snapshots: IDailySnapshot[] = dataRows
    .filter((row) => row.length > 0 && row[0])
    .map((row) => {
      const date = row[0];
      const habitData = habits
        .map((habit, idx) => {
          const cell = row[idx + 1] ?? "";
          const match = cell.match(/^(\d+)\/(\d+)$/);
          if (!match) return null;
          return {
            habitId: habit.id,
            habitDidCount: parseInt(match[1]),
            habitNeedCount: parseInt(match[2]),
          };
        })
        .filter((h): h is NonNullable<typeof h> => h !== null);

      const noteData = notes
        .map((note, idx) => {
          const cell = row[habits.length + idx + 1] ?? "";
          if (!cell) return null; // empty cell = note was deleted from this day's snapshot
          return {
            noteId: note.id,
            // sentinel "No text for that day" maps back to empty string in-app
            noteText: cell === "No text for that day" ? "" : cell,
          };
        })
        .filter((n): n is NonNullable<typeof n> => n !== null);

      return { date, habits: habitData, notes: noteData };
    });

  return { habits, notes, snapshots };
}

// ─────────────────────────────────────────────────────────
// Write operations
// ─────────────────────────────────────────────────────────

export async function writeSpreadsheetData(
  accessToken: string,
  spreadsheetId: string,
  habits: IHabit[],
  notes: INote[],
  snapshots: IDailySnapshot[]
): Promise<void> {
  const metaRes = await apiFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`
  );
  if (!metaRes.ok) throw new Error(`Sheets metadata error: ${metaRes.status}`);
  const meta = await metaRes.json();
  const sheetId: number = meta.sheets[0].properties.sheetId;

  const habitNames = [...new Set(habits.map((h) => h.text))].sort();
  const noteNames = [...new Set(notes.map((n) => n.name))].sort();

  const habitIdToName = new Map(habits.map((h) => [h.id, h.text]));
  const noteIdToName = new Map(notes.map((n) => [n.id, n.name]));

  // Build header rows
  const categoryRow = [
    "Date",
    ...(habitNames.length ? ["Habits", ...Array(habitNames.length - 1).fill("")] : []),
    ...(noteNames.length ? ["Notes", ...Array(noteNames.length - 1).fill("")] : []),
  ];
  const columnNamesRow = ["Date", ...habitNames, ...noteNames];

  // Build data rows
  const dateMap = new Map<string, Map<string, string>>();
  for (const snap of snapshots) {
    if (!dateMap.has(snap.date)) dateMap.set(snap.date, new Map());
    const day = dateMap.get(snap.date)!;

    for (const h of snap.habits) {
      const name = habitIdToName.get(h.habitId);
      if (name && habitNames.includes(name)) {
        day.set(name, `${h.habitDidCount}/${h.habitNeedCount}`);
      }
    }
    for (const n of snap.notes ?? []) {
      const name = noteIdToName.get(n.noteId);
      if (name && noteNames.includes(name)) {
        // Write sentinel when text is empty so the cell is non-empty → note survives round-trip.
        // Empty cell means "deleted from this day's snapshot".
        day.set(name, n.noteText.trim() || "No text for that day");
      }
    }
  }

  const dataRows = [...dateMap.keys()].sort().map((date) => {
    const day = dateMap.get(date)!;
    return [
      date,
      ...habitNames.map((name) => day.get(name) ?? ""),
      ...noteNames.map((name) => day.get(name) ?? ""),
    ];
  });

  const allRows = [categoryRow, columnNamesRow, ...dataRows];
  const numRows = allRows.length;
  const numCols = categoryRow.length;

  const toSheetRow = (row: string[]): SheetRow =>
    row.map((v) => ({ userEnteredValue: { stringValue: v } }));

  const requests = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            rowCount: Math.max(numRows + 10, 100),
            columnCount: Math.max(numCols + 5, 26),
          },
        },
        fields: "gridProperties.rowCount,gridProperties.columnCount",
      },
    },
    {
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: numRows, startColumnIndex: 0, endColumnIndex: numCols },
        rows: allRows.map((row) => ({ values: toSheetRow(row) })),
        fields: "userEnteredValue",
      },
    },
    // Category row formatting (dark header)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.3, green: 0.3, blue: 0.3 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 14, bold: true },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat",
      },
    },
    // Column names row formatting (blue header)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: numCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 12, bold: true },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat",
      },
    },
    // Data rows formatting
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: numRows, startColumnIndex: 0, endColumnIndex: numCols },
        cell: {
          userEnteredFormat: {
            textFormat: { fontSize: 10 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat",
      },
    },
    // Borders
    {
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: numRows, startColumnIndex: 0, endColumnIndex: numCols },
        top: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
        bottom: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
        left: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
        right: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
        innerHorizontal: { style: "SOLID", width: 1, color: { red: 0.9, green: 0.9, blue: 0.9 } },
        innerVertical: { style: "SOLID", width: 1, color: { red: 0.9, green: 0.9, blue: 0.9 } },
      },
    },
    { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: numCols } } },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 2, frozenColumnCount: 1 } },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
      },
    },
  ];

  const res = await apiFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    { method: "POST", body: JSON.stringify({ requests }) }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets batchUpdate error: ${res.status} ${body}`);
  }
}

export async function createSpreadsheet(
  accessToken: string,
  habits: IHabit[],
  notes: INote[],
  snapshots: IDailySnapshot[]
): Promise<SpreadsheetInfo> {
  const res = await apiFetch(
    accessToken,
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      method: "POST",
      body: JSON.stringify({
        properties: { title: SPREADSHEET_NAME },
        sheets: [{ properties: { title: "Habits Data" } }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Failed to create spreadsheet: ${res.status}`);

  const sheet = await res.json();
  await writeSpreadsheetData(accessToken, sheet.spreadsheetId, habits, notes, snapshots);

  return { id: sheet.spreadsheetId, url: sheet.spreadsheetUrl };
}
