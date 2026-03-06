"use client";

import { FormEventHandler, useEffect, useMemo, useState } from "react";
import IHabit from "@/src/lib/types/habit";
import INote from "@/src/lib/types/note";
import IDailySnapshot from "@/src/lib/types/dailySnapshot";
import { getDate00 } from "@/src/lib/utils/date";
import { IoCheckmarkCircle } from "react-icons/io5";
import { MdOutlineEdit } from "react-icons/md";
import Modal from "./Modal";

interface HistoryViewProps {
  habits: IHabit[];
  notes: INote[];
  snapshots: IDailySnapshot[];
  today: Date;
  onEditHabit: (dateStr: string, habitId: string, newCount: number) => void;
  onEditNote: (dateStr: string, noteId: string, newText: string) => void;
}

type DailyHistory = {
  date: string;
  habits: {
    habitId: string;
    habitText: string;
    habitNeedCount: number;
    habitDidCount: number;
  }[];
  notes: {
    noteId: string;
    noteName: string;
    noteText: string;
  }[];
};

type EditModal =
  | {
      type: "habit";
      dateStr: string;
      habitId: string;
      habitText: string;
      currentCount: number;
      needCount: number;
    }
  | {
      type: "note";
      dateStr: string;
      noteId: string;
      noteName: string;
      currentText: string;
    }
  | null;

const HistoryView: React.FC<HistoryViewProps> = ({
  habits,
  notes,
  snapshots,
  today,
  onEditHabit,
  onEditNote,
}) => {
  const [editModal, setEditModal] = useState<EditModal>(null);
  const [habitCountInput, setHabitCountInput] = useState("");
  const [countError, setCountError] = useState("");
  const [noteTextInput, setNoteTextInput] = useState("");

  useEffect(() => {
    if (editModal?.type === "habit") {
      setHabitCountInput(String(editModal.currentCount));
      setCountError("");
    } else if (editModal?.type === "note") {
      setNoteTextInput(
        editModal.currentText === "No text for that day" ? "" : editModal.currentText
      );
    }
  }, [editModal]);

  const PAGE_SIZE = 7;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const history: DailyHistory[] = useMemo(() => {
    if (!snapshots) return [];
    const habitMap = new Map(habits.map((h) => [h.id, h.text]));
    const noteMap = new Map(notes.map((n) => [n.id, n.name]));
    const today00 = getDate00(today);
    return snapshots
      .filter((s) => getDate00(s.date) <= today00)
      .map((s) => ({
        date: s.date,
        habits: s.habits.map((h) => ({
          habitId: h.habitId,
          habitText: habitMap.get(h.habitId) || "Unknown Habit",
          habitNeedCount: h.habitNeedCount,
          habitDidCount: h.habitDidCount,
        })),
        notes: (s.notes || []).map((n) => ({
          noteId: n.noteId,
          noteName: noteMap.get(n.noteId) || "Unknown Note",
          noteText: n.noteText,
        })),
      }))
      .reverse();
  }, [snapshots, habits, notes, today]);

  const visibleHistory = history.slice(0, visibleCount);

  const formatDisplayDate = (dateString: string, dayIndex: number): string => {
    if (dayIndex === 0) return "Today";
    if (dayIndex === 1) return "Yesterday";
    const date = getDate00(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getCompletedCount = (habits: DailyHistory["habits"]): number =>
    habits.filter((h) => h.habitDidCount >= h.habitNeedCount).length;

  const getTotalCount = (habits: DailyHistory["habits"]): number => habits.length;

  const handleHabitSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (editModal?.type !== "habit") return;

    if (!/^\d+$/.test(habitCountInput)) {
      setCountError("Enter a valid number");
      return;
    }
    const count = parseInt(habitCountInput, 10);
    if (count < 0 || count > editModal.needCount) {
      setCountError(`Enter a number from 0 to ${editModal.needCount}`);
      return;
    }

    onEditHabit(editModal.dateStr, editModal.habitId, count);
    setEditModal(null);
  };

  const handleNoteSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (editModal?.type !== "note") return;
    onEditNote(editModal.dateStr, editModal.noteId, noteTextInput.trim());
    setEditModal(null);
  };

  return (
    <div className="pb-20">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">History</h1>

      <div className="space-y-6">
        {visibleHistory.map((day, dayIndex) => (
          <div key={day.date} className="border-b border-gray-100 pb-4">
            {/* Day Header */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-900">
                {formatDisplayDate(day.date, dayIndex)}
              </h3>
              {getTotalCount(day.habits) !== 0 && (
                <span className="text-sm text-gray-500">
                  {getCompletedCount(day.habits)}/{getTotalCount(day.habits)} completed
                </span>
              )}
            </div>

            {/* Habits and notes for this day */}
            <div className="space-y-2">
              {day.habits.length > 0 || day.notes.length > 0 ? (
                <>
                  {day.habits.map((habit) => (
                    <div
                      key={habit.habitId}
                      className={`flex justify-between items-center p-3 rounded-lg ${
                        habit.habitDidCount >= habit.habitNeedCount
                          ? "bg-green-50"
                          : "bg-gray-50"
                      }`}
                    >
                      <span className="text-sm text-gray-700">{habit.habitText}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {habit.habitDidCount}/{habit.habitNeedCount}
                        </span>
                        {habit.habitDidCount >= habit.habitNeedCount && (
                          <IoCheckmarkCircle className="w-5 h-5 text-green-600" />
                        )}
                        <button
                          onClick={() =>
                            setEditModal({
                              type: "habit",
                              dateStr: day.date,
                              habitId: habit.habitId,
                              habitText: habit.habitText,
                              currentCount: habit.habitDidCount,
                              needCount: habit.habitNeedCount,
                            })
                          }
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
                          aria-label="Edit"
                        >
                          <MdOutlineEdit className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {day.notes.map((note) => {
                    const hasText =
                      note.noteText &&
                      note.noteText.trim() !== "" &&
                      note.noteText !== "No text for that day";
                    return (
                      <div
                        key={note.noteId}
                        className="p-3 rounded-lg bg-blue-50 border-l-4 border-blue-200"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-gray-700">
                              {note.noteName}
                            </span>
                            {hasText ? (
                              <span className="text-sm text-gray-600">{note.noteText}</span>
                            ) : (
                              <span className="text-sm italic text-gray-400">No text</span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setEditModal({
                                type: "note",
                                dateStr: day.date,
                                noteId: note.noteId,
                                noteName: note.noteName,
                                currentText: note.noteText,
                              })
                            }
                            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-blue-100 transition-colors"
                            aria-label="Edit"
                          >
                            <MdOutlineEdit className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="p-3 rounded-lg bg-gray-50 text-center">
                  <span className="text-sm text-gray-500">No habits or notes for this day</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {visibleCount < history.length && (
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="w-full py-3 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Show more ({history.length - visibleCount} days remaining)
          </button>
        )}
      </div>

      {/* Edit modal */}
      <Modal modalOpen={editModal !== null} setModalOpen={() => setEditModal(null)}>
        {editModal?.type === "habit" && (
          <form onSubmit={handleHabitSubmit} className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Edit habit count</h2>
            <p className="text-sm text-gray-600">{editModal.habitText}</p>
            <div className="flex flex-col">
              <input
                type="text"
                inputMode="numeric"
                placeholder={`Count (0–${editModal.needCount})`}
                value={habitCountInput}
                onChange={(e) => {
                  setHabitCountInput(e.target.value);
                  setCountError("");
                }}
                aria-label="Habit count"
                className={
                  "border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 " +
                  (countError
                    ? "border-red-500 focus:ring-red-300"
                    : "border-gray-300 focus:ring-blue-400")
                }
              />
              {countError && <p className="mt-1 text-sm text-red-600">{countError}</p>}
            </div>
            <button
              type="submit"
              className="bg-blue-500 text-white font-medium py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Submit
            </button>
          </form>
        )}
        {editModal?.type === "note" && (
          <form onSubmit={handleNoteSubmit} className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Edit note</h2>
            <p className="text-sm text-gray-600">{editModal.noteName}</p>
            <textarea
              placeholder="Note text"
              value={noteTextInput}
              onChange={(e) => setNoteTextInput(e.target.value)}
              aria-label="Note text"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              rows={4}
            />
            <button
              type="submit"
              className="bg-blue-500 text-white font-medium py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Submit
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default HistoryView;
