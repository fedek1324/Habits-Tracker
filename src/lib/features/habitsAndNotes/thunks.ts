import { createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "../../store";

// Imports from slices
import {
  setHabits,
  addHabit,
} from "./habitsSlice";
import {
  setNotes,
  addNote,
} from "./notesSlice";
import {
  setSnapshots,
  setTodayAndFillHistory,
  addHabitToSnapshot,
  addNoteToSnapshot,
  selectToday,
} from "./snapshotsSlice";
import IHabbit from "../../../app/types/habbit";
import INote from "../../../app/types/note";
import IDailySnapshot from "../../../app/types/dailySnapshot";

// ========================================
// INITIALIZATION THUNKS
// ========================================

/**
 * Initialize store with data (analog of initializeHabitsLocalStorage)
 * Loads all data: habits, notes, snapshots
 * Use this when loading from localStorage or Google Sheets
 */
export const initializeStore = createAsyncThunk(
  "app/initialize",
  async (
    data: {
      habits: IHabbit[];
      notes: INote[];
      snapshots: IDailySnapshot[];
      today: string;
    },
    { dispatch }
  ) => {
    // Set new data
    dispatch(setHabits(data.habits));
    dispatch(setNotes(data.notes));
    dispatch(setSnapshots(data.snapshots));

    // Set today and fill history
    dispatch(setTodayAndFillHistory(data.today));

    return true;
  }
);

/**
 * Setup automatic today synchronization
 * Runs on store creation
 */
export const setupTodaySync = createAsyncThunk(
  "snapshots/setupSync",
  async (_, { dispatch, getState }) => {
    const getTodayString = () => new Date().toISOString().split("T")[0];

    const checkAndUpdate = () => {
      console.log("Checking day update");
      const state = getState() as RootState;
      const todayInState = selectToday(state);
      const currentToday = getTodayString();

      if (todayInState !== currentToday) {
        dispatch(setTodayAndFillHistory(currentToday));
      }
    };

    // Check immediately
    checkAndUpdate();

    // Check every minute (only when tab is active)
    setInterval(() => {
      if (!document.hidden) {
        checkAndUpdate();
      }
    }, 60000);

    // Check on tab focus
    window.addEventListener("focus", checkAndUpdate);

    // Check on visibility change
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        checkAndUpdate();
      }
    });
  }
);

// ========================================
// HABITS THUNKS
// ========================================

/**
 * Add habit to both habits slice and today's snapshot
 * Main method for adding habits
 */
export const addHabitWithSnapshot = createAsyncThunk(
  "habits/addWithSnapshot",
  async (
    data: {
      habit: IHabbit;
      initialNeedCount?: number;
    },
    { dispatch }
  ) => {
    const { habit, initialNeedCount = 1 } = data;

    // 1. Add to habits slice
    dispatch(addHabit(habit));

    // 2. Add to today's snapshot
    dispatch(
      addHabitToSnapshot({
        habitId: habit.id,
        needCount: initialNeedCount,
      })
    );

    return habit;
  }
);

// ========================================
// NOTES THUNKS
// ========================================

/**
 * Add note to both notes slice and today's snapshot
 * Main method for adding notes
 */
export const addNoteWithSnapshot = createAsyncThunk(
  "notes/addWithSnapshot",
  async (
    data: {
      note: INote;
      initialText?: string;
    },
    { dispatch }
  ) => {
    const { note, initialText = "" } = data;

    // 1. Add to notes slice
    dispatch(addNote(note));

    // 2. Add to today's snapshot
    dispatch(
      addNoteToSnapshot({
        noteId: note.id,
        text: initialText,
      })
    );

    return note;
  }
);
