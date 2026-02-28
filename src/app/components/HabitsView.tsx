"use client";

import { useOptimistic, useTransition, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

import HabitButton from "./habits/HabitButton";
import AddHabit from "./habits/AddHabit";
import AddNote from "./notes/AddNote";
import NoteButton from "./notes/NoteButton";
import HistoryView from "./HistoryView";
import BottomNavigation from "./BottomNavigation";

import {
  incrementHabitAction,
  addHabitAction,
  deleteHabitAction,
  editHabitAction,
} from "../actions/habits";
import {
  addNoteAction,
  editNoteAction,
  deleteNoteAction,
} from "../actions/notes";
import { logoutAction } from "../actions/auth";

import IHabit from "@/src/lib/types/habit";
import INote from "@/src/lib/types/note";
import IDailySnapshot from "@/src/lib/types/dailySnapshot";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

type ViewState = {
  habits: IHabit[];
  notes: INote[];
  todaySnapshot: IDailySnapshot;
};

type OptimisticAction =
  | { type: "increment"; habitId: string; newCount: number }
  | { type: "addHabit"; habit: IHabit; needCount: number }
  | { type: "deleteHabit"; habitId: string }
  | { type: "editHabit"; habit: IHabit; needCount: number; actualCount: number }
  | { type: "addNote"; note: INote; text: string }
  | { type: "editNote"; noteId: string; newName: string; newText: string }
  | { type: "deleteNote"; noteId: string };

type Props = {
  habits: IHabit[];
  notes: INote[];
  todaySnapshot: IDailySnapshot;
  allSnapshots: IDailySnapshot[];
  todayStr: string; // "YYYY-MM-DD"
};

// ─────────────────────────────────────────────────────────
// Optimistic reducer
// ─────────────────────────────────────────────────────────

function reduce(state: ViewState, action: OptimisticAction): ViewState {
  switch (action.type) {
    case "increment":
      return {
        ...state,
        todaySnapshot: {
          ...state.todaySnapshot,
          habits: state.todaySnapshot.habits.map((h) =>
            h.habitId === action.habitId
              ? { ...h, habitDidCount: action.newCount }
              : h
          ),
        },
      };
    case "addHabit":
      return {
        ...state,
        habits: [...state.habits, action.habit],
        todaySnapshot: {
          ...state.todaySnapshot,
          habits: [
            ...state.todaySnapshot.habits,
            { habitId: action.habit.id, habitNeedCount: action.needCount, habitDidCount: 0 },
          ],
        },
      };
    case "deleteHabit":
      return {
        ...state,
        todaySnapshot: {
          ...state.todaySnapshot,
          habits: state.todaySnapshot.habits.filter((h) => h.habitId !== action.habitId),
        },
      };
    case "editHabit":
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.habit.id ? action.habit : h)),
        todaySnapshot: {
          ...state.todaySnapshot,
          habits: state.todaySnapshot.habits.map((h) =>
            h.habitId === action.habit.id
              ? { ...h, habitNeedCount: action.needCount, habitDidCount: action.actualCount }
              : h
          ),
        },
      };
    case "addNote":
      return {
        ...state,
        notes: [...state.notes, action.note],
        todaySnapshot: {
          ...state.todaySnapshot,
          notes: [...state.todaySnapshot.notes, { noteId: action.note.id, noteText: action.text }],
        },
      };
    case "editNote":
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.noteId ? { ...n, name: action.newName } : n
        ),
        todaySnapshot: {
          ...state.todaySnapshot,
          notes: state.todaySnapshot.notes.map((n) =>
            n.noteId === action.noteId ? { ...n, noteText: action.newText } : n
          ),
        },
      };
    case "deleteNote":
      return {
        ...state,
        todaySnapshot: {
          ...state.todaySnapshot,
          notes: state.todaySnapshot.notes.filter((n) => n.noteId !== action.noteId),
        },
      };
  }
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export default function HabitsView({
  habits,
  notes,
  todaySnapshot,
  allSnapshots,
  todayStr,
}: Props) {
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");
  const [, startTransition] = useTransition();
  const router = useRouter();

  const [optimistic, addOptimistic] = useOptimistic<ViewState, OptimisticAction>(
    { habits, notes, todaySnapshot },
    reduce
  );

  // "today" as a Date object for HistoryView
  const todayDate = useMemo(() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [todayStr]);

  const todayDisplayed = todayDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
  });

  // ── Habit handlers ───────────────────────────────────────

  function handleIncrement(habitId: string) {
    const current = optimistic.todaySnapshot.habits.find((h) => h.habitId === habitId);
    const newCount = (current?.habitDidCount ?? 0) + 1;
    startTransition(async () => {
      addOptimistic({ type: "increment", habitId, newCount });
      await incrementHabitAction(habitId, newCount);
    });
  }

  function handleAddHabit(habit: IHabit, needCount: number) {
    startTransition(async () => {
      addOptimistic({ type: "addHabit", habit, needCount });
      await addHabitAction(habit, needCount);
    });
  }

  function handleDeleteHabit(habitId: string) {
    startTransition(async () => {
      addOptimistic({ type: "deleteHabit", habitId });
      await deleteHabitAction(habitId);
    });
  }

  function handleEditHabit(habit: IHabit, needCount: number, actualCount: number) {
    startTransition(async () => {
      addOptimistic({ type: "editHabit", habit, needCount, actualCount });
      await editHabitAction(habit, needCount, actualCount);
    });
  }

  // ── Note handlers ────────────────────────────────────────

  function handleAddNote(note: INote, text: string) {
    startTransition(async () => {
      addOptimistic({ type: "addNote", note, text });
      await addNoteAction(note, text);
    });
  }

  function handleEditNote(note: INote, newText: string) {
    startTransition(async () => {
      addOptimistic({ type: "editNote", noteId: note.id, newName: note.name, newText });
      await editNoteAction(note.id, note.name, newText);
    });
  }

  function handleDeleteNote(noteId: string) {
    startTransition(async () => {
      addOptimistic({ type: "deleteNote", noteId });
      await deleteNoteAction(noteId);
    });
  }

  // ── Derived display lists ────────────────────────────────

  const displayHabits = optimistic.todaySnapshot.habits.map((h) => ({
    habitId: h.habitId,
    text: optimistic.habits.find((hab) => hab.id === h.habitId)?.text ?? "",
    needCount: h.habitNeedCount,
    actualCount: h.habitDidCount,
  }));

  const displayNotes = optimistic.todaySnapshot.notes.map((n) => ({
    noteId: n.noteId,
    noteName: optimistic.notes.find((note) => note.id === n.noteId)?.name ?? "",
    noteText: n.noteText,
  }));

  const hasContent = displayHabits.length > 0 || displayNotes.length > 0;

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-2xl mx-auto bg-white min-h-screen shadow-sm">
        <main className="p-4 pb-20">
          {activeTab === "today" ? (
            <>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-6">
                {hasContent
                  ? `Habits for today (${todayDisplayed}):`
                  : "Add habit or note using the button below"}
              </h1>

              {/* Connection status */}
              <div className="mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-5 py-3">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Synced
                </div>
                <button
                  onClick={() => startTransition(async () => { await logoutAction(); router.refresh(); })}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {hasContent && (
                <div className="mb-4 w-full space-y-4">
                  {displayHabits.map((h) => (
                    <HabitButton
                      key={h.habitId}
                      habit={{ id: h.habitId, text: h.text }}
                      currentCount={h.actualCount}
                      needCount={h.needCount}
                      onIncrement={handleIncrement}
                      onEdit={handleEditHabit}
                      onDelete={handleDeleteHabit}
                    />
                  ))}
                  {displayNotes.map((n) => (
                    <NoteButton
                      key={n.noteId}
                      note={{ id: n.noteId, name: n.noteName }}
                      text={n.noteText}
                      onEdit={(note, text) => handleEditNote(note, text)}
                      onDelete={handleDeleteNote}
                    />
                  ))}
                </div>
              )}

              <AddHabit onAdd={handleAddHabit} />
              <AddNote onAdd={handleAddNote} />
            </>
          ) : (
            <HistoryView
              habits={optimistic.habits}
              notes={optimistic.notes}
              snapshots={allSnapshots}
              today={todayDate}
            />
          )}
        </main>

        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}
