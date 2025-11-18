import { configureStore } from '@reduxjs/toolkit';
import habitsReducer from "./features/habitsAndNotes/habitsSlice";
import notesReducer from "./features/habitsAndNotes/notesSlice";
import snapshotsReducer from "./features/habitsAndNotes/snapshotsSlice";
import googleSheetsReducer from "./features/googleSheets/googleSheetsSlice";
import { localStorageMiddleware } from "./middleware/localStorageMiddleware"

export const makeStore = () => {
  return configureStore({
    reducer: {
        habits: habitsReducer,
        notes: notesReducer,
        snapshots: snapshotsReducer,
        googleSheets: googleSheetsReducer 
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware().prepend(localStorageMiddleware),
  })
}

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']