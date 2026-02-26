"use server";

import IHabit from "@/src/lib/types/habit";
import IDailySnapshot from "@/src/lib/types/dailySnapshot";
import { getServerContext, readState, commitState } from "./_shared";

export async function incrementHabitAction(
  habitId: string,
  newCount: number
): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    habits: todaySnapshot.habits.map((h) =>
      h.habitId === habitId ? { ...h, habitDidCount: newCount } : h
    ),
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, habits, notes, updatedSnapshots);
}

export async function addHabitAction(
  habit: IHabit,
  needCount: number
): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedHabits = [...habits, habit];
  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    habits: [
      ...todaySnapshot.habits,
      { habitId: habit.id, habitNeedCount: needCount, habitDidCount: 0 },
    ],
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, updatedHabits, notes, updatedSnapshots);
}

export async function deleteHabitAction(habitId: string): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    habits: todaySnapshot.habits.filter((h) => h.habitId !== habitId),
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, habits, notes, updatedSnapshots);
}

export async function editHabitAction(
  habit: IHabit,
  needCount: number,
  actualCount: number
): Promise<void> {
  const ctx = await getServerContext();
  const { habits, notes, todaySnapshot, allSnapshots } = await readState(ctx);

  const updatedHabits = habits.map((h) => (h.id === habit.id ? habit : h));
  const updatedSnapshot: IDailySnapshot = {
    ...todaySnapshot,
    habits: todaySnapshot.habits.map((h) =>
      h.habitId === habit.id
        ? { ...h, habitNeedCount: needCount, habitDidCount: actualCount }
        : h
    ),
  };
  const updatedSnapshots = allSnapshots.map((s) =>
    s.date === ctx.todayStr ? updatedSnapshot : s
  );

  await commitState(ctx, updatedHabits, notes, updatedSnapshots);
}
