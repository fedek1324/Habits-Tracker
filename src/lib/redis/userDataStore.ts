import IHabitsAndNotesData from "@/src/lib/types/habitsData";
import redis from "./index";

export async function getUserData(userId: string): Promise<IHabitsAndNotesData | null> {
  return await redis.get<IHabitsAndNotesData>(`user:${userId}:data`);
}

export async function setUserData(userId: string, data: IHabitsAndNotesData): Promise<void> {
  await redis.set(`user:${userId}:data`, data);
}
