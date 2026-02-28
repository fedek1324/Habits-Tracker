import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getUserData, setUserData } from "@/src/lib/redis/userDataStore";
import { computeTodayAndFillHistory } from "@/src/lib/habits/stateHelpers";
import IHabit from "@/src/lib/types/habit";
import INote from "@/src/lib/types/note";
import IDailySnapshot from "@/src/lib/types/dailySnapshot";
import IHabitsAndNotesData from "@/src/lib/types/habitsData";

// ─────────────────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────────────────

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

export async function setCookie(name: string, value: string) {
  (await cookies()).set(name, value, COOKIE_OPTS);
}

export async function deleteCookie(name: string) {
  (await cookies()).delete(name);
}

// ─────────────────────────────────────────────────────────
// Page data (used by page.tsx on every render)
// ─────────────────────────────────────────────────────────

export type PageData = {
  habits: IHabit[];
  notes: INote[];
  todaySnapshot: IDailySnapshot;
  allSnapshots: IDailySnapshot[];
  todayStr: string;
};

export async function getData(): Promise<PageData | null> {
  const store = await cookies();
  const userId = store.get("user_id")?.value;
  if (!userId) return null;

  try {
    const tz = store.get("tz")?.value ?? "UTC";
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

    const raw = await getUserData(userId);
    const { habits, notes, snapshots } = raw ?? { habits: [], notes: [], snapshots: [] };
    const { todaySnapshot, allSnapshots } = computeTodayAndFillHistory(habits, notes, snapshots, todayStr);

    return { habits, notes, todaySnapshot, allSnapshots, todayStr };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// Server context (shared by all mutation actions)
// ─────────────────────────────────────────────────────────

export type ServerContext = {
  userId: string;
  todayStr: string;
};

export async function getServerContext(): Promise<ServerContext> {
  const store = await cookies();
  const userId = store.get("user_id")?.value;
  if (!userId) throw new Error("Not authenticated");

  const tz = store.get("tz")?.value ?? "UTC";
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

  return { userId, todayStr };
}

export async function readState(ctx: ServerContext) {
  const raw = await getUserData(ctx.userId);
  const { habits, notes, snapshots } = raw ?? { habits: [], notes: [], snapshots: [] };
  const { todaySnapshot, allSnapshots } = computeTodayAndFillHistory(
    habits,
    notes,
    snapshots,
    ctx.todayStr
  );
  return { habits, notes, todaySnapshot, allSnapshots };
}

export async function commitState(
  ctx: ServerContext,
  habits: IHabit[],
  notes: INote[],
  snapshots: IDailySnapshot[]
) {
  const data: IHabitsAndNotesData = { habits, notes, snapshots };
  await setUserData(ctx.userId, data);
  revalidatePath("/");
}
