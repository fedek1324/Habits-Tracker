"use client";

import { v4 as uuidv4 } from "uuid";
import { FormEventHandler, useState } from "react";
import Modal from "../Modal";
import INote from "@/src/lib/types/note";

const AddNote: React.FC<{ onAdd: (note: INote, text: string) => void }> = ({
  onAdd,
}) => {
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [newNoteName, setNewNoteName] = useState<string>("");
  const [newNoteText, setNewNoteText] = useState<string>("");
  const [newNoteNameError, setNewNoteNameError] = useState<string>("");
  const [newNoteTextError, setNewNoteTextError] = useState<string>("");

  const handleSubmitNewNote: FormEventHandler<HTMLFormElement> = async (
    e
  ) => {
    e.preventDefault();


    if (newNoteName === "" || newNoteName.length > 1e3) {
      setNewNoteNameError("Enter a valid text");
      return;
    }

    if (newNoteText === "" || newNoteText.length > 1e3) {
      setNewNoteTextError("Enter a valid text");
      return;
    }

    const newNote = {
      id: uuidv4(),
      name: newNoteName,
    };

    onAdd(newNote, newNoteText);
    setNewNoteName("");
    setNewNoteText("");
    setNewNoteNameError("");
    setNewNoteTextError("");
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
        <span>Add note</span>
      </button>

      <Modal modalOpen={modalOpen} setModalOpen={setModalOpen}>
        <form onSubmit={handleSubmitNewNote} className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Add new note</h2>

          {/* Note name */}
          <div className="flex flex-col">
            <input
              type="text"
              placeholder="Note name"
              value={newNoteName}
              onChange={(e) => {
                setNewNoteName(e.target.value);
                setNewNoteNameError("");
              }}
              aria-label="Note name"
              className={
                "border border-gray-300 rounded-lg " +
                "px-4 py-2 focus:outline-none " +
                "focus:ring-2 focus:ring-blue-400" +
                (newNoteNameError
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-blue-400")
              }
            />
            {newNoteNameError && (
              <p className="mt-1 text-sm text-red-600">{newNoteNameError}</p>
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
                setNewNoteTextError("");
              }}
              aria-label="Note content"
              className={
                "border border-gray-300 rounded-lg " +
                "px-4 py-2 focus:outline-none " +
                "focus:ring-2 focus:ring-blue-400" +
                (newNoteTextError
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-blue-400")
              }
            />
            {newNoteTextError && (
              <p className="mt-1 text-sm text-red-600">{newNoteTextError}</p>
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

export default AddNote;
