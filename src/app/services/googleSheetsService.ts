// import { getDailySnapshots, getHabits, getNotes } from "@/src/app/services/apiLocalStorage";
// import IDailySnapshot from "@/src/app/types/dailySnapshot";
// import { GoogleState } from "@/src/app/types/googleState";
// import IHabbit from "@/src/app/types/habbit";
// import IHabitsAndNotesData from "@/src/app/types/habitsData";
// import INote from "@/src/app/types/note";
// import axios from "axios";

// import { AppDispatch } from "@/src/lib/store";
// import { setAccessToken, setSpreadsheetId, setSpreadsheetUrl, setStatus, setData } from "@/src/lib/features/googleSheets/googleSheetsSlice";

// type SpreadSheetData = {
//   majorDimension: "ROWS";
//   range: string;
//   values: Array<Array<string>> | undefined;
// };

// const apiGoogleRefreshTokenUrl = "/api/auth/google/refresh-token";

// const DEBOUNCE_MS = 500;
// let debounceTimer: NodeJS.Timeout | null = null;
// /**
//  * If true query to google is performing
//  */
// let pending = false;

// /**
//  * If syncToSpreadsheetFn was called to execute in time 
//  * of other query execute then suspend it and set hasQueue to true
//  */
// let hasQueue = false;

// /**
//  * get Access Token using refreshToken
//  */
// const refreshAccessToken = async (
//   refreshToken: string
// ): Promise<string | null> => {
//   try {
//     console.log("Refreshing access token...");
//     const response = await axios.post(apiGoogleRefreshTokenUrl, {
//       refreshToken,
//     });

//     if (response.data.access_token) {
//       console.log("✅ Successfully refreshed access token");
//       return response.data.access_token;
//     }

//     return null;
//   } catch (error) {
//     console.error("❌ Error refreshing access token:", error);
//     return null;
//   }
// };

// /**
//  * using spreadSheetData from agtument NOT USING PROPER METHODS
//  * creates habits and notes info and returns it
//  */
// const parseSpreadsheetDataToHabits = (allRows: string[][]) => {
//   try {
//     console.log("Parsing spreadsheet data to habits, notes and snapshots...");

//     if (!allRows || allRows.length < 3) {
//       console.log("Not enough data in spreadsheet - need at least 3 rows (category, headers, data)");
//       return { habits: [], notes: [], snapshots: [] };
//     }

//     // Expect new two-header format: first row is categories, second row is column names
//     const categoryRow = allRows[0];
//     const columnNamesRow = allRows[1];
//     const dataRows = allRows.slice(2);

//     // Extract column names (skip first column which is "Date")
//     const allColumnNames = columnNamesRow.slice(1);
//     console.log("Found all column names:", allColumnNames);

//     if (allColumnNames.length === 0) {
//       console.log("No data columns found in spreadsheet");
//       return { habits: [], notes: [], snapshots: [] };
//     }

//     // Use category row to determine column types
//     const habitNames: string[] = [];
//     const noteNames: string[] = [];

//     for (let i = 1; i < columnNamesRow.length; i++) {
//       const category = categoryRow[i] || ""; // Use empty string if category is undefined
//       const columnName = allColumnNames[i - 1];

//       if (category === "Habits") {
//         habitNames.push(columnName);
//       } else if (category === "Notes") {
//         noteNames.push(columnName);
//       } else if (category === "" && habitNames.length > 0 && noteNames.length === 0) {
//         // Empty category after "Habits" means still in habits section
//         habitNames.push(columnName);
//       } else if (category === "" && noteNames.length > 0) {
//         // Empty category after "Notes" means still in notes section
//         noteNames.push(columnName);
//       }
//     }

//     console.log("Found habit columns:", habitNames);
//     console.log("Found note columns:", noteNames);

//     // Create habit objects with unique IDs
//     const habits: IHabbit[] = habitNames.map((name) => ({
//       id: crypto.randomUUID(),
//       text: name,
//     }));

//     // Create note objects with unique IDs
//     const notes: INote[] = noteNames.map((name) => ({
//       id: crypto.randomUUID(),
//       name: name,
//     }));

//     // Create daily snapshots from the data
//     const snapshots: IDailySnapshot[] = [];

//     dataRows.forEach((row) => {
//       if (row.length === 0) return; // Skip empty rows

//       const date = row[0];
//       if (!date) return; // Skip rows without date

//       const habitData: Array<{
//         habbitId: string;
//         habbitNeedCount: number;
//         habbitDidCount: number;
//       }> = [];

//       const noteData: Array<{
//         noteId: string;
//         noteText: string;
//       }> = [];

//       // Process all columns after the date column
//       for (let i = 1; i < row.length && i <= allColumnNames.length; i++) {
//         const cellValue = row[i];
//         const columnName = allColumnNames[i - 1]; // -1 because allColumnNames doesn't include Date

//         if (habitNames.includes(columnName)) {
//           // This is a habit column - parse "actual/target" format
//           if (cellValue && cellValue.match(/^\d+\/\d+$/)) {
//             const progressMatch = cellValue.match(/^(\d+)\/(\d+)$/);
//             if (progressMatch) {
//               const actualCount = parseInt(progressMatch[1]);
//               const targetCount = parseInt(progressMatch[2]);
//               const habitId = habits.find(h => h.text === columnName)?.id;

//               if (habitId) {
//                 habitData.push({
//                   habbitId: habitId,
//                   habbitNeedCount: targetCount,
//                   habbitDidCount: actualCount,
//                 });
//               }
//             }
//           }
//         } else if (noteNames.includes(columnName)) {
//           // This is a note column - store the text
//           const noteId = notes.find(n => n.name === columnName)?.id;

//           if (noteId && cellValue) {
//             noteData.push({
//               noteId: noteId,
//               noteText: cellValue,
//             });
//           }
//         }
//       }

//       snapshots.push({
//         date: date,
//         habbits: habitData,
//         notes: noteData,
//       });
//     });

//     console.log(
//       `Parsed ${habits.length} habits, ${notes.length} notes, and ${snapshots.length} daily snapshots`
//     );
//     return { habits, notes, snapshots };
//   } catch (error) {
//     console.error("❌ Error parsing spreadsheet data:", error);
//     return { habits: [], notes: [], snapshots: [] };
//   }
// };

// const SPREADSHEET_NAME = "My habits tracker";

// let renderCount = 0;

// class GoogleSheetsService {
//   private const status = useAppSelector(selectGoogleStatus);
//   private const accessToken =  useAppSelector(selectAccessToken);
//   private const refreshToken =  useAppSelector(selectRefreshToken);
//   private const spreadsheetId =  useAppSelector(selectSpreadsheetId);
//   private const spreadsheetUrl =  useAppSelector(selectSpreadsheetUrl);
//   private const loadedData =  useAppSelector(selectLoadedData);

//   private const dispatch = useAppDispatch();
  
  
//   private ignoreFetch = false;
    
//     /**
//    * use fetch with arguments and refrest access token if needed
//    */
//   async makeAuthenticatedRequest
//      (
//       refreshToken: string,
//       accessToken: string,
//       url: string,
//       options: RequestInit,
//       retryCount = 0
//     ): Promise<Response> {
//       const response = await fetch(url, {
//         ...options,
//         headers: {
//           ...options.headers,
//           Authorization: `Bearer ${accessToken}`,
//         },
//       });

//       // If token expired and we have a refresh token, try to refresh
//       if (response.status === 401 && refreshToken && retryCount === 0) {
//         console.log("Access token expired, attempting to refresh...");
//         const newAccessToken = await refreshAccessToken(refreshToken);

//         if (newAccessToken) {
//           this.dispatch(setAccessToken(newAccessToken));

//           // Retry the request with new token
//           return this.makeAuthenticatedRequest(
//             refreshToken,
//             newAccessToken,
//             url,
//             options,
//             1
//           );
//         }
//       }

//       return response;
//     };

//     /**
//    * find SpreadSheet by name using accessToken
//    */
//   async findSpreadsheetByName(refreshToken: string, accessToken: string, name: string) {
//       try {
//         console.log(`Searching for spreadsheet named: "${name}"`);

//         // Search for spreadsheets with the specific name
//         const searchResponse = await this.makeAuthenticatedRequest(
//           refreshToken,
//           accessToken,
//           `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(
//             name
//           )}' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,webViewLink)`,
//           {
//             headers: {
//               "Content-Type": "application/json",
//             },
//           }
//         );

//         if (!searchResponse.ok) {
//           throw new Error(
//             `Failed to search for spreadsheet: ${searchResponse.status}`
//           );
//         }

//         const searchData = await searchResponse.json();
//         const files = searchData.files;

//         if (files && files.length > 0) {
//           // If multiple spreadsheets with same name exist, take the first one
//           const spreadsheet = files[0];
//           console.log(
//             `✅ Found existing spreadsheet: ${spreadsheet.name} (ID: ${spreadsheet.id})`
//           );
//           return {
//             id: spreadsheet.id,
//             url: spreadsheet.webViewLink,
//           };
//         } else {
//           console.log(`No spreadsheet found with name: "${name}"`);
//           return null;
//         }
//       } catch (error) {
//         console.error("❌ Error searching for spreadsheet:", error);
//         return null;
//       }
//     };

//     /**
//    * using spreadSheetId and accessToken reads spreadSheet content
//    */
//   async readExistingSpreadsheetData (
//       refreshToken: string,
//       accessToken: string,
//       spreadsheetId: string
//     ) {
//       try {
//         console.log("Reading existing spreadsheet data...");

//         // First get the spreadsheet metadata to find the sheet range
//         const metadataResponse = await this.makeAuthenticatedRequest(
//           refreshToken,
//           accessToken,
//           `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
//           {
//             headers: {
//               "Content-Type": "application/json",
//             },
//           }
//         );

//         if (!metadataResponse.ok) {
//           throw new Error(
//             `Failed to get spreadsheet metadata: ${metadataResponse.status}`
//           );
//         }

//         const metadata = await metadataResponse.json();
//         const sheet = metadata.sheets[0];
//         const sheetTitle = sheet.properties.title;

//         // Read all data from the sheet
//         const dataResponse = await this.makeAuthenticatedRequest(
//           refreshToken,
//           accessToken,
//           `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}`,
//           {
//             headers: {
//               "Content-Type": "application/json",
//             },
//           }
//         );

//         if (!dataResponse.ok) {
//           throw new Error(
//             `Failed to read spreadsheet data: ${dataResponse.status}`
//           );
//         }

//         const data: SpreadSheetData = await dataResponse.json();
//         const rows = data.values;

//         if (!rows || rows.length === 0) {
//           console.log("Spreadsheet is empty");
//           return [];
//         }

//         console.log("Successfully read spreadsheet data:", rows.length, "rows");
//         return rows;
//       } catch (error) {
//         console.error("❌ Error reading spreadsheet data:", error);
//         return null;
//       }
//     };

//   async getData (
//       refreshToken: string,
//       accessToken: string
//     ): Promise<
//       | {
//           habits: IHabbit[];
//           notes: INote[];
//           snapshots: IDailySnapshot[];
//         }
//       | undefined
//     > {
//       if (!accessToken) {
//         return;
//       }
//       try {
//         // Search for existing spreadsheet by name
//         console.log(`Looking for spreadsheet named: "${SPREADSHEET_NAME}"`);
//         const existingSpreadsheet = await this.findSpreadsheetByName(
//           refreshToken,
//           accessToken,
//           SPREADSHEET_NAME
//         );

//         if (existingSpreadsheet) {
//           console.log("Found existing spreadsheet:", existingSpreadsheet.id);

//           // Update state with found spreadsheet info
//           // TODO add thunk to unitialize all spreadsheet ingo
//           this.dispatch(setSpreadsheetId(existingSpreadsheet.id));
//           this.dispatch(setSpreadsheetUrl(existingSpreadsheet.url));

//           // Always read and import data from existing spreadsheet
//           console.log(
//             "Reading data from existing spreadsheet to reinitialize local storage..."
//           );
//           const spreadsheetData = await this.readExistingSpreadsheetData(
//             refreshToken,
//             accessToken,
//             existingSpreadsheet.id
//           );

//           if (spreadsheetData) {
//             const parsedData = parseSpreadsheetDataToHabits(spreadsheetData);

//             console.log(
//               "✅ Successfully reinitialized habits from existing spreadsheet"
//             );
//             return parsedData;
//           } else {
//             console.log(
//               "No data found in existing spreadsheet, keeping current local data"
//             );
//           }
//         }
//         return undefined;
//       } catch (error) {
//         console.error("❌ Error syncing with Google Sheets:", error);
//         return undefined;
//       }
//     };

//   /**
//    * fill spreadsheet with habits
//    * calling getDailySnapshots and getHabits
//    */
//   async populateSpreadsheetWithHabits (
//       refreshToken: string,
//       accessToken: string,
//       spreadsheetId: string,
//       habits: IHabbit[],
//       habitSnapshots: IDailySnapshot[],
//       notes: INote[]
//     ) {
//       try {
//         console.log(
//           "Atomically syncing spreadsheet with latest habits data..."
//         );

//         // Get spreadsheet metadata to get sheet ID
//         const spreadsheetResponse = await this.makeAuthenticatedRequest(
//           refreshToken,
//           accessToken,
//           `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
//           {
//             headers: {
//               "Content-Type": "application/json",
//             },
//           }
//         );

//         if (!spreadsheetResponse.ok) {
//           throw new Error(
//             `Failed to get spreadsheet details: ${spreadsheetResponse.statusText}`
//           );
//         }

//         const spreadsheetData = await spreadsheetResponse.json();
//         const sheet = spreadsheetData.sheets[0];
//         const sheetId = sheet.properties.sheetId;

//         // Get daily snapshots (historical data) and habits (for names)
//         const snapshots = habitSnapshots;

//         console.log("Uploading snapshots:", snapshots);
//         console.log("Uploading habits:", habits);

//         if (snapshots.length === 0 && habits.length === 0) {
//           console.log("No data found to populate");
//           return;
//         }

//         // Create habit ID to name mapping from current habits
//         const habitIdToName = new Map<string, string>();
//         habits.forEach((habit) => {
//           habitIdToName.set(habit.id, habit.text);
//         });

//         // Create note ID to name mapping from current notes
//         const noteIdToName = new Map<string, string>();
//         notes.forEach((note) => {
//           noteIdToName.set(note.id, note.name);
//         });

//         // Get current habit names from local data
//         const currentHabitNames = Array.from(
//           new Set(habits.map((h) => h.text))
//         ).sort();
//         console.log("Current habits:", currentHabitNames);

//         // Get current note names from local data
//         const currentNoteNames = Array.from(
//           new Set(notes.map((n) => n.name))
//         ).sort();
//         console.log("Current notes:", currentNoteNames);

//         // Create headers with two rows: category row and column names row
//         const categoryRow = ["Date"];

//         // Add "Habits" label only at the first habit column, empty for others
//         if (currentHabitNames.length > 0) {
//           categoryRow.push("Habits");
//           categoryRow.push(...Array(currentHabitNames.length - 1).fill(""));
//         }

//         // Add "Notes" label only at the first note column, empty for others
//         if (currentNoteNames.length > 0) {
//           categoryRow.push("Notes");
//           categoryRow.push(...Array(currentNoteNames.length - 1).fill(""));
//         }

//         const columnNamesRow = ["Date", ...currentHabitNames, ...currentNoteNames];
//         const headers = [categoryRow, columnNamesRow];

//         // Create a data structure: Map<date, Map<habitName, progress>>
//         const dateData = new Map<string, Map<string, string>>();

//         snapshots.forEach((snapshot) => {
//           if (!dateData.has(snapshot.date)) {
//             dateData.set(snapshot.date, new Map());
//           }

//           const dayData = dateData.get(snapshot.date)!;

//           snapshot.habbits.forEach((habitSnapshot) => {
//             const habitName = habitIdToName.get(habitSnapshot.habbitId);
//             if (habitName && currentHabitNames.includes(habitName)) {
//               // Show progress as "actual/target" format
//               const progress = `${habitSnapshot.habbitDidCount}/${habitSnapshot.habbitNeedCount}`;
//               dayData.set(habitName, progress);
//             }
//           });

//           // Process notes for this day
//           if (snapshot.notes) {
//             snapshot.notes.forEach((noteSnapshot) => {
//               const noteName = noteIdToName.get(noteSnapshot.noteId);
//               if (noteName && currentNoteNames.includes(noteName)) {
//                 // Use note text if available, "No text for that day" if empty, or "" if note doesn't exist
//                 const noteText = noteSnapshot.noteText || "No text for that day";
//                 dayData.set(noteName, noteText);
//               }
//             });
//           }
//         });

//         // Convert to rows for the spreadsheet
//         const dataRows: string[][] = [];
//         const sortedDates = Array.from(dateData.keys()).sort();

//         sortedDates.forEach((date) => {
//           const row = [date];
//           const dayData = dateData.get(date)!;

//           // Add data for each habit column (in same order as headers)
//           currentHabitNames.forEach((habitName) => {
//             row.push(dayData.get(habitName) || ""); // Empty if no data for this habit on this date
//           });

//           // Add data for each note column (in same order as headers)
//           currentNoteNames.forEach((noteName) => {
//             row.push(dayData.get(noteName) || ""); // Empty if no data for this note on this date
//           });

//           dataRows.push(row);
//         });

//         // Combine headers and data
//         const allRows = [...headers, ...dataRows];

//         // Calculate dimensions for the update
//         const numColumns = currentHabitNames.length + currentNoteNames.length + 1; // +1 for Date column
//         const numRows = allRows.length;

//         console.log(
//           `Updating spreadsheet with ${numRows} rows and ${numColumns} columns`
//         );

//         // Prepare atomic batchUpdate request that handles everything
//         const requests = [
//           // First, ensure we have enough rows and columns
//           {
//             updateSheetProperties: {
//               properties: {
//                 sheetId: sheetId,
//                 gridProperties: {
//                   rowCount: Math.max(numRows + 10, 100), // Add some buffer
//                   columnCount: Math.max(numColumns + 5, 26), // Add some buffer
//                 },
//               },
//               fields: "gridProperties.rowCount,gridProperties.columnCount",
//             },
//           },
//           // Update all values in one go
//           {
//             updateCells: {
//               range: {
//                 sheetId: sheetId,
//                 startRowIndex: 0,
//                 endRowIndex: numRows,
//                 startColumnIndex: 0,
//                 endColumnIndex: numColumns,
//               },
//               rows: allRows.map((row) => ({
//                 values: row.map((cellValue) => ({
//                   userEnteredValue: { stringValue: cellValue || "" },
//                 })),
//               })),
//               fields: "userEnteredValue",
//             },
//           },
//           // Apply header formatting for category row (row 0)
//           {
//             repeatCell: {
//               range: {
//                 sheetId: sheetId,
//                 startRowIndex: 0,
//                 endRowIndex: 1,
//                 startColumnIndex: 0,
//                 endColumnIndex: numColumns,
//               },
//               cell: {
//                 userEnteredFormat: {
//                   backgroundColor: { red: 0.3, green: 0.3, blue: 0.3 },
//                   textFormat: {
//                     foregroundColor: { red: 1, green: 1, blue: 1 },
//                     fontSize: 14,
//                     bold: true,
//                   },
//                   horizontalAlignment: "CENTER",
//                   verticalAlignment: "MIDDLE",
//                 },
//               },
//               fields: "userEnteredFormat",
//             },
//           },
//           // Apply header formatting for column names row (row 1)
//           {
//             repeatCell: {
//               range: {
//                 sheetId: sheetId,
//                 startRowIndex: 1,
//                 endRowIndex: 2,
//                 startColumnIndex: 0,
//                 endColumnIndex: numColumns,
//               },
//               cell: {
//                 userEnteredFormat: {
//                   backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
//                   textFormat: {
//                     foregroundColor: { red: 1, green: 1, blue: 1 },
//                     fontSize: 12,
//                     bold: true,
//                   },
//                   horizontalAlignment: "CENTER",
//                   verticalAlignment: "MIDDLE",
//                 },
//               },
//               fields: "userEnteredFormat",
//             },
//           },
//           // Apply data formatting
//           {
//             repeatCell: {
//               range: {
//                 sheetId: sheetId,
//                 startRowIndex: 2,
//                 endRowIndex: numRows,
//                 startColumnIndex: 0,
//                 endColumnIndex: numColumns,
//               },
//               cell: {
//                 userEnteredFormat: {
//                   textFormat: {
//                     fontSize: 10,
//                   },
//                   horizontalAlignment: "CENTER",
//                   verticalAlignment: "MIDDLE",
//                 },
//               },
//               fields: "userEnteredFormat",
//             },
//           },
//           // Add borders
//           {
//             updateBorders: {
//               range: {
//                 sheetId: sheetId,
//                 startRowIndex: 0,
//                 endRowIndex: numRows,
//                 startColumnIndex: 0,
//                 endColumnIndex: numColumns,
//               },
//               top: {
//                 style: "SOLID",
//                 width: 1,
//                 color: { red: 0.8, green: 0.8, blue: 0.8 },
//               },
//               bottom: {
//                 style: "SOLID",
//                 width: 1,
//                 color: { red: 0.8, green: 0.8, blue: 0.8 },
//               },
//               left: {
//                 style: "SOLID",
//                 width: 1,
//                 color: { red: 0.8, green: 0.8, blue: 0.8 },
//               },
//               right: {
//                 style: "SOLID",
//                 width: 1,
//                 color: { red: 0.8, green: 0.8, blue: 0.8 },
//               },
//               innerHorizontal: {
//                 style: "SOLID",
//                 width: 1,
//                 color: { red: 0.9, green: 0.9, blue: 0.9 },
//               },
//               innerVertical: {
//                 style: "SOLID",
//                 width: 1,
//                 color: { red: 0.9, green: 0.9, blue: 0.9 },
//               },
//             },
//           },
//           // Auto-resize columns
//           {
//             autoResizeDimensions: {
//               dimensions: {
//                 sheetId: sheetId,
//                 dimension: "COLUMNS",
//                 startIndex: 0,
//                 endIndex: numColumns,
//               },
//             },
//           },
//           // Freeze first two rows and first column
//           {
//             updateSheetProperties: {
//               properties: {
//                 sheetId: sheetId,
//                 gridProperties: {
//                   frozenRowCount: 2,
//                   frozenColumnCount: 1,
//                 },
//               },
//               fields:
//                 "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
//             },
//           },
//         ];

//         // Execute the atomic batch update
//         const response = await this.makeAuthenticatedRequest(
//           refreshToken,
//           accessToken,
//           `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
//           {
//             method: "POST",
//             headers: {
//               "Content-Type": "application/json",
//             },
//             body: JSON.stringify({ requests }),
//           }
//         );

//         if (!response.ok) {
//           const errorBody = await response.text();
//           throw new Error(
//             `Failed to update spreadsheet: ${response.status} ${response.statusText} - ${errorBody}`
//           );
//         }

//         console.log(
//           `✅ Successfully updated spreadsheet with ${dataRows.length} data rows, ${currentHabitNames.length} habit columns, and ${currentNoteNames.length} note columns in one atomic operation`
//         );
//       } catch (error) {
//         console.error("❌ Error populating spreadsheet with habits:", error);
//       }
//     };

//     /**
//    *
//    */
//   async createGoogleSpreadSheet (
//       refreshToken: string,
//       accessToken: string,
//       habits: IHabbit[],
//       habitSnapshots: IDailySnapshot[],
//       notes: INote[]
//     ) {
//       // Create a new spreadsheet
//       console.log("Creating new habits spreadsheet...");

//       const response = await this.makeAuthenticatedRequest(
//         refreshToken,
//         accessToken,
//         "https://sheets.googleapis.com/v4/spreadsheets",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             properties: {
//               title: SPREADSHEET_NAME,
//             },
//             sheets: [
//               {
//                 properties: {
//                   title: "Habits Data",
//                 },
//               },
//             ],
//           }),
//         }
//       );

//       if (!response.ok) {
//         throw new Error(`Failed to create spreadsheet: ${response.statusText}`);
//       }

//       const spreadsheet = await response.json();
//       console.log("✅ Spreadsheet created successfully:", spreadsheet);
//       console.log("📝 Spreadsheet ID:", spreadsheet.spreadsheetId);
//       console.log("🔗 Spreadsheet URL:", spreadsheet.spreadsheetUrl);

//       // Populate with existing habits data (this will also set up headers)
//       await this.populateSpreadsheetWithHabits(
//         refreshToken,
//         accessToken,
//         spreadsheet.spreadsheetId,
//         habits,
//         habitSnapshots,
//         notes
//       );

//       // Update state with new spreadsheet info
//       setSpreadsheetId(spreadsheet.spreadsheetId);
//       setSpreadsheetUrl(spreadsheet.spreadsheetUrl);

//       return spreadsheet;
//     };

//   /**
//    * using refresh token from localStorage get access token and get google data.
//    * If table doesn't exist create table with data from arguments.
//    * If something went wrong return undefined.
//    */
//   async getDataCheckEmpty (
//       refreshTokenArg: string,
//       today: Date
//     ): Promise<
//       | {
//           snapshots: IDailySnapshot[];
//           habits: IHabbit[];
//           notes: INote[];
//         }
//       | undefined
//     > {
//       console.log('useGoogle: Getting habits...');
//       const habits = getHabits();
//       const snapshots = getDailySnapshots(today);
//       const notes = getNotes();
//       if (refreshTokenArg) {
//         // Automatically try to get a fresh access token
//         const newAccessToken = await refreshAccessToken(refreshTokenArg);
//         if (newAccessToken) {
//           console.log(
//             "useGoogle: ✅ Successfully refreshed access token from stored refresh token"
//           );

//           setAccessToken(newAccessToken);

//           const googleData = await this.getData(refreshTokenArg, newAccessToken);
//           if (googleData === undefined) {
//             const spreadSheet = await this.createGoogleSpreadSheet(
//               refreshTokenArg,
//               newAccessToken,
//               habits,
//               snapshots,
//               notes
//             );

//             if (!spreadSheet) {
//               // throw new Error("Spreadsheet couldn't be created");
//               return undefined;
//             }
//             return { habits, notes, snapshots: snapshots };
//           } else {
//             return googleData;
//           }
//         } else {
//           console.log(
//             "useGoogle: ❌ Failed to refresh access token"
//           );
//           return undefined;
//         }
//       }
//       return { habits, notes, snapshots };
//     };

//   async getGoogleData(today: Date) {
//     if (this.refreshToken) {
//       this.dispatch(setStatus(GoogleState.UPDATING));
//       getDataCheckEmpty(refreshToken, today)
//         .then((res) => {
//           if (res) {
//             console.log(ignoreFetch);
//             if (!ignoreFetch) {
//               setLoadedData(res);
//               setStatus(GoogleState.CONNECTED);
//             }
//           }
//         })
//         .catch((error) => {
//           console.log(error);
//           setStatus(GoogleState.ERROR);
//         });
//     } else {
//       console.log("No refrest token in getGoogleData")
//     }
//   }


//   useEffect(() => {    
//     console.log("useGoogle: getGoogleData effect called")
//     if (!today || !refreshToken) {
//       console.log("useGoogle: no today or refresh token in useGoogle effect");
//       setLoadedData(undefined);
//       setStatus(GoogleState.NOT_CONNECTED);
//       return;
//     }
    
//     getGoogleData(today);

//     return () => {
//       console.log("un mount");
//       ignoreFetch = true;
//     }
//   }, [getGoogleData]);


//   /**
//    * Populates spreadSheet it with data from local storage
//    */
//   const uploadData = useCallback(async (today: Date) => {
//     setStatus(GoogleState.UPDATING);
//     const habits = getHabits();
//     const snapshots = getDailySnapshots(today);
//     const notes = getNotes();
//     try {
//       console.log("Manual sync: Pushing local data to spreadsheet...");

//       if (spreadsheetId) {
//         // Push local data to spreadsheet (don't read from spreadsheet)
//         await populateSpreadsheetWithHabits(
//           refreshToken ?? "",
//           accessTokenRef.current ?? "",
//           spreadsheetId,
//           habits,
//           snapshots,
//           notes
//         );
//         console.log("✅ Successfully pushed local data to spreadsheet");
//         setStatus(GoogleState.CONNECTED);
//         return;
//       } else {
//         // If no spreadsheet exists, create one
//         console.error("No spreadsheetId found in manualSyncToSpreadsheet");
//         setStatus(GoogleState.ERROR);
//         return;
//       }
//     } catch (error) {
//       console.error("❌ Error during manual sync:", error);
//       setStatus(GoogleState.ERROR);
//     }
//   }, [populateSpreadsheetWithHabits, spreadsheetId, refreshToken]);

//     /**
//    * Actual sync execution function
//    */
//   const uploadDataSafe = useCallback( async (today: Date, operationName: string) => {
//     console.log("🔄 Triggering spreadsheet sync...");
//     pending = true;
//     try {
//       await uploadData(today);
//       console.log("✅ Spreadsheet sync completed");
//     } catch (error) {
//       console.error("❌ Spreadsheet sync failed:", error);
//     } finally {
//       pending = false;

//       if (hasQueue) {
//         hasQueue = false;
//         await uploadDataSafe(today, operationName);
//       }
//     }
//   }, [uploadData]);

//   const triggerSync = useCallback(async (today: Date, operationName: string) => {
//     console.log("triggerSync called with operation " + operationName);
    
//     if (state === GoogleState.NOT_CONNECTED) {
//       return;
//     }
//     if (!today || !refreshToken) {
//       return;
//     }

//     return new Promise((resolve) => {
//       console.log("Promise triggerSync called with operation " + operationName);

//       // Clear existing timer
//       if (debounceTimer) {
//         clearTimeout(debounceTimer);
//       }

//       // Set new timer
//       debounceTimer = setTimeout(() => {
//         debounceTimer = null;
//         if (!pending) {
//            uploadDataSafe(today, operationName).then(() => {
//             resolve(true);
//           });
//         } else {
//           console.log("Pending is now. Operation suspended");
//           hasQueue = true;
//         }
//       }, DEBOUNCE_MS);

//       console.log(
//         `⏱️ Sync scheduled in ${DEBOUNCE_MS}ms (debounced). 
//         Operation name: ${operationName}`
//       );
//     })
//   }, [refreshToken, state, uploadDataSafe]);


//   return {
//     googleState: state,
//     getGoogleData,
//     uploadDataToGoogle: triggerSync,
//     setGoolgeAccessToken: setAccessToken,
//     spreadsheetUrl,
//     spreadsheetId,
//     loadedData,
//     refreshToken,
//   };
// };

// }