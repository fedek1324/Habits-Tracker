"use server";

import INote from "@/src/lib/types/note";
import IDailySnapshot from "@/src/lib/types/dailySnapshot";
import { getServerContext, readState, commitState } from "./_shared";

export async function addNoteAction(note: INote, text: string): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedNotes = [...notes, note];
  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    notes: [...todaySnapshot.notes, { noteId: note.id, noteText: text }],
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, habits, updatedNotes, updatedSnapshots);
}

export async function editNoteAction(
  noteId: string,
  newName: string,
  newText: string
): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedNotes = notes.map((n) =>
    n.id === noteId ? { ...n, name: newName } : n
  );
  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    notes: todaySnapshot.notes.map((n) =>
      n.noteId === noteId ? { ...n, noteText: newText } : n
    ),
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, habits, updatedNotes, updatedSnapshots);
}

export async function deleteNoteAction(noteId: string): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    notes: todaySnapshot.notes.filter((n) => n.noteId !== noteId),
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, habits, notes, updatedSnapshots);
}
