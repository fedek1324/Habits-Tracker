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
import {
  selectAllHabits,
  updateHabit,
} from "@/src/lib/features/habitsAndNotes/habitsSlice";
import { selectAllNotes, updateNote } from "@/src/lib/features/habitsAndNotes/notesSlice";
import { addHabitWithSnapshot, addNoteWithSnapshot, initializeStore } from "@/src/lib/features/habitsAndNotes/thunks";

import IHabbit from "@/src/app/types/habbit";
import INote from "@/src/app/types/note";

import { GoogleState } from "@/src/app/types/googleState";
import { useGoogleSheets } from "@/src/app/hooks/useGoogleSheets";

import {
  getDailySnapshotsRaw,
  getHabits,
  getNotes,
} from "./services/apiLocalStorage";
import { getDate00 } from "./helpers/date";

type DispalyHabbit = {
  habitId: string;
  text: string;
  needCount: number;
  actualCount: number;
};

type DispalyNote = {
  noteId: string;
  noteName: string;
  noteText: string;
};

let homeRenderCount = 0;

export default function Home() {
  const dispatch = useAppDispatch();
  const habits = useAppSelector(selectAllHabits);
  const notes = useAppSelector(selectAllNotes);
  const snapshots = useAppSelector(selectAllSnapshots)
  const today = useAppSelector(selectToday);
  const todaySnapshot = useAppSelector(selectTodaySnapshot);


  const [activeTab, setActiveTab] = useState<"today" | "history">("today");
  // const [error, setError] = useState<string>("");

  const [refreshToken, setRefreshTokenPrivate] = useState<string>(
    typeof window !== "undefined"
      ? localStorage.getItem("googleRefreshToken") || ""
      : ""
  );

  const todayDate = useMemo(() => getDate00(today), [today]);

  const {
    googleState,
    getGoogleData,
    uploadDataToGoogle,
    spreadsheetUrl,
    setGoolgeAccessToken,
    loadedData,
  } = useGoogleSheets(todayDate, refreshToken);

  // const prevGoogleStateRef = useRef<GoogleState>(GoogleState.NOT_CONNECTED);

  // TODO maybe create some async thunk that will init data on client to bypass hydration (local storage issue)
  useEffect(() => {
    // synchronize habits data with local storage or google
    if (today) {
      if (loadedData) {
        console.log("Home: effect called Getting data from loaded data", loadedData, today);
        // also fills history empty day snapshots
        dispatch(initializeStore({ ...loadedData, today }));
      } else {
        console.log("Home: effect called Getting data from local storage");
        // get from local storage
        const habitsLocalStorage = getHabits();
        const notesLocalStorage = getNotes();
        const snapshotsLocalStorage = getDailySnapshotsRaw();

        // fill history in local storage
        dispatch(
          initializeStore({
            habits: habitsLocalStorage,
            notes: notesLocalStorage,
            snapshots: snapshotsLocalStorage,
            today,
          })
        );
      }
    } else {
      console.log("Home: effect called No today in Home effect");
    }
  }, [today, loadedData, dispatch]);
  
  const setRefreshToken = (refreshToken: string) => {
    localStorage.setItem("googleRefreshToken", refreshToken || "");
    setRefreshTokenPrivate(refreshToken || "");
  };

  homeRenderCount++;
  console.log("Home: render. Total: " + homeRenderCount);

  const handleSyncNowButtonClick = useCallback(() => {
    if (!todayDate) {
      return;
    }
    getGoogleData(todayDate);
  }, [getGoogleData, todayDate]);

  const handleAddHabit = async (newHabbit: IHabbit, needCount: number) => {
    dispatch(addHabitWithSnapshot({ habit: newHabbit, initialNeedCount: needCount }))

    await uploadDataToGoogle(todayDate, "handleAdd");
  };

  const handleIncrement = async (id: string) => {
    dispatch(incrementHabitDidCount(id));

    await uploadDataToGoogle(todayDate, "handleAdd");
  };

  const handleDelete = async (id: string) => {
    // habit remains in habits storage to display it in history.
    // removing from todays snapshot to not add habit on next day.
    dispatch(deleteHabitFromSnapshot(id))

    // Update google
    await uploadDataToGoogle(todayDate, "handleAdd");
  };

  const handleEdit = async (
    habitChanged: IHabbit,
    newNeedCount: number,
    newActualCount: number
  ) => {
    // TODO create thunk maybe
    dispatch(updateHabit(habitChanged));
    dispatch(updateHabitNeedCount({habitId: habitChanged.id, needCount: newNeedCount}));
    dispatch(updateHabitDidCount({habitId: habitChanged.id, count: newActualCount}));

    await uploadDataToGoogle(todayDate, "handleAdd");
  };

  const handleAddNote = async (newNote: INote, text: string) => {
    dispatch(addNoteWithSnapshot({note: newNote, initialText: text}));
    await uploadDataToGoogle(todayDate, "handleAdd");
  };

  const handleNoteEdit = async (noteChanged: INote, noteText: string) => {
    // TODO create thunk maybe
    dispatch(updateNote(noteChanged));
    dispatch(updateNoteText({noteId: noteChanged.id, text: noteText}));

    // Update google
    await uploadDataToGoogle(todayDate, "handleAdd");
  };

  const handleNoteDelete = async (id: string) => {
    // habit remains in habits storage to display it in history.
    // removing from todays snapshot to not add habit on next day.
    dispatch(deleteNoteFromSnapshot(id));

    // Update google
    await uploadDataToGoogle(todayDate, "handleAdd");
  };
  
  const displayHabits: DispalyHabbit[] = useMemo(() => {
    const res = [];
    console.log(todaySnapshot);
    if (todaySnapshot) {
      console.log(todaySnapshot.habbits);
      for (const habit of todaySnapshot.habbits) {
        res.push({
          habitId: habit.habbitId,
          text:
            habits.find((h) => h.id === habit.habbitId)?.text ||
            "No text for today",
          needCount: habit.habbitNeedCount,
          actualCount: habit.habbitDidCount,
        });
      }
    }
    return res;
  }, [todaySnapshot, habits]);

  const displayNotes: DispalyNote[] = useMemo(() => {
    const res = [];
    if (todaySnapshot) {
      for (const note of todaySnapshot.notes) {
        res.push({
          noteId: note.noteId,
          noteName: notes.find((n) => n.id === note.noteId)?.name || "No text",
          noteText: note.noteText,
        });
      }
    }
    return res;
  }, [todaySnapshot, notes]);

  const todayDisplayed = todayDate
    ? todayDate.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
      })
    : "loading...";

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

              {/*Google integration panel */}
              <div className="mb-4">
                <IntegrationPannel
                  state={googleState ?? GoogleState.NOT_CONNECTED}
                  spreadSheetUrl={spreadsheetUrl}
                  onSyncNowClick={handleSyncNowButtonClick}
                  onSetGoogleRefreshToken={setRefreshToken}
                  onSetGoogleAccessToken={setGoolgeAccessToken}
                />
              </div>

              {/* Habbits and notes list */}
              {(displayHabits.length > 0 || displayNotes.length > 0) && (
                <div className="mb-4 w-full space-y-4">
                  {displayHabits.map((habit) => {
                    return (
                      <HabitButton
                        key={habit.habitId}
                        habbit={{
                          id: habit.habitId,
                          text: habit.text,
                        }}
                        currentCount={habit.actualCount}
                        needCount={habit.needCount}
                        onIncrement={handleIncrement}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    );
                  })}
                  {displayNotes.map((note) => {
                    return (
                      <NoteButton
                        key={note.noteId}
                        note={{
                          id: note.noteId,
                          name: note.noteName,
                        }}
                        text={note.noteText}
                        onEdit={handleNoteEdit}
                        onDelete={handleNoteDelete}
                      />
                    );
                  })}
                </div>
              )}

              <AddHabbit onAdd={handleAddHabit} />
              <AddNote onAdd={handleAddNote} />
            </>
          ) : (
            <HistoryView
              habits={habits}
              notes={notes}
              snapshots={snapshots}
              today={todayDate}
            />
          )}
        </main>

        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}
