import IHabit from "@/src/lib/types/habit";
import { FormEventHandler, useEffect, useState } from "react";
import { LuTrash } from "react-icons/lu";
import { MdOutlineEdit } from "react-icons/md";
import Modal from "../Modal";

function getPastelColorFromId(id: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Restrict hue from 0 to 360
  const hue = Math.abs(hash) % 360;

  // HSL: high saturation (80%), lightness 90%) → pastel color
  return `hsl(${hue}, 80%, 94%)`;
}

interface HabitButtonProps {
  habit: IHabit;
  currentCount: number;
  needCount: number;
  onIncrement: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (habit: IHabit, newNeedCount: number, newActualCount: number) => void;
}

const HabitButton: React.FC<HabitButtonProps> = ({
  habit,
  currentCount,
  needCount,
  onIncrement,
  onDelete,
  onEdit,
}) => {
  const subtitle = `${currentCount}/${needCount}`;
  const completed = currentCount === needCount;

  const [isEditModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [newHabitText, setNewHabitText] = useState<string>(habit.text);
  const [newHabitCurrentCount, setNewHabitCurrentCount] = useState<string>(
    String(currentCount)
  );
  const [newHabitNeedCount, setNewHabitNeedCount] = useState<string>(
    String(needCount)
  );
  const [currentCountError, setCurrentCountError] = useState<string>(""); // for error message
  const [needCountError, setNeedCountError] = useState<string>(""); // for error message
  const [textError, setTextError] = useState<string>(""); // for error message

  const handleEditHabit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    let habitNeedCount;
    if (!/^\d+$/.test(newHabitNeedCount)) {
      setNeedCountError("Enter a valid number");
      return;
    } else {
      habitNeedCount = parseInt(newHabitNeedCount, 10);
      if (!(habitNeedCount > 0 && habitNeedCount < 1e6)) {
        setNeedCountError("Enter a valid number more that 0");
        return;
      }
    }

    let habitCurrentCount;
    if (!/^\d+$/.test(newHabitCurrentCount)) {
      setCurrentCountError("Enter a valid number");
      return;
    } else {
      habitCurrentCount = parseInt(newHabitCurrentCount, 10);
      if (!(habitCurrentCount >= 0 && habitCurrentCount < 1e6 &&
        habitCurrentCount <= habitNeedCount
      )) {
        setCurrentCountError("Enter a valid number less or equal to habit aim");
        return;
      }
    }

    if (newHabitText === "" || newHabitText.length > 1e3) {
      setTextError("Enter a valid text");
      return;
    }

    const updatedHabit = {
      id: habit.id,
      text: newHabitText.trim(),
    };

    onEdit(updatedHabit, habitNeedCount ?? 1, habitCurrentCount ?? 0);

    setNewHabitText("");
    setNewHabitCurrentCount("");
    setNewHabitNeedCount("");

    setCurrentCountError("");
    setNeedCountError("");
    setTextError("");
    setEditModalOpen(false);
  };

  useEffect(() => {
    if (isEditModalOpen) {
      setNewHabitText(habit.text);
      setNewHabitCurrentCount(String(currentCount));
      setNewHabitNeedCount(String(needCount));
    }
  }, [isEditModalOpen, habit, currentCount, needCount]);

  return (
    <div
      className={`
        rounded-2xl
        p-4
        w-full
        flex
        items-center
        justify-between
        shadow-sm
        hover:shadow-md
        transition-all

      `}
      style={{ backgroundColor: getPastelColorFromId(habit.id) }}
    >
      <div className="flex items-center space-x-4">
        {/* Text */}
        <div className="text-left">
          <span
            style={{ wordBreak: "break-word" }}
            className="block text-lg font-medium text-gray-900"
            title={habit.text}
          >
            {habit.text}
          </span>
          {subtitle && (
            <span className="block text-sm text-gray-600">{subtitle}</span>
          )}
        </div>
      </div>

      <div className="flex space-x-2">
        {/* Right part - action button */}
        <button
          onClick={() => onIncrement(habit.id)}
          className="rounded-full flex-shrink-0 active:scale-120 duration-30 transition-all hover:shadow-md "
        >
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-gray-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              {completed ? (
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              ) : (
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              )}
            </svg>
          </div>
        </button>

        {/* Right part - edit button */}
        <button
          onClick={() => setEditModalOpen(true)}
          className="rounded-full flex-shrink-0 active:scale-120 duration-30 transition-all hover:shadow-md "
        >
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <MdOutlineEdit />
          </div>
        </button>

        <Modal modalOpen={isEditModalOpen} setModalOpen={setEditModalOpen}>
          <form onSubmit={handleEditHabit} className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Edit habit</h2>

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

            {/* Current count */}
            <div className="flex flex-col">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Current repetitions per day"
                value={newHabitCurrentCount}
                onChange={(e) => {
                  setNewHabitCurrentCount(e.target.value);
                  setCurrentCountError("");
                }}
                aria-label="Repetitions per day"
                className={
                  "border border-gray-300 rounded-lg " +
                  "px-4 py-2 focus:outline-none " +
                  "focus:ring-2 focus:ring-blue-400" +
                  (currentCountError
                    ? "border-red-500 focus:ring-red-300"
                    : "border-gray-300 focus:ring-blue-400")
                }
              />
              {currentCountError && (
                <p className="mt-1 text-sm text-red-600">{currentCountError}</p>
              )}
            </div>

            {/* Repetitions count */}
            <div className="flex flex-col">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Need repetitions per day"
                value={newHabitNeedCount}
                onChange={(e) => {
                  setNewHabitNeedCount(e.target.value);
                  setNeedCountError("");
                }}
                aria-label="Repetitions per day"
                className={
                  "border border-gray-300 rounded-lg " +
                  "px-4 py-2 focus:outline-none " +
                  "focus:ring-2 focus:ring-blue-400" +
                  (needCountError
                    ? "border-red-500 focus:ring-red-300"
                    : "border-gray-300 focus:ring-blue-400")
                }
              />
              {needCountError && (
                <p className="mt-1 text-sm text-red-600">{needCountError}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="bg-blue-500 text-white font-medium py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Submit
            </button>
          </form>
        </Modal>

        {/* Right part - delete button */}
        <button
          onClick={() => onDelete(habit.id)}
          className="rounded-full flex-shrink-0 active:scale-120 duration-30 transition-all hover:shadow-md "
        >
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <LuTrash />
          </div>
        </button>
      </div>
    </div>
  );
};

export default HabitButton;
