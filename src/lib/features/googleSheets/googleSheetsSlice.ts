import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../../store";
import { GoogleState } from "@/src/app/types/googleState";
import IHabitsAndNotesData from "@/src/app/types/habitsData";

interface GoogleSheetsState {
  status: GoogleState;
  accessToken: string | null;
  refreshToken: string | null;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  // error: string | null;
  loadedData: IHabitsAndNotesData | null;
}

const initialState: GoogleSheetsState = {
  status: GoogleState.NOT_CONNECTED,
  accessToken: null,
  refreshToken: null,
  spreadsheetId: null,
  spreadsheetUrl: null,
  // error: null,
  loadedData: null,
};

const googleSheetsSlice = createSlice({
  name: "googleSheets",
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<GoogleState>) => {
      state.status = action.payload;
    },
    setRefreshToken: (state, action: PayloadAction<string | null>) => {
      state.refreshToken = action.payload;
    },
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload;
    },
    setData: (state, action: PayloadAction<IHabitsAndNotesData | null>) => {
      state.loadedData = action.payload;
    },
    setSpreadsheetUrl: (state, action: PayloadAction<string | null>) => {
      state.spreadsheetUrl = action.payload;
    },
    setSpreadsheetId: (state, action: PayloadAction<string | null>) => {
      state.spreadsheetId = action.payload;
    },
  },
});

export const {
  setStatus,
  setRefreshToken,
  setAccessToken,
  setData,
  setSpreadsheetUrl,
  setSpreadsheetId,
} = googleSheetsSlice.actions;

// Selectors
export const selectGoogleStatus = (state: RootState) =>
  state.googleSheets.status;
export const selectRefreshToken = (state: RootState) =>
  state.googleSheets.refreshToken;
export const selectAccessToken = (state: RootState) =>
  state.googleSheets.accessToken;
export const selectLoadedData = (state: RootState) =>
  state.googleSheets.loadedData;
export const selectSpreadsheetUrl = (state: RootState) =>
  state.googleSheets.spreadsheetUrl;
export const selectSpreadsheetId = (state: RootState) =>
  state.googleSheets.spreadsheetId;

export default googleSheetsSlice.reducer;
