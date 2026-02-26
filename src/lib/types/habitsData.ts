import IDailySnapshot from "./dailySnapshot";
import IHabit from "./habit";
import INote from "./note";

export default interface IHabitsAndNotesData {
    habits: IHabit[],
    notes: INote[],
    snapshots: IDailySnapshot[]
}
