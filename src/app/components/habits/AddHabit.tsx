"use client";

import { FormEventHandler, useState } from "react";
import Modal from "../Modal";
import IHabit from "@/src/lib/types/habit";

const AddHabit: React.FC<{ onAdd: (habit: IHabit, needCount: number) => void }> = ({
  onAdd,
}) => {
  const habitCountDefault = "";
  const habitTextDefault = "";
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [newHabitText, setNewHabitText] = useState<string>(habitTextDefault);
  const [newHabitCount, setNewHabitCount] = useState<string>(habitCountDefault);
  const [countError, setCountError] = useState<string>(""); // for error message
  const [textError, setTextError] = useState<string>(""); // for error message

  const handleSubmitNewHabit: FormEventHandler<HTMLFormElement> = async (
    e
  ) => {
    e.preventDefault();

    let habitCount;
    if (!/^\d+$/.test(newHabitCount)) {
      setCountError("Enter a valid number");
      return;
    } else {
      habitCount = parseInt(newHabitCount, 10);
      if (!(habitCount > 0 && habitCount < 1e6)) {
        setCountError("Enter a valid number more than 0");
        return;
      }
    }

    if (newHabitText === "" || newHabitText.length > 1e3) {
      setTextError("Enter a valid text");
      return;
    }

    const newHabit = {
      id: crypto.randomUUID(),
      text: newHabitText.trim(),
    };

    onAdd(newHabit, habitCount);
    setNewHabitText(habitTextDefault);
    setNewHabitCount(habitCountDefault);
    setCountError("");
    setTextError("");
    setModalOpen(false);
  };

  return (
    <div className="w-full">
      <button
        onClick={() => setModalOpen(true)}
        className="w-full mt-2 p-4 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center space-x-2 text-gray-500 hover:border-gray-300 hover:text-gray-600 transition-colors"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>
        <span>Add habit</span>
      </button>

      <Modal modalOpen={modalOpen} setModalOpen={setModalOpen}>
        <form onSubmit={handleSubmitNewHabit} className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Add new habit</h2>

          {/* Habit name */}
          <div className="flex flex-col">
            <input
              type="text"
              placeholder="Habit name"
              value={newHabitText}
              onChange={(e) => {
                setNewHabitText(e.target.value);
                setTextError("");
              }}
              aria-label="Habit name"
              className={
                "border border-gray-300 rounded-lg " +
                "px-4 py-2 focus:outline-none " +
                "focus:ring-2 focus:ring-blue-400" +
                (textError
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-blue-400")
              }
            />
            {textError && (
              <p className="mt-1 text-sm text-red-600">{textError}</p>
            )}
          </div>

          {/* Repetitions count */}
          <div className="flex flex-col">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Repetitions per day"
              value={newHabitCount}
              onChange={(e) => {
                setNewHabitCount(e.target.value);
                setCountError("");
              }}
              aria-label="Repetitions per day"
              className={
                "border border-gray-300 rounded-lg " +
                "px-4 py-2 focus:outline-none " +
                "focus:ring-2 focus:ring-blue-400" +
                (countError
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-blue-400")
              }
            />
            {countError && (
              <p className="mt-1 text-sm text-red-600">{countError}</p>
            )}
          </div>

          <button
            type="submit"
            className="bg-blue-500 text-white font-medium py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Submit
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default AddHabit;
