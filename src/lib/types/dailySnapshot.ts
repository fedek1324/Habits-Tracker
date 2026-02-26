export default interface IDailySnapshot {
    date: string, // "YYYY-MM-DD"
    habits: Array<{
        habitId: string,
        habitNeedCount: number,
        habitDidCount: number
    }>,
    notes: Array<{
        noteId: string,
        noteText: string
    }>
}
