import { createAsyncThunk, ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";
import { RootState } from "../../store";
import { GoogleState } from "@/src/app/types/googleState";
import {
  setStatus,
  setRefreshToken,
  setAccessToken,
  setData,
  setSpreadsheetUrl,
  setSpreadsheetId,
} from "./googleSheetsSlice";
import { setHabits } from "../habitsAndNotes/habitsSlice";
import { setNotes } from "../habitsAndNotes/notesSlice";
import { setSnapshots } from "../habitsAndNotes/snapshotsSlice";
import IHabbit from "@/src/app/types/habbit";
import IDailySnapshot from "@/src/app/types/dailySnapshot";
import INote from "@/src/app/types/note";
import axios from "axios";

// ========================================
// TYPES
// ========================================

type SpreadSheetData = {
  majorDimension: "ROWS";
  range: string;
  values: Array<Array<string>> | undefined;
};

const SPREADSHEET_NAME = "My habits tracker";
const API_GOOGLE_REFRESH_TOKEN_URL = "/api/auth/google/refresh-token";

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Refresh access token using refresh token
 */
async function refreshAccessTokenHelper(refreshToken: string): Promise<string | null> {
  try {
    console.log("Refreshing access token...");
    const response = await axios.post(API_GOOGLE_REFRESH_TOKEN_URL, {
      refreshToken,
    });

    if (response.data.access_token) {
      console.log(" Successfully refreshed access token");
      return response.data.access_token;
    }

    return null;
  } catch (error) {
    console.error("L Error refreshing access token:", error);
    return null;
  }
}

/**
 * Make authenticated request with automatic token refresh
 */
async function makeAuthenticatedRequest(
  refreshToken: string,
  accessToken: string,
  url: string,
  options: RequestInit,
  dispatch: ThunkDispatch<unknown, unknown, UnknownAction>,
  retryCount = 0
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // If token expired and we have a refresh token, try to refresh
  if (response.status === 401 && refreshToken && retryCount === 0) {
    console.log("Access token expired, attempting to refresh...");
    const newAccessToken = await refreshAccessTokenHelper(refreshToken);

    if (newAccessToken) {
      dispatch(setAccessToken(newAccessToken));

      // Retry the request with new token
      return makeAuthenticatedRequest(
        refreshToken,
        newAccessToken,
        url,
        options,
        dispatch,
        1
      );
    }
  }

  return response;
}

/**
 * Parse spreadsheet data to habits, notes and snapshots
 */
function parseSpreadsheetDataHelper(allRows: string[][]) {
  try {
    console.log("Parsing spreadsheet data to habits, notes and snapshots...");

    if (!allRows || allRows.length < 3) {
      console.log("Not enough data in spreadsheet - need at least 3 rows (category, headers, data)");
      return { habits: [], notes: [], snapshots: [] };
    }

    const categoryRow = allRows[0];
    const columnNamesRow = allRows[1];
    const dataRows = allRows.slice(2);

    const allColumnNames = columnNamesRow.slice(1);
    console.log("Found all column names:", allColumnNames);

    if (allColumnNames.length === 0) {
      console.log("No data columns found in spreadsheet");
      return { habits: [], notes: [], snapshots: [] };
    }

    const habitNames: string[] = [];
    const noteNames: string[] = [];

    for (let i = 1; i < columnNamesRow.length; i++) {
      const category = categoryRow[i] || "";
      const columnName = allColumnNames[i - 1];

      if (category === "Habits") {
        habitNames.push(columnName);
      } else if (category === "Notes") {
        noteNames.push(columnName);
      } else if (category === "" && habitNames.length > 0 && noteNames.length === 0) {
        habitNames.push(columnName);
      } else if (category === "" && noteNames.length > 0) {
        noteNames.push(columnName);
      }
    }

    console.log("Found habit columns:", habitNames);
    console.log("Found note columns:", noteNames);

    const habits: IHabbit[] = habitNames.map((name) => ({
      id: crypto.randomUUID(),
      text: name,
    }));

    const notes: INote[] = noteNames.map((name) => ({
      id: crypto.randomUUID(),
      name: name,
    }));

    const snapshots: IDailySnapshot[] = [];

    dataRows.forEach((row) => {
      if (row.length === 0) return;

      const date = row[0];
      if (!date) return;

      const habitData: Array<{
        habbitId: string;
        habbitNeedCount: number;
        habbitDidCount: number;
      }> = [];

      const noteData: Array<{
        noteId: string;
        noteText: string;
      }> = [];

      for (let i = 1; i < row.length && i <= allColumnNames.length; i++) {
        const cellValue = row[i];
        const columnName = allColumnNames[i - 1];

        if (habitNames.includes(columnName)) {
          if (cellValue && cellValue.match(/^\d+\/\d+$/)) {
            const progressMatch = cellValue.match(/^(\d+)\/(\d+)$/);
            if (progressMatch) {
              const actualCount = parseInt(progressMatch[1]);
              const targetCount = parseInt(progressMatch[2]);
              const habitId = habits.find(h => h.text === columnName)?.id;

              if (habitId) {
                habitData.push({
                  habbitId: habitId,
                  habbitNeedCount: targetCount,
                  habbitDidCount: actualCount,
                });
              }
            }
          }
        } else if (noteNames.includes(columnName)) {
          const noteId = notes.find(n => n.name === columnName)?.id;

          if (noteId && cellValue) {
            noteData.push({
              noteId: noteId,
              noteText: cellValue,
            });
          }
        }
      }

      snapshots.push({
        date: date,
        habbits: habitData,
        notes: noteData,
      });
    });

    console.log(
      `Parsed ${habits.length} habits, ${notes.length} notes, and ${snapshots.length} daily snapshots`
    );
    return { habits, notes, snapshots };
  } catch (error) {
    console.error("L Error parsing spreadsheet data:", error);
    return { habits: [], notes: [], snapshots: [] };
  }
}

/**
 * Find spreadsheet by name
 */
async function findSpreadsheetByName(
  refreshToken: string,
  accessToken: string,
  name: string,
  dispatch: ThunkDispatch<unknown, unknown, UnknownAction>
) {
  try {
    console.log(`Searching for spreadsheet named: "${name}"`);

    const searchResponse = await makeAuthenticatedRequest(
      refreshToken,
      accessToken,
      `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(
        name
      )}' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,webViewLink)`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
      dispatch
    );

    if (!searchResponse.ok) {
      throw new Error(
        `Failed to search for spreadsheet: ${searchResponse.status}`
      );
    }

    const searchData = await searchResponse.json();
    const files = searchData.files;

    if (files && files.length > 0) {
      const spreadsheet = files[0];
      console.log(
        ` Found existing spreadsheet: ${spreadsheet.name} (ID: ${spreadsheet.id})`
      );
      return {
        id: spreadsheet.id,
        url: spreadsheet.webViewLink,
      };
    } else {
      console.log(`No spreadsheet found with name: "${name}"`);
      return null;
    }
  } catch (error) {
    console.error("L Error searching for spreadsheet:", error);
    return null;
  }
}

/**
 * Read existing spreadsheet data
 */
async function readExistingSpreadsheetData(
  refreshToken: string,
  accessToken: string,
  spreadsheetId: string,
  dispatch: ThunkDispatch<unknown, unknown, UnknownAction>
) {
  try {
    console.log("Reading existing spreadsheet data...");

    // TODO is this query extra? see dataResponse below
    const metadataResponse = await makeAuthenticatedRequest(
      refreshToken,
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
      dispatch
    );

    if (!metadataResponse.ok) {
      throw new Error(
        `Failed to get spreadsheet metadata: ${metadataResponse.status}`
      );
    }

    const metadata = await metadataResponse.json();
    const sheet = metadata.sheets[0];
    const sheetTitle = sheet.properties.title;

    const dataResponse = await makeAuthenticatedRequest(
      refreshToken,
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
      dispatch
    );

    if (!dataResponse.ok) {
      throw new Error(
        `Failed to read spreadsheet data: ${dataResponse.status}`
      );
    }

    const data: SpreadSheetData = await dataResponse.json();
    const rows = data.values;

    if (!rows || rows.length === 0) {
      console.log("Spreadsheet is empty");
      return [];
    }

    console.log("Successfully read spreadsheet data:", rows.length, "rows");
    return rows;
  } catch (error) {
    console.error("L Error reading spreadsheet data:", error);
    return null;
  }
}

/**
 * Populate spreadsheet with habits data
 */
async function populateSpreadsheetWithHabits(
  refreshToken: string,
  accessToken: string,
  spreadsheetId: string,
  habits: IHabbit[],
  habitSnapshots: IDailySnapshot[],
  notes: INote[],
  dispatch: ThunkDispatch<unknown, unknown, UnknownAction>
) {
  try {
    console.log("Atomically syncing spreadsheet with latest habits data...");

    const spreadsheetResponse = await makeAuthenticatedRequest(
      refreshToken,
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
      dispatch
    );

    if (!spreadsheetResponse.ok) {
      throw new Error(
        `Failed to get spreadsheet details: ${spreadsheetResponse.statusText}`
      );
    }

    const spreadsheetData = await spreadsheetResponse.json();
    const sheet = spreadsheetData.sheets[0];
    const sheetId = sheet.properties.sheetId;

    const snapshots = habitSnapshots;

    console.log("Uploading snapshots:", snapshots);
    console.log("Uploading habits:", habits);

    if (snapshots.length === 0 && habits.length === 0) {
      console.log("No data found to populate");
      return;
    }

    const habitIdToName = new Map<string, string>();
    habits.forEach((habit) => {
      habitIdToName.set(habit.id, habit.text);
    });

    const noteIdToName = new Map<string, string>();
    notes.forEach((note) => {
      noteIdToName.set(note.id, note.name);
    });

    const currentHabitNames = Array.from(
      new Set(habits.map((h) => h.text))
    ).sort();
    console.log("Current habits:", currentHabitNames);

    const currentNoteNames = Array.from(
      new Set(notes.map((n) => n.name))
    ).sort();
    console.log("Current notes:", currentNoteNames);

    const categoryRow = ["Date"];

    if (currentHabitNames.length > 0) {
      categoryRow.push("Habits");
      categoryRow.push(...Array(currentHabitNames.length - 1).fill(""));
    }

    if (currentNoteNames.length > 0) {
      categoryRow.push("Notes");
      categoryRow.push(...Array(currentNoteNames.length - 1).fill(""));
    }

    const columnNamesRow = ["Date", ...currentHabitNames, ...currentNoteNames];
    const headers = [categoryRow, columnNamesRow];

    const dateData = new Map<string, Map<string, string>>();

    snapshots.forEach((snapshot) => {
      if (!dateData.has(snapshot.date)) {
        dateData.set(snapshot.date, new Map());
      }

      const dayData = dateData.get(snapshot.date)!;

      snapshot.habbits.forEach((habitSnapshot) => {
        const habitName = habitIdToName.get(habitSnapshot.habbitId);
        if (habitName && currentHabitNames.includes(habitName)) {
          const progress = `${habitSnapshot.habbitDidCount}/${habitSnapshot.habbitNeedCount}`;
          dayData.set(habitName, progress);
        }
      });

      if (snapshot.notes) {
        snapshot.notes.forEach((noteSnapshot) => {
          const noteName = noteIdToName.get(noteSnapshot.noteId);
          if (noteName && currentNoteNames.includes(noteName)) {
            const noteText = noteSnapshot.noteText || "No text for that day";
            dayData.set(noteName, noteText);
          }
        });
      }
    });

    const dataRows: string[][] = [];
    const sortedDates = Array.from(dateData.keys()).sort();

    sortedDates.forEach((date) => {
      const row = [date];
      const dayData = dateData.get(date)!;

      currentHabitNames.forEach((habitName) => {
        row.push(dayData.get(habitName) || "");
      });

      currentNoteNames.forEach((noteName) => {
        row.push(dayData.get(noteName) || "");
      });

      dataRows.push(row);
    });

    const allRows = [...headers, ...dataRows];

    const numColumns = currentHabitNames.length + currentNoteNames.length + 1;
    const numRows = allRows.length;

    console.log(
      `Updating spreadsheet with ${numRows} rows and ${numColumns} columns`
    );

    const requests = [
      {
        updateSheetProperties: {
          properties: {
            sheetId: sheetId,
            gridProperties: {
              rowCount: Math.max(numRows + 10, 100),
              columnCount: Math.max(numColumns + 5, 26),
            },
          },
          fields: "gridProperties.rowCount,gridProperties.columnCount",
        },
      },
      {
        updateCells: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: numRows,
            startColumnIndex: 0,
            endColumnIndex: numColumns,
          },
          rows: allRows.map((row) => ({
            values: row.map((cellValue) => ({
              userEnteredValue: { stringValue: cellValue || "" },
            })),
          })),
          fields: "userEnteredValue",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: numColumns,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.3, green: 0.3, blue: 0.3 },
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 14,
                bold: true,
              },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: 2,
            startColumnIndex: 0,
            endColumnIndex: numColumns,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 12,
                bold: true,
              },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 2,
            endRowIndex: numRows,
            startColumnIndex: 0,
            endColumnIndex: numColumns,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontSize: 10,
              },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat",
        },
      },
      {
        updateBorders: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: numRows,
            startColumnIndex: 0,
            endColumnIndex: numColumns,
          },
          top: {
            style: "SOLID",
            width: 1,
            color: { red: 0.8, green: 0.8, blue: 0.8 },
          },
          bottom: {
            style: "SOLID",
            width: 1,
            color: { red: 0.8, green: 0.8, blue: 0.8 },
          },
          left: {
            style: "SOLID",
            width: 1,
            color: { red: 0.8, green: 0.8, blue: 0.8 },
          },
          right: {
            style: "SOLID",
            width: 1,
            color: { red: 0.8, green: 0.8, blue: 0.8 },
          },
          innerHorizontal: {
            style: "SOLID",
            width: 1,
            color: { red: 0.9, green: 0.9, blue: 0.9 },
          },
          innerVertical: {
            style: "SOLID",
            width: 1,
            color: { red: 0.9, green: 0.9, blue: 0.9 },
          },
        },
      },
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: sheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: numColumns,
          },
        },
      },
      {
        updateSheetProperties: {
          properties: {
            sheetId: sheetId,
            gridProperties: {
              frozenRowCount: 2,
              frozenColumnCount: 1,
            },
          },
          fields:
            "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
        },
      },
    ];

    const response = await makeAuthenticatedRequest(
      refreshToken,
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      },
      dispatch
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to update spreadsheet: ${response.status} ${response.statusText} - ${errorBody}`
      );
    }

    console.log(
      ` Successfully updated spreadsheet with ${dataRows.length} data rows, ${currentHabitNames.length} habit columns, and ${currentNoteNames.length} note columns in one atomic operation`
    );
  } catch (error) {
    console.error("L Error populating spreadsheet with habits:", error);
    throw error;
  }
}

/**
 * Create new Google Spreadsheet
 */
async function createGoogleSpreadSheet(
  refreshToken: string,
  accessToken: string,
  habits: IHabbit[],
  habitSnapshots: IDailySnapshot[],
  notes: INote[],
  dispatch: ThunkDispatch<unknown, unknown, UnknownAction>
) {
  console.log("Creating new habits spreadsheet...");

  const response = await makeAuthenticatedRequest(
    refreshToken,
    accessToken,
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: SPREADSHEET_NAME,
        },
        sheets: [
          {
            properties: {
              title: "Habits Data",
            },
          },
        ],
      }),
    },
    dispatch
  );

  if (!response.ok) {
    throw new Error(`Failed to create spreadsheet: ${response.statusText}`);
  }

  const spreadsheet = await response.json();
  console.log(" Spreadsheet created successfully:", spreadsheet);
  console.log("=� Spreadsheet ID:", spreadsheet.spreadsheetId);
  console.log("= Spreadsheet URL:", spreadsheet.spreadsheetUrl);

  await populateSpreadsheetWithHabits(
    refreshToken,
    accessToken,
    spreadsheet.spreadsheetId,
    habits,
    habitSnapshots,
    notes,
    dispatch
  );

  dispatch(setSpreadsheetId(spreadsheet.spreadsheetId));
  dispatch(setSpreadsheetUrl(spreadsheet.spreadsheetUrl));

  return spreadsheet;
}

// ========================================
// ASYNC THUNKS
// ========================================

/**
 * Initialize Google Sheets on login
 * Sets tokens and spreadsheet info, then loads data from Google Sheets
 */
export const onLogin = createAsyncThunk(
  "app/login",
  async (
    data: {
      refreshToken: string, 
      accessToken: string, 
      spreadsheetId: string, 
      spreadsheetUrl: string,
    },
    { dispatch }
  ) => {

    // Set initial authentication state
    dispatch(setRefreshToken(data.refreshToken));
    dispatch(setAccessToken(data.accessToken));
    dispatch(setStatus(GoogleState.UPDATING));

    // Set spreadsheet info if provided
    if (data.spreadsheetId) {
      dispatch(setSpreadsheetId(data.spreadsheetId));
    }
    if (data.spreadsheetUrl) {
      dispatch(setSpreadsheetUrl(data.spreadsheetUrl));
    }

    try {
      // Try to find and load data from Google Sheets
      const existingSpreadsheet = await findSpreadsheetByName(
        data.refreshToken,
        data.accessToken,
        SPREADSHEET_NAME,
        dispatch
      );

      if (existingSpreadsheet) {
        console.log("Found existing spreadsheet:", existingSpreadsheet.id);

        dispatch(setSpreadsheetId(existingSpreadsheet.id));
        dispatch(setSpreadsheetUrl(existingSpreadsheet.url));

        const spreadsheetData = await readExistingSpreadsheetData(
          data.refreshToken,
          data.accessToken,
          existingSpreadsheet.id,
          dispatch
        );

        if (spreadsheetData) {
          const parsedData = parseSpreadsheetDataHelper(spreadsheetData);

          // Set loaded data in Google Sheets state
          dispatch(setData({
            habits: parsedData.habits,
            notes: parsedData.notes,
            snapshots: parsedData.snapshots
          }));

          // Also update the main state slices
          dispatch(setHabits(parsedData.habits));
          dispatch(setNotes(parsedData.notes));
          dispatch(setSnapshots(parsedData.snapshots));

          dispatch(setStatus(GoogleState.CONNECTED));

          console.log(" Successfully loaded data from Google Sheets");
          return parsedData;
        }
      } else {
        // No spreadsheet found, will create one on first upload
        console.log("No spreadsheet found, will create on first upload");
        dispatch(setStatus(GoogleState.CONNECTED));
      }
    } catch (error) {
      console.error("L Error during onLogin:", error);
      dispatch(setStatus(GoogleState.ERROR));
      throw error;
    }
  }
);

/**
 * Load data from Google Sheets
 */
export const loadGoogleData = createAsyncThunk(
  "app/loadGoogleData", 
  async (
    data: object, 
    { dispatch, getState }) => {
    const state = getState() as RootState;
    const { refreshToken, accessToken, spreadsheetId } = state.googleSheets;

    if (!refreshToken || !accessToken) {
      throw new Error("No authentication tokens available");
    }

    if (!spreadsheetId) {
      throw new Error("No spreadsheet ID available");
    }

    dispatch(setStatus(GoogleState.UPDATING));

    try {
      const spreadsheetData = await readExistingSpreadsheetData(
        refreshToken,
        accessToken,
        spreadsheetId,
        dispatch
      );

      if (spreadsheetData) {
        const parsedData = parseSpreadsheetDataHelper(spreadsheetData);

        // Set loaded data in Google Sheets state
        dispatch(setData({
          habits: parsedData.habits,
          notes: parsedData.notes,
          snapshots: parsedData.snapshots
        }));

        // Also update the main state slices
        dispatch(setHabits(parsedData.habits));
        dispatch(setNotes(parsedData.notes));
        dispatch(setSnapshots(parsedData.snapshots));

        dispatch(setStatus(GoogleState.CONNECTED));

        console.log(" Successfully loaded data from Google Sheets");
        return parsedData;
      } else {
        dispatch(setStatus(GoogleState.ERROR));
        throw new Error("No data found in Google Sheets");
      }
    } catch (error) {
      console.error("L Error loading Google data:", error);
      dispatch(setStatus(GoogleState.ERROR));
      throw error;
    }
});

/**
 * Upload current Redux state to Google Sheets
 */
export const uploadDataToGoogle = createAsyncThunk(
  "app/uploadDataToGoogle", 
  async ( 
    data: object, 
    { dispatch, getState }
  ) => {
    const state = getState() as RootState;
    const { refreshToken, accessToken, spreadsheetId, status } = state.googleSheets;

    // Don't sync if not connected
    if (status === GoogleState.NOT_CONNECTED) {
      console.log("� Skipping upload - not connected to Google Sheets");
      return;
    }

    if (!refreshToken || !accessToken) {
      throw new Error("No authentication tokens available");
    }

    // Get current state
    const habits = state.habits.items;
    const notes = state.notes.items;
    const snapshots = state.snapshots.items;

    dispatch(setStatus(GoogleState.UPDATING));

    try {
      if (spreadsheetId) {
        // Upload to existing spreadsheet
        await populateSpreadsheetWithHabits(
          refreshToken,
          accessToken,
          spreadsheetId,
          habits,
          snapshots,
          notes,
          dispatch
        );
        console.log(" Successfully uploaded data to existing spreadsheet");
      } else {
        // Create new spreadsheet
        await createGoogleSpreadSheet(
          refreshToken,
          accessToken,
          habits,
          snapshots,
          notes,
          dispatch
        );
        console.log(" Successfully created spreadsheet and uploaded data");
      }

      dispatch(setStatus(GoogleState.CONNECTED));
    } catch (error) {
      console.error("L Error uploading data to Google:", error);
      dispatch(setStatus(GoogleState.ERROR));
      throw error;
    }
  }
);

/**
 * Create a new Google Spreadsheet with current Redux state
 */
export const createSpreadsheet = createAsyncThunk(
  "googleSheets/createSpreadsheet",
  async (_, { dispatch, getState }) => {
    const state = getState() as RootState;
    const { refreshToken, accessToken } = state.googleSheets;

    if (!refreshToken || !accessToken) {
      throw new Error("No authentication tokens available");
    }

    // Get current state
    const habits = state.habits.items;
    const notes = state.notes.items;
    const snapshots = state.snapshots.items;

    dispatch(setStatus(GoogleState.UPDATING));

    try {
      const spreadsheet = await createGoogleSpreadSheet(
        refreshToken,
        accessToken,
        habits,
        snapshots,
        notes,
        dispatch
      );

      dispatch(setStatus(GoogleState.CONNECTED));
      console.log(" Successfully created spreadsheet");
      return spreadsheet;
    } catch (error) {
      console.error("L Error creating spreadsheet:", error);
      dispatch(setStatus(GoogleState.ERROR));
      throw error;
    }
  }
);

/**
 * Refresh access token
 */
// export const refreshAccessToken = createAsyncThunk<any, void, { dispatch: ThunkDispatch<unknown, unknown, UnknownAction>; state: RootState }>(
//   "googleSheets/refreshAccessToken",
//   async (_, { dispatch, getState }) => {
//     const state = getState() as RootState;
//     const { refreshToken } = state.googleSheets;

//     if (!refreshToken) {
//       throw new Error("No refresh token available");
//     }

//     try {
//       const newAccessToken = await refreshAccessTokenHelper(refreshToken);

//       if (newAccessToken) {
//         dispatch(setAccessToken(newAccessToken));
//         console.log(" Successfully refreshed access token");
//         return newAccessToken;
//       } else {
//         throw new Error("Failed to refresh access token");
//       }
//     } catch (error) {
//       console.error("L Error refreshing access token:", error);
//       dispatch(setStatus(GoogleState.ERROR));
//       throw error;
//     }
//   }
// );

/**
 * Disconnect from Google Sheets
 */
export const onLogout = createAsyncThunk("app/logout",
  async (_, { dispatch }) => {
    dispatch(setStatus(GoogleState.NOT_CONNECTED));
    dispatch(setRefreshToken(null));
    dispatch(setAccessToken(null));
    dispatch(setSpreadsheetId(null));
    dispatch(setSpreadsheetUrl(null));
    dispatch(setData(null));
    console.log(" Logged out from Google Sheets");
  }
);
