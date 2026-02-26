import IDailySnapshot from "@/src/lib/types/dailySnapshot";
import IHabit from "@/src/lib/types/habit";
import INote from "@/src/lib/types/note";

/** "YYYY-MM-DD" → Date at midnight local time */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Add N calendar days to a Date */
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Date → "YYYY-MM-DD" */
function toDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(date);
}

/**
 * Create an empty snapshot for a given day, copying structure from a reference snapshot.
 * didCount resets to 0, noteText resets to "".
 */
function buildSnapshotFromPrevious(
  dateStr: string,
  prev: IDailySnapshot
): IDailySnapshot {
  return {
    date: dateStr,
    habits: prev.habits.map((h) => ({
      habitId: h.habitId,
      habitNeedCount: h.habitNeedCount,
      habitDidCount: 0,
    })),
    notes: prev.notes.map((n) => ({ noteId: n.noteId, noteText: "" })),
  };
}

/**
 * Create a brand-new empty snapshot from the habits/notes definitions.
 * Used only when there are no previous snapshots at all.
 */
export function buildEmptySnapshot(
  dateStr: string,
  habits: IHabit[],
  notes: INote[]
): IDailySnapshot {
  return {
    date: dateStr,
    habits: habits.map((h) => ({
      habitId: h.id,
      habitNeedCount: 1,
      habitDidCount: 0,
    })),
    notes: notes.map((n) => ({ noteId: n.id, noteText: "" })),
  };
}

/**
 * Given raw snapshots from Sheets, compute:
 * - today's snapshot (find or create from previous, filling any gaps)
 * - the complete snapshot array including all filled gaps
 *
 * Does NOT write anything to Sheets — purely in-memory.
 */
export function computeTodayAndFillHistory(
  habits: IHabit[],
  notes: INote[],
  rawSnapshots: IDailySnapshot[],
  todayStr: string
): { todaySnapshot: IDailySnapshot; allSnapshots: IDailySnapshot[] } {
  const byDate = new Map<string, IDailySnapshot>(
    rawSnapshots.map((s) => [s.date, s])
  );

  // Already have today's snapshot — just fill any gaps before it
  if (byDate.has(todayStr)) {
    const filled = fillGaps(rawSnapshots, todayStr);
    return { todaySnapshot: byDate.get(todayStr)!, allSnapshots: filled };
  }

  // No snapshots at all
  if (rawSnapshots.length === 0) {
    const todaySnapshot = buildEmptySnapshot(todayStr, habits, notes);
    return { todaySnapshot, allSnapshots: [todaySnapshot] };
  }

  // Fill gaps from the last snapshot up to and including today
  const sorted = [...rawSnapshots].sort((a, b) => a.date.localeCompare(b.date));
  const lastSnapshot = sorted[sorted.length - 1];
  const filled = fillGaps(sorted, todayStr);

  // Create today's snapshot from the last known one
  const todaySnapshot = buildSnapshotFromPrevious(todayStr, lastSnapshot);
  filled.push(todaySnapshot);
  byDate.set(todayStr, todaySnapshot);

  return { todaySnapshot, allSnapshots: filled };
}

/** Fill missing days between existing snapshots and the target date. */
function fillGaps(
  snapshots: IDailySnapshot[],
  upToDate: string
): IDailySnapshot[] {
  if (snapshots.length === 0) return [];

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const result: IDailySnapshot[] = [...sorted];
  const byDate = new Map(sorted.map((s) => [s.date, s]));
  const upTo = parseDate(upToDate);

  const last = sorted[sorted.length - 1];
  let current = addDays(parseDate(last.date), 1);
  let prev = last;

  while (current <= upTo) {
    const dateStr = toDateStr(current);
    if (!byDate.has(dateStr)) {
      const filled = buildSnapshotFromPrevious(dateStr, prev);
      result.push(filled);
      byDate.set(dateStr, filled);
      prev = filled;
    } else {
      prev = byDate.get(dateStr)!;
    }
    current = addDays(current, 1);
  }

  return result;
}
