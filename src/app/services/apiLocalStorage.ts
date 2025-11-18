"use client"

import IHabbit from "../types/habbit";
import IDailySnapshot from "../types/dailySnapshot";
import INote from "../types/note";
import { getDate00, getDateString } from "../helpers/date";

// Storage keys for localStorage
const HABITS_STORAGE_KEY = "habits";
const DAILY_SNAPSHOTS_STORAGE_KEY = "dailySnapshots";
const NOTES_STORAGE_KEY = "notes";

/**
 * Adds a new habit to localStorage
 * */
export const addHabit = (habit: IHabbit): boolean => {
  try {
    // Get existing habits from localStorage
    const existingHabitsJson = localStorage.getItem(HABITS_STORAGE_KEY);
    const existingHabits: IHabbit[] = existingHabitsJson
      ? JSON.parse(existingHabitsJson)
      : [];

    // Check if habit with this id already exists
    const habitExists = existingHabits.some(
      (existingHabit) => existingHabit.id === habit.id
    );
    if (habitExists) {
      // console.error("Habit with this id already exists:", habit.id);
      return false;
    }

    // Add new habit
    const updatedHabits = [...existingHabits, habit];

    // Save updated list to localStorage
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(updatedHabits));

    return true;
  } catch (error) {
    console.error("Error adding habit to localStorage:", error);
    return false;
  }
};

// Additional function to get all habits
export const getHabits = (): IHabbit[] => {
  try {
    const habitsJson = localStorage.getItem(HABITS_STORAGE_KEY);
    return habitsJson ? JSON.parse(habitsJson) : [];
  } catch (error) {
    console.error("Error getting habits from localStorage:", error);
    return [];
  }
};

export const getHabit = (id: string): IHabbit | undefined => {
  try {
    const habitsJson = localStorage.getItem(HABITS_STORAGE_KEY);
    const habbits: IHabbit[] = habitsJson ? JSON.parse(habitsJson) : [];
    const searchHabbit = habbits.find((h) => h.id === id);
    return searchHabbit;
  } catch (error) {
    console.error("Error getting habits from localStorage:", error);
    return undefined;
  }
};

export const updateHabit = (updatedHabit: IHabbit): void => {
  const habits = JSON.parse(localStorage.getItem("habits") || "[]");
  const updated = habits.map((habit: IHabbit) =>
    habit.id === updatedHabit.id ? updatedHabit : habit
  );
  localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(updated));
};

/**
 * delete Habbit in todays' snapshot
 */
export const deleteHabbitFromSnapshot = (id: string, today: Date): void => {
  const todaySnapshot = getTodaySnapshot(today);
  todaySnapshot.habbits = todaySnapshot.habbits.filter((h) => h.habbitId !== id);
  saveDailySnapshot(todaySnapshot);
  // const habits = JSON.parse(localStorage.getItem("habits") || "[]");
  // const updated = habits.filter((habit: IHabbit) => habit.id !== id);
  // localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(updated));

};

/**
 * Daily snapshots functions
 */
export const getDailySnapshotsRaw = (): IDailySnapshot[] => {
  try {
    const snapshotsJson = localStorage.getItem(DAILY_SNAPSHOTS_STORAGE_KEY);
    return snapshotsJson ? JSON.parse(snapshotsJson) : [];
  } catch (error) {
    console.error("Error getting daily snapshots from localStorage:", error);
    return [];
  }
};

export const getDailySnapshots = (today: Date): IDailySnapshot[] => {
  fillHistory(today);
  return getDailySnapshotsRaw();
};

export const saveDailySnapshot = (
  snapshot: IDailySnapshot
): boolean => {
  try {
    const existingSnapshots = getDailySnapshotsRaw();

    // If no existing snapshots, just add the first one
    if (existingSnapshots.length === 0) {
      existingSnapshots.push(snapshot);
    } else {
      // Insert at proper position
      for (let i = 0; i < existingSnapshots.length; i++) {
        const element = existingSnapshots[i];
        const isSameDay = element.date === snapshot.date;
        const isAfterSnapshot = getDate00(element.date) > getDate00(snapshot.date);
        const isLastElement = i === existingSnapshots.length - 1;
        
        if (isSameDay) {
          existingSnapshots[i] = snapshot;
          break;
        } else if (isAfterSnapshot) {
          existingSnapshots.splice(i, 0, snapshot);
          break;
        } else if (isLastElement) {
          existingSnapshots.push(snapshot);
          break;
        }
      }
    }

    localStorage.setItem(
      DAILY_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify(existingSnapshots)
    );
    return true;
  } catch (error) {
    console.error("Error saving daily snapshot:", error);
    return false;
  }
};

/**
 * Also creates snapshot if it did not exist
 */
export const getTodaySnapshot = (today: Date): IDailySnapshot => {
  const snapshots = getDailySnapshotsRaw();
  const todayDay = getDateString(today);
  let todaySnapshot = snapshots.find((s) => s.date === todayDay);

  if (!todaySnapshot) {
    // Create today's snapshot if it doesn't exist
    if (snapshots.length === 0) {
      // No previous snapshots - create empty snapshot that will be populated when habits are added
      todaySnapshot = {
        date: todayDay,
        habbits: [],
        notes: []
      };
    } else {
      // Get previous day's snapshot and reset counts to 0
      const previousSnapshot = snapshots.sort((a, b) =>
        b.date.localeCompare(a.date)
      )[0];

      todaySnapshot = {
        date: todayDay,
        habbits: previousSnapshot.habbits.map((h) => ({
          habbitId: h.habbitId,
          habbitNeedCount: h.habbitNeedCount,
          habbitDidCount: 0,
        })),
        notes: previousSnapshot.notes?.map((n) => ({
          noteId: n.noteId,
          noteText: ""
        })) || []
      };
    }
    
    // Save the new snapshot
    saveDailySnapshot(todaySnapshot);
  }
  return todaySnapshot;
};

/**
 * If there are empty days from last snapshot day and today, fill theese days with snapshots
 * so we will understand later that there were habbits but they were not incremented
 */
export const fillHistory = (today: Date): void => {
  // create todays snapshot to be sure it is created
  getTodaySnapshot(today);

  // today with time 00.00.00 for correct currentDate < today compare
  const today00 = getDate00(today);
  let previousSnapshot;
  const snapshots = getDailySnapshotsRaw();

  if (snapshots.length > 1) {
    previousSnapshot = snapshots.sort((a, b) =>
      b.date.localeCompare(a.date)
    )[1];

    const currentDate = getDate00(previousSnapshot.date);
    // increase current date by 1 to compare with today. 
    // If it makes day like 32 it is transformed to new month automatically
    currentDate.setDate(currentDate.getDate() + 1);

    while (currentDate <= today00) {
      const date = getDateString(currentDate);
      const snapshot = {
        date: date,
        habbits: previousSnapshot.habbits.map((h) => {
          return {
            habbitId: h.habbitId,
            habbitNeedCount: h.habbitNeedCount,
            habbitDidCount: 0,
          };
        }),
        notes: previousSnapshot.notes?.map((n) => ({
          noteId: n.noteId,
          noteText: ""
        })) || []
      };

      saveDailySnapshot(snapshot);

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
};

/**
 * Helper function to get current need count for a habit
 */
export const getCurrentNeedCount = (habitId: string, today: Date): number => {
  const todaySnapshot = getTodaySnapshot(today);

  const habit = todaySnapshot.habbits.find((h) => h.habbitId === habitId);
  return habit?.habbitNeedCount || 1;
};

/**
 * Helper function to get current actual count for a habit
 */
export const getCurrentActualCount = (
  habitId: string,
  today: Date
): number => {
  const todaySnapshot = getTodaySnapshot(today);

  const habit = todaySnapshot.habbits.find((h) => h.habbitId === habitId);
  return habit?.habbitDidCount || 0;
};

/**
 * Update habit count in today's snapshot
 */
export const updateHabitCount = (
  habitId: string,
  newCount: number,
  today: Date
): boolean => {
  try {
    const todaySnapshot = getTodaySnapshot(today);

    // Update the specific habit count
    const habitIndex = todaySnapshot.habbits.findIndex(
      (h) => h.habbitId === habitId
    );
    if (habitIndex !== -1) {
      todaySnapshot.habbits[habitIndex].habbitDidCount = newCount;
    }

    return saveDailySnapshot(todaySnapshot);
  } catch (error) {
    console.error("Error updating habit count:", error);
    return false;
  }
};

/**
 * Update habit need count in today's snapshot
 */
export const updateHabitNeedCount = (
  habitId: string,
  newNeedCount: number,
  today: Date,
): boolean => {
  try {
    const todaySnapshot = getTodaySnapshot(today);

    const habitIndex = todaySnapshot.habbits.findIndex(
      (h) => h.habbitId === habitId
    );
    if (habitIndex !== -1) {
      todaySnapshot.habbits[habitIndex].habbitNeedCount = newNeedCount;
    }

    return saveDailySnapshot(todaySnapshot);
  } catch (error) {
    console.error("Error updating habit need count:", error);
    return false;
  }
};

/**
 * Notes management functions
 */

/**
 * Adds a new note to localStorage
 */
export const addNote = (note: INote): boolean => {
  try {
    const existingNotesJson = localStorage.getItem(NOTES_STORAGE_KEY);
    const existingNotes: INote[] = existingNotesJson
      ? JSON.parse(existingNotesJson)
      : [];

    // Check if note with this id already exists
    const noteExists = existingNotes.some(
      (existingNote) => existingNote.id === note.id
    );
    if (noteExists) {
      return false;
    }

    // Add new note
    const updatedNotes = [...existingNotes, note];

    // Save updated list to localStorage
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updatedNotes));

    return true;
  } catch (error) {
    console.error("Error adding note to localStorage:", error);
    return false;
  }
};

/**
 * Get all notes from localStorage
 */
export const getNotes = (): INote[] => {
  try {
    const notesJson = localStorage.getItem(NOTES_STORAGE_KEY);
    return notesJson ? JSON.parse(notesJson) : [];
  } catch (error) {
    console.error("Error getting notes from localStorage:", error);
    return [];
  }
};

/**
 * Get a single note by ID
 */
export const getNote = (id: string): INote | undefined => {
  try {
    const notesJson = localStorage.getItem(NOTES_STORAGE_KEY);
    const notes: INote[] = notesJson ? JSON.parse(notesJson) : [];
    return notes.find((n) => n.id === id);
  } catch (error) {
    console.error("Error getting note from localStorage:", error);
    return undefined;
  }
};

/**
 * Update a note in localStorage
 */
export const updateNote = (updatedNote: INote): boolean => {
  try {
    const notes = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || "[]");
    const updated = notes.map((note: INote) =>
      note.id === updatedNote.id ? updatedNote : note
    );
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error("Error updating note:", error);
    return false;
  }
};

/**
 * Delete note from today's snapshot
 */
export const deleteNoteFromSnapshot = (id: string, today: Date): void => {
  const todaySnapshot = getTodaySnapshot(today);
  todaySnapshot.notes = todaySnapshot.notes.filter((n) => n.noteId !== id);
  saveDailySnapshot(todaySnapshot);
};

  /**
   * using proper methods like addHabit and saveDailySnapshot initializesHabits
   */
  export const initializeHabitsLocalStorage = async (
    habits: IHabbit[],
    notes: INote[],
    snapshots: IDailySnapshot[]
  ) => {
    try {
      localStorage.removeItem(DAILY_SNAPSHOTS_STORAGE_KEY);
      localStorage.removeItem(HABITS_STORAGE_KEY);
      localStorage.removeItem(NOTES_STORAGE_KEY);

      // Add all habits to localStorage
      for (const habit of habits) {
        addHabit(habit);
      }

      // Add notes to localStorage
      for (const note of notes) {
        addNote(note);
      }


      // Add all daily snapshots to localStorage
      for (const snapshot of snapshots) {
        saveDailySnapshot(snapshot);
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  };
