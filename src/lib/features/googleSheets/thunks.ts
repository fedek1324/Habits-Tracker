import { createAsyncThunk } from "@reduxjs/toolkit";
import { RootState } from "../../store";
import { GoogleState } from "@/src/app/types/googleState";
import {
  setStatus,
  setRefreshToken,
  setAccessToken,
  setSpreadsheetUrl,
  setSpreadsheetId,
} from "./googleSheetsSlice";
import { setHabits } from "../habitsAndNotes/habitsSlice";
import { setNotes } from "../habitsAndNotes/notesSlice";
import { setSnapshots } from "../habitsAndNotes/snapshotsSlice";
import axios from "axios";
import {
  findSpreadsheetByName,
  readSpreadsheetData,
  parseSpreadsheetRows,
  writeSpreadsheetData,
  createSpreadsheet,
  TokenExpiredError,
  SPREADSHEET_NAME,
} from "@/src/lib/googleSheets/googleSheetsApi";

const API_GOOGLE_REFRESH_TOKEN_URL = "/api/auth/google/refresh-token";

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

async function refreshAccessTokenHelper(refreshToken: string): Promise<string | null> {
  try {
    const response = await axios.post(API_GOOGLE_REFRESH_TOKEN_URL, { refreshToken });
    return response.data.access_token ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// Thunks
// ─────────────────────────────────────────────────────────

/**
 * Called after Google OAuth login.
 * Finds or creates the spreadsheet, loads data into Redux.
 */
export const onLogin = createAsyncThunk(
  "app/login",
  async (
    data: { refreshToken: string; accessToken: string },
    { dispatch }
  ) => {
    dispatch(setRefreshToken(data.refreshToken));
    dispatch(setAccessToken(data.accessToken));
    dispatch(setStatus(GoogleState.UPDATING));

    let { accessToken } = data;

    async function tryFindAndLoad(): Promise<boolean> {
      const spreadsheet = await findSpreadsheetByName(accessToken, SPREADSHEET_NAME);
      if (!spreadsheet) return false;

      dispatch(setSpreadsheetId(spreadsheet.id));
      dispatch(setSpreadsheetUrl(spreadsheet.url));

      const rows = await readSpreadsheetData(accessToken, spreadsheet.id);
      if (!rows) return false;

      const parsed = parseSpreadsheetRows(rows);
      dispatch(setHabits(parsed.habits));
      dispatch(setNotes(parsed.notes));
      dispatch(setSnapshots(parsed.snapshots));
      return true;
    }

    try {
      const found = await tryFindAndLoad();

      if (!found) {
        // Spreadsheet doesn't exist — will be created on first upload
        console.log("onLogin: no spreadsheet found, will create on first upload");
      }

      dispatch(setStatus(GoogleState.CONNECTED));
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        const newToken = await refreshAccessTokenHelper(data.refreshToken);
        if (!newToken) {
          dispatch(setStatus(GoogleState.ERROR));
          return;
        }
        dispatch(setAccessToken(newToken));
        accessToken = newToken;

        try {
          await tryFindAndLoad();
          dispatch(setStatus(GoogleState.CONNECTED));
        } catch {
          dispatch(setStatus(GoogleState.ERROR));
        }
      } else {
        console.error("onLogin error:", err);
        dispatch(setStatus(GoogleState.ERROR));
      }
    }
  }
);

/**
 * Upload current Redux state to Google Sheets.
 * Creates the spreadsheet if it doesn't exist yet.
 */
export const uploadDataToGoogle = createAsyncThunk(
  "app/uploadDataToGoogle",
  async (_: void, { dispatch, getState }) => {
    const state = getState() as RootState;
    const { refreshToken, accessToken, spreadsheetId, status } = state.googleSheets;

    if (status === GoogleState.NOT_CONNECTED || !refreshToken || !accessToken) return;

    const habits = state.habits.items;
    const notes = state.notes.items;
    const snapshots = state.snapshots.items;

    dispatch(setStatus(GoogleState.UPDATING));

    async function tryUpload(token: string) {
      let sheetId = spreadsheetId;

      if (!sheetId) {
        const info = await createSpreadsheet(token, habits, notes, snapshots);
        dispatch(setSpreadsheetId(info.id));
        dispatch(setSpreadsheetUrl(info.url));
      } else {
        await writeSpreadsheetData(token, sheetId, habits, notes, snapshots);
      }
    }

    try {
      await tryUpload(accessToken);
      dispatch(setStatus(GoogleState.CONNECTED));
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        const newToken = await refreshAccessTokenHelper(refreshToken);
        if (!newToken) {
          dispatch(setStatus(GoogleState.ERROR));
          return;
        }
        dispatch(setAccessToken(newToken));
        try {
          await tryUpload(newToken);
          dispatch(setStatus(GoogleState.CONNECTED));
        } catch {
          dispatch(setStatus(GoogleState.ERROR));
        }
      } else {
        console.error("uploadDataToGoogle error:", err);
        dispatch(setStatus(GoogleState.ERROR));
      }
    }
  }
);

/**
 * Disconnect from Google Sheets and clear all auth state.
 */
export const onLogout = createAsyncThunk("app/logout", async (_, { dispatch }) => {
  dispatch(setStatus(GoogleState.NOT_CONNECTED));
  dispatch(setRefreshToken(null));
  dispatch(setAccessToken(null));
  dispatch(setSpreadsheetId(null));
  dispatch(setSpreadsheetUrl(null));
});
