"use client";

import useSWR from "swr";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/src/lib/hooks";
import {
  selectRefreshToken,
  selectAccessToken,
  selectGoogleStatus,
  setAccessToken,
  setStatus,
  setSpreadsheetId,
  setSpreadsheetUrl,
} from "@/src/lib/features/googleSheets/googleSheetsSlice";
import { initializeStore } from "@/src/lib/features/habitsAndNotes/thunks";
import { selectToday } from "@/src/lib/features/habitsAndNotes/snapshotsSlice";
import { GoogleState } from "@/src/app/types/googleState";
import IHabbit from "@/src/app/types/habbit";
import INote from "@/src/app/types/note";
import IDailySnapshot from "@/src/app/types/dailySnapshot";
import { uploadDataToGoogle } from "@/src/lib/features/googleSheets/thunks";

type HabitsApiResponse = {
  found: boolean;
  habits: IHabbit[];
  notes: INote[];
  snapshots: IDailySnapshot[];
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  newAccessToken?: string;
};

const POLL_INTERVAL_MS = 30_000;

export function useHabitsSync() {
  const dispatch = useAppDispatch();
  const refreshToken = useAppSelector(selectRefreshToken);
  const accessToken = useAppSelector(selectAccessToken);
  const googleStatus = useAppSelector(selectGoogleStatus);
  const today = useAppSelector(selectToday);

  const fetcher = async (url: string): Promise<HabitsApiResponse> => {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken ?? ""}`,
        "X-Refresh-Token": refreshToken ?? "",
      },
    });
    if (!res.ok) throw new Error(`GET /api/habits failed: ${res.status}`);
    return res.json();
  };

  const { data, error, isLoading, mutate } = useSWR<HabitsApiResponse>(
    refreshToken ? "/api/habits" : null,
    fetcher,
    {
      refreshInterval: POLL_INTERVAL_MS,
      revalidateOnFocus: true,
      revalidateOnReconnect: false,
    }
  );

  // Show UPDATING only on the initial load (not background polls)
  useEffect(() => {
    if (!refreshToken) {
      dispatch(setStatus(GoogleState.NOT_CONNECTED));
    } else if (isLoading) {
      dispatch(setStatus(GoogleState.UPDATING));
    }
  }, [refreshToken, isLoading, dispatch]);

  // Handle successful data fetch
  useEffect(() => {
    if (!data || !today) return;

    if (data.newAccessToken) dispatch(setAccessToken(data.newAccessToken));
    if (data.spreadsheetId) dispatch(setSpreadsheetId(data.spreadsheetId));
    if (data.spreadsheetUrl) dispatch(setSpreadsheetUrl(data.spreadsheetUrl));

    if (data.found) {
      dispatch(initializeStore({ habits: data.habits, notes: data.notes, snapshots: data.snapshots, today }));
    } else {
      // No spreadsheet yet — create it from current local state
      dispatch(uploadDataToGoogle());
    }

    dispatch(setStatus(GoogleState.CONNECTED));
  }, [data, today, dispatch]);

  // Handle fetch error
  useEffect(() => {
    if (error) {
      console.error("useHabitsSync: fetch error", error);
      dispatch(setStatus(GoogleState.ERROR));
    }
  }, [error, dispatch]);

  return {
    googleStatus,
    triggerSync: () => mutate(),
  };
}
