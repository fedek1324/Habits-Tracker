import INote from "@/src/lib/types/note";
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

interface NoteButtonProps {
  note: INote;
  text: string;
  onDelete: (id: string) => void;
  onEdit: (note: INote, noteText: string) => void;
}

const NoteButton: React.FC<NoteButtonProps> = ({
  note,
  text,
  onDelete,
  onEdit,
}) => {
  const trimedText = text.trim();
  const isTextEmpty = trimedText === '';
  const subtitle = `${ isTextEmpty ? "No text for that day" : trimedText}`;

  const [isEditModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [newNoteName, setNewNoteName] = useState<string>(note.name);
  const [newNoteText, setNewNoteText] = useState<string>(text);
  const [nameError, setNameError] = useState<string>(""); // for error message
  const [textError, setTextError] = useState<string>(""); // for error message

  const handleEditNote: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    if (newNoteName === "" || newNoteName.length > 1e3) {
      setNameError("Enter a valid name");
      return;
    }

    if (newNoteText === "" || newNoteText.length > 1e3) {
      setTextError("Enter a valid text");
      return;
    }

    const updatedNote = {
      id: note.id,
      name: newNoteName.trim(),
    };

    onEdit(updatedNote, newNoteText.trim());

    setNewNoteName("");
    setNewNoteText("");
    setNameError("");
    setTextError("");
    setEditModalOpen(false);
  };

  useEffect(() => {
    if (isEditModalOpen) {
      setNewNoteName(note.name);
      setNewNoteText(text);
    }
  }, [isEditModalOpen, note, text]);

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
      style={{ backgroundColor: getPastelColorFromId(note.id) }}
    >
      <div className="flex items-center space-x-4">
        {/* Text */}
        <div className="text-left">
          <span
            style={{ wordBreak: "break-word" }}
            className="block text-lg font-medium text-gray-900"
            title={note.name}
          >
            {note.name}
          </span>
          {subtitle && (
            <span className={`block text-sm ${isTextEmpty ? "text-gray-400" : "text-gray-600"}`}>{subtitle}</span>
          )}
        </div>
      </div>

      <div className="flex space-x-2">

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
          <form onSubmit={handleEditNote} className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Edit note</h2>

            {/* Note name */}
            <div className="flex flex-col">
              <input
                type="text"
                placeholder="Note name"
                value={newNoteName}
                onChange={(e) => {
                  setNewNoteName(e.target.value);
                  setNameError("");
                }}
                aria-label="Note name"
                className={
                  "border border-gray-300 rounded-lg " +
                  "px-4 py-2 focus:outline-none " +
                  "focus:ring-2 focus:ring-blue-400" +
                  (nameError
                    ? "border-red-500 focus:ring-red-300"
                    : "border-gray-300 focus:ring-blue-400")
                }
              />
              {nameError && (
                <p className="mt-1 text-sm text-red-600">{nameError}</p>
              )}
            </div>

            {/* Note text */}
            <div className="flex flex-col">
              <input
                type="text"
                placeholder="Note content"
                value={newNoteText}
                onChange={(e) => {
                  setNewNoteText(e.target.value);
                  setTextError("");
                }}
                aria-label="Note content"
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
          onClick={() => onDelete(note.id)}
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

export default NoteButton;
