import IDailySnapshot from "@/src/app/types/dailySnapshot";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../../store";
import { getDateString } from "@/src/app/helpers/getDateString";

interface SnapshotsState {
  items: IDailySnapshot[];
  today: string | null;
}

const initialState: SnapshotsState = {
  items: [],
  // TODO: Add autoupdate using thunk
  today: new Date().toISOString().split("T")[0],
};

const snapshotsSlice = createSlice({
  name: "snapshots",
  initialState,
  reducers: {
    // ========================================
    // BASIC OPERATIONS
    // ========================================

    setSnapshots: (state, action: PayloadAction<IDailySnapshot[]>) => {
      state.items = action.payload;
      state.items.sort((a, b) => a.date.localeCompare(b.date));
    },
    saveDailySnapshot: (state, action: PayloadAction<IDailySnapshot>) => {
      const index = state.items.findIndex(
        (s) => s.date === action.payload.date
      );

      if (index !== -1) {
        // Update
        state.items[index] = action.payload;
      } else {
        // Add
        state.items.push(action.payload);
        // Sort by date
        state.items.sort((a, b) => a.date.localeCompare(b.date));
      }
    },
    /**
     * Clear all snapshots (today remains)
     */
    clearSnapshots: (state) => {
      state.items = [];
    },

    // ========================================
    // TODAY OPERATION - ONLY ONE THAT ACCEPTS TODAY
    // ========================================

    /**
     * Set today AND fill history up to this date
     * ONLY reducer that accepts today as a parameter
     * All others use state.today
     */
    setTodayAndFillHistory: (state, action: PayloadAction<string>) => {
      const today = action.payload;

      // Set today
      state.today = today;

      // Fill history
      if (state.items.length === 0) {
        return;
      }

      const sortedSnapshots = [...state.items].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

      const lastDate = new Date(lastSnapshot.date);
      const todayDate = new Date(today);

      lastDate.setHours(0, 0, 0, 0);
      todayDate.setHours(0, 0, 0, 0);

      const currentDate = new Date(lastDate);
      currentDate.setDate(currentDate.getDate() + 1);

      while (currentDate <= todayDate) {
        const dateStr = getDateString(currentDate);

        const exists = state.items.some((s) => s.date === dateStr);

        if (!exists) {
          const newSnapshot: IDailySnapshot = {
            date: dateStr,
            habbits: lastSnapshot.habbits.map((h) => ({
              habbitId: h.habbitId,
              habbitNeedCount: h.habbitNeedCount,
              habbitDidCount: 0,
            })),
            notes:
              lastSnapshot.notes?.map((n) => ({
                noteId: n.noteId,
                noteText: "",
              })) || [],
          };

          state.items.push(newSnapshot);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      state.items.sort((a, b) => a.date.localeCompare(b.date));
    },

    // ========================================
    // HABITS OPERATIONS - DON'T ACCEPT today, use state.today
    // ========================================

    /**
     * Update habit completion count for TODAY
     */
    updateHabitDidCount: (
      state,
      action: PayloadAction<{
        habitId: string;
        count: number;
      }>
    ) => {
      const { habitId, count } = action.payload;

      const snapshot = state.items.find((s) => s.date === state.today);
      if (!snapshot) {
        console.warn(`Snapshot for today (${state.today}) not found`);
        return;
      }

      const habit = snapshot.habbits.find((h) => h.habbitId === habitId);
      if (!habit) {
        console.warn(`Habit ${habitId} not found in today's snapshot`);
        return;
      }

      habit.habbitDidCount = count;
    },

    /**
     * Increment habit count by 1 for TODAY
     */
    incrementHabitDidCount: (state, action: PayloadAction<string>) => {
      const habitId = action.payload;

      const snapshot = state.items.find((s) => s.date === state.today);
      if (!snapshot) return;

      const habit = snapshot.habbits.find((h) => h.habbitId === habitId);
      if (habit) {
        habit.habbitDidCount = Math.min(habit.habbitNeedCount, habit.habbitDidCount + 1);
      }
    },

    /**
     * Update habit target count for TODAY
     */
    updateHabitNeedCount: (
      state,
      action: PayloadAction<{
        habitId: string;
        needCount: number;
      }>
    ) => {
      const { habitId, needCount } = action.payload;

      const snapshot = state.items.find((s) => s.date === state.today);
      if (!snapshot) return;

      const habit = snapshot.habbits.find((h) => h.habbitId === habitId);
      if (habit) {
        habit.habbitNeedCount = needCount;
      }
    },

    /**
     * Add habit to TODAY's snapshot
     */
    addHabitToSnapshot: (
      state,
      action: PayloadAction<{
        habitId: string;
        needCount?: number;
      }>
    ) => {
      const { habitId, needCount = 1 } = action.payload;

      const snapshot = state.items.find((s) => s.date === state.today);
      if (!snapshot) {
        console.warn(`Snapshot for today (${state.today}) not found`);
        return;
      }

      const exists = snapshot.habbits.some((h) => h.habbitId === habitId);
      if (exists) {
        console.warn(`Habit ${habitId} already exists in today's snapshot`);
        return;
      }

      snapshot.habbits.push({
        habbitId: habitId,
        habbitNeedCount: needCount,
        habbitDidCount: 0,
      });
    },

    /**
     * Delete habit from TODAY's snapshot
     */
    deleteHabitFromSnapshot: (state, action: PayloadAction<string>) => {
      const habitId = action.payload;

      const snapshot = state.items.find((s) => s.date === state.today);
      if (!snapshot) return;

      snapshot.habbits = snapshot.habbits.filter((h) => h.habbitId !== habitId);
    },

    /**
     * Delete habit from ALL snapshots
     */
    deleteHabitFromAllSnapshots: (state, action: PayloadAction<string>) => {
      const habitId = action.payload;

      state.items.forEach((snapshot) => {
        snapshot.habbits = snapshot.habbits.filter(
          (h) => h.habbitId !== habitId
        );
      });
    },

    /**
     * Reset habit count to zero for TODAY
     */
    resetHabitCount: (state, action: PayloadAction<string>) => {
      const habitId = action.payload;

      const snapshot = state.items.find((s) => s.date === state.today);
      if (!snapshot) return;

      const habit = snapshot.habbits.find((h) => h.habbitId === habitId);
      if (habit) {
        habit.habbitDidCount = 0;
      }
    },

    // ========================================
    // NOTES OPERATIONS - DON'T ACCEPT today, use state.today
    // ========================================

    /**
     * Update note text for TODAY
     */
    updateNoteText: (
      state,
      action: PayloadAction<{
        noteId: string;
        text: string;
      }>
    ) => {
      const { noteId, text } = action.payload;

      const snapshot = state.items.find((s) => s.date === state.today);
      if (!snapshot) return;

      const note = snapshot.notes.find((n) => n.noteId === noteId);
      if (note) {
        note.noteText = text;
      }
    },

    /**
     * Add note to TODAY's snapshot
     */
    addNoteToSnapshot: (
      state,
      action: PayloadAction<{
        noteId: string;
        text?: string;
      }>
    ) => {
      const { noteId, text = "" } = action.payload;

      const snapshot = state.items.find((s) => s.date === state.today);
      if (!snapshot) return;

      const exists = snapshot.notes.some((n) => n.noteId === noteId);
      if (exists) {
        console.warn(`Note ${noteId} already exists in today's snapshot`);
        return;
      }

      snapshot.notes.push({
        noteId,
        noteText: text,
      });
    },

    /**
     * Delete note from TODAY's snapshot
     */
    deleteNoteFromSnapshot: (state, action: PayloadAction<string>) => {
      const noteId = action.payload;

      const snapshot = state.items.find((s) => s.date === state.today);
      if (!snapshot) return;

      snapshot.notes = snapshot.notes.filter((n) => n.noteId !== noteId);
    },

    /**
     * Delete note from ALL snapshots
     */
    deleteNoteFromAllSnapshots: (state, action: PayloadAction<string>) => {
      const noteId = action.payload;

      state.items.forEach((snapshot) => {
        snapshot.notes = snapshot.notes.filter((n) => n.noteId !== noteId);
      });
    },

    /**
     * Clear note text for TODAY
     */
    clearNoteText: (state, action: PayloadAction<string>) => {
      const noteId = action.payload;

      const snapshot = state.items.find((s) => s.date === state.today);
      if (!snapshot) return;

      const note = snapshot.notes.find((n) => n.noteId === noteId);
      if (note) {
        note.noteText = "";
      }
    },
  },
});

// ===== Actions =====
export const {
  setSnapshots,
  saveDailySnapshot,
  clearSnapshots,
  setTodayAndFillHistory,
  updateHabitDidCount,
  incrementHabitDidCount,
  updateHabitNeedCount,
  addHabitToSnapshot,
  deleteHabitFromSnapshot,
  deleteHabitFromAllSnapshots,
  resetHabitCount,
  updateNoteText,
  addNoteToSnapshot,
  deleteNoteFromSnapshot,
  deleteNoteFromAllSnapshots,
  clearNoteText,
} = snapshotsSlice.actions;

// ===== Selectors =====

/**
 * Get all snapshots
 */
export const selectAllSnapshots = (state: RootState): IDailySnapshot[] =>
  state.snapshots.items;

/**
 * Get today from Redux (always up-to-date thanks to thunk)
 */
export const selectToday = (state: RootState): string =>
  state.snapshots.today ?? "";

/**
 * Get today's snapshot
 */
export const selectTodaySnapshot = (
  state: RootState
): IDailySnapshot | undefined =>
  state.snapshots.items.find((s) => s.date === state.snapshots.today);

/**
 * Get snapshot by date
 */
export const selectSnapshotByDate = (
  state: RootState,
  date: string
): IDailySnapshot | undefined =>
  state.snapshots.items.find((s) => s.date === date);

/**
 * Get last N days snapshots from today
 */
export const selectLastNDaysSnapshots = (
  state: RootState,
  days: number = 30
): IDailySnapshot[] => {
  if (state.snapshots.today) {
    const todayDate = new Date(state.snapshots.today);
    const nDaysAgo = new Date(todayDate);
    nDaysAgo.setDate(nDaysAgo.getDate() - days + 1);

    return state.snapshots.items
      .filter((snapshot) => {
        const snapshotDate = new Date(snapshot.date);
        return snapshotDate >= nDaysAgo && snapshotDate <= todayDate;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  } else {
    return [];
  }
};

/**
 * Get current habit count for today
 */
export const selectCurrentHabitCount = (
  state: RootState,
  habitId: string
): number => {
  const todaySnapshot = selectTodaySnapshot(state);
  if (!todaySnapshot) return 0;

  const habit = todaySnapshot.habbits.find((h) => h.habbitId === habitId);
  return habit?.habbitDidCount || 0;
};

/**
 * Get habit target count for today
 */
export const selectCurrentHabitNeedCount = (
  state: RootState,
  habitId: string
): number => {
  const todaySnapshot = selectTodaySnapshot(state);
  if (!todaySnapshot) return 1;

  const habit = todaySnapshot.habbits.find((h) => h.habbitId === habitId);
  return habit?.habbitNeedCount || 1;
};

/**
 * Get note text for today
 */
export const selectNoteText = (state: RootState, noteId: string): string => {
  const todaySnapshot = selectTodaySnapshot(state);
  if (!todaySnapshot) return "";

  const note = todaySnapshot.notes.find((n) => n.noteId === noteId);
  return note?.noteText || "";
};

/**
 * Check if habit is completed for today
 */
export const selectIsHabitCompleted = (
  state: RootState,
  habitId: string
): boolean => {
  const todaySnapshot = selectTodaySnapshot(state);
  if (!todaySnapshot) return false;

  const habit = todaySnapshot.habbits.find((h) => h.habbitId === habitId);
  if (!habit) return false;

  return habit.habbitDidCount >= habit.habbitNeedCount;
};

/**
 * Check if date is today
 */
export const selectIsToday = (state: RootState, date: string): boolean => {
  return state.snapshots.today === date;
};

/**
 * Check if date is in the future
 */
export const selectIsFuture = (state: RootState, date: string): boolean => {
  return date > (state.snapshots.today ?? "");
};

/**
 * Check if date is in the past
 */
export const selectIsPast = (state: RootState, date: string): boolean => {
  return date < (state.snapshots.today ?? "");
};

/**
 * Get habit statistics for N days
 */
export const selectHabitStats = (
  state: RootState,
  habitId: string,
  days: number = 30
): {
  completedDays: number;
  totalDays: number;
  completionRate: number;
} => {
  const snapshots = selectLastNDaysSnapshots(state, days);

  const completedDays = snapshots.filter((snapshot) => {
    const habit = snapshot.habbits.find((h) => h.habbitId === habitId);
    return habit && habit.habbitDidCount >= habit.habbitNeedCount;
  }).length;

  const totalDays = snapshots.length;
  const completionRate =
    totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  return { completedDays, totalDays, completionRate };
};

// ===== Export =====
export default snapshotsSlice.reducer;
