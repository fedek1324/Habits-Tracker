"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import HabitButton from "./components/HabbitButton";
import AddHabbit from "./components/AddHabbit";
import AddNote from "./components/AddNote";
import IntegrationPannel from "./components/IntegrationPannel";
import BottomNavigation from "./components/BottomNavigation";
import HistoryView from "./components/HistoryView";
import NoteButton from "./components/NoteButton";

import { useAppDispatch, useAppSelector } from "@/src/lib/hooks";
import {
  selectToday,
  selectAllSnapshots,
  selectTodaySnapshot,
  updateNoteText,
  deleteHabitFromSnapshot,
  updateHabitNeedCount,
  updateHabitDidCount,
  deleteNoteFromSnapshot,
  incrementHabitDidCount,
} from "@/src/lib/features/habitsAndNotes/snapshotsSlice";
import { selectAllHabits, updateHabit } from "@/src/lib/features/habitsAndNotes/habitsSlice";
import { selectAllNotes, updateNote } from "@/src/lib/features/habitsAndNotes/notesSlice";
import { addHabitWithSnapshot, addNoteWithSnapshot, initializeStore } from "@/src/lib/features/habitsAndNotes/thunks";
import {
  selectGoogleStatus,
  selectRefreshToken,
  selectSpreadsheetUrl,
  setRefreshToken,
  setAccessToken,
} from "@/src/lib/features/googleSheets/googleSheetsSlice";
import { uploadDataToGoogle } from "@/src/lib/features/googleSheets/thunks";
import { useHabitsSync } from "@/src/app/hooks/useHabitsSync";

import IHabbit from "@/src/app/types/habbit";
import INote from "@/src/app/types/note";
import { GoogleState } from "@/src/app/types/googleState";

import {
  getDailySnapshotsRaw,
  getHabits,
  getNotes,
} from "./services/apiLocalStorage";
import { getDate00 } from "./helpers/date";

type DisplayHabit = {
  habitId: string;
  text: string;
  needCount: number;
  actualCount: number;
};

type DisplayNote = {
  noteId: string;
  noteName: string;
  noteText: string;
};

export default function Home() {
  const dispatch = useAppDispatch();

  const habits = useAppSelector(selectAllHabits);
  const notes = useAppSelector(selectAllNotes);
  const snapshots = useAppSelector(selectAllSnapshots);
  const today = useAppSelector(selectToday);
  const todaySnapshot = useAppSelector(selectTodaySnapshot);
  const googleState = useAppSelector(selectGoogleStatus);
  const refreshToken = useAppSelector(selectRefreshToken);
  const spreadsheetUrl = useAppSelector(selectSpreadsheetUrl);

  const [activeTab, setActiveTab] = useState<"today" | "history">("today");

  const todayDate = useMemo(() => (today ? getDate00(today) : undefined), [today]);

  // SWR-based 30s polling — dispatches to Redux on each successful fetch
  const { triggerSync } = useHabitsSync();

  // Restore refresh token from localStorage into Redux on mount.
  // Required because Redux starts empty on every page load.
  useEffect(() => {
    const stored = localStorage.getItem("googleRefreshToken");
    if (stored) dispatch(setRefreshToken(stored));
  }, [dispatch]);

  // Load from localStorage when not connected to Google
  useEffect(() => {
    if (!today || refreshToken) return;
    dispatch(
      initializeStore({
        habits: getHabits(),
        notes: getNotes(),
        snapshots: getDailySnapshotsRaw(),
        today,
      })
    );
  }, [today, refreshToken, dispatch]);

  // ── Auth handlers ────────────────────────────────────────

  const handleSetRefreshToken = useCallback(
    (token: string) => {
      localStorage.setItem("googleRefreshToken", token || "");
      dispatch(setRefreshToken(token || null));
    },
    [dispatch]
  );

  const handleSetAccessToken = useCallback(
    (token: string) => {
      dispatch(setAccessToken(token || null));
    },
    [dispatch]
  );

  const handleSyncNowButtonClick = useCallback(() => {
    triggerSync();
  }, [triggerSync]);

  // ── Habit handlers ───────────────────────────────────────

  const handleAddHabit = async (newHabit: IHabbit, needCount: number) => {
    dispatch(addHabitWithSnapshot({ habit: newHabit, initialNeedCount: needCount }));
    dispatch(uploadDataToGoogle());
  };

  const handleIncrement = async (id: string) => {
    dispatch(incrementHabitDidCount(id));
    dispatch(uploadDataToGoogle());
  };

  const handleDelete = async (id: string) => {
    dispatch(deleteHabitFromSnapshot(id));
    dispatch(uploadDataToGoogle());
  };

  const handleEdit = async (
    habitChanged: IHabbit,
    newNeedCount: number,
    newActualCount: number
  ) => {
    dispatch(updateHabit(habitChanged));
    dispatch(updateHabitNeedCount({ habitId: habitChanged.id, needCount: newNeedCount }));
    dispatch(updateHabitDidCount({ habitId: habitChanged.id, count: newActualCount }));
    dispatch(uploadDataToGoogle());
  };

  // ── Note handlers ────────────────────────────────────────

  const handleAddNote = async (newNote: INote, text: string) => {
    dispatch(addNoteWithSnapshot({ note: newNote, initialText: text }));
    dispatch(uploadDataToGoogle());
  };

  const handleNoteEdit = async (noteChanged: INote, noteText: string) => {
    dispatch(updateNote(noteChanged));
    dispatch(updateNoteText({ noteId: noteChanged.id, text: noteText }));
    dispatch(uploadDataToGoogle());
  };

  const handleNoteDelete = async (id: string) => {
    dispatch(deleteNoteFromSnapshot(id));
    dispatch(uploadDataToGoogle());
  };

  // ── Derived display data ─────────────────────────────────

  const displayHabits: DisplayHabit[] = useMemo(() => {
    if (!todaySnapshot) return [];
    return todaySnapshot.habbits.map((habit) => ({
      habitId: habit.habbitId,
      text: habits.find((h) => h.id === habit.habbitId)?.text ?? "No text for today",
      needCount: habit.habbitNeedCount,
      actualCount: habit.habbitDidCount,
    }));
  }, [todaySnapshot, habits]);

  const displayNotes: DisplayNote[] = useMemo(() => {
    if (!todaySnapshot) return [];
    return todaySnapshot.notes.map((note) => ({
      noteId: note.noteId,
      noteName: notes.find((n) => n.id === note.noteId)?.name ?? "No text",
      noteText: note.noteText,
    }));
  }, [todaySnapshot, notes]);

  const todayDisplayed = todayDate
    ? todayDate.toLocaleDateString("en-US", { day: "numeric", month: "long" })
    : "loading...";

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-2xl mx-auto bg-white min-h-screen shadow-sm">
        <main className="p-4 pb-20">
          {activeTab === "today" ? (
            <>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-6">
                {displayHabits.length > 0 || displayNotes.length > 0
                  ? `Habits for today (${todayDisplayed}):`
                  : "Add habit or note using the button below"}
              </h1>

              <div className="mb-4">
                <IntegrationPannel
                  state={googleState ?? GoogleState.NOT_CONNECTED}
                  spreadSheetUrl={spreadsheetUrl ?? undefined}
                  onSyncNowClick={handleSyncNowButtonClick}
                  onSetGoogleRefreshToken={handleSetRefreshToken}
                  onSetGoogleAccessToken={handleSetAccessToken}
                />
              </div>

              {(displayHabits.length > 0 || displayNotes.length > 0) && (
                <div className="mb-4 w-full space-y-4">
                  {displayHabits.map((habit) => (
                    <HabitButton
                      key={habit.habitId}
                      habbit={{ id: habit.habitId, text: habit.text }}
                      currentCount={habit.actualCount}
                      needCount={habit.needCount}
                      onIncrement={handleIncrement}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                  {displayNotes.map((note) => (
                    <NoteButton
                      key={note.noteId}
                      note={{ id: note.noteId, name: note.noteName }}
                      text={note.noteText}
                      onEdit={handleNoteEdit}
                      onDelete={handleNoteDelete}
                    />
                  ))}
                </div>
              )}

              <AddHabbit onAdd={handleAddHabit} />
              <AddNote onAdd={handleAddNote} />
            </>
          ) : todayDate ? (
            <HistoryView
              habits={habits}
              notes={notes}
              snapshots={snapshots}
              today={todayDate}
            />
          ) : null}
        </main>

        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}
