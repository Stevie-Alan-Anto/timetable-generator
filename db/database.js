// const sqlite3 = require('sqlite3').verbose();
// const path = require('path');

// // Resolve full path to the database file
// const dbPath = path.resolve(__dirname, 'timetable.db');

// // Open the database connection
// const db = new sqlite3.Database(dbPath, (err) => {
//   if (err) {
//     console.error('❌ Error opening database:', err.message);
//   } else {
//     console.log('✅ Connected to SQLite database at', dbPath);
//   }
// });

// db.serialize(() => {
//   // 👨‍🏫 Teachers table
//   db.run(`
//     CREATE TABLE IF NOT EXISTS teachers (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       teacherName TEXT NOT NULL,
//       className TEXT NOT NULL,
//       subject TEXT NOT NULL,
//       periods INTEGER NOT NULL
//     );
//   `, (err) => {
//     if (err) {
//       console.error('❌ Error creating teachers table:', err.message);
//     } else {
//       console.log('✅ Teachers table is ready.');
//     }
//   });

//   // 📆 Timetable Entries table
//   db.run(`
//     CREATE TABLE IF NOT EXISTS timetable_entries (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       className TEXT NOT NULL,
//       teacherName TEXT NOT NULL,
//       subject TEXT NOT NULL,
//       day TEXT NOT NULL,
//       period INTEGER NOT NULL,
//       UNIQUE(className, day, period)
//     );
//   `, (err) => {
//     if (err) {
//       console.error('❌ Error creating timetable_entries table:', err.message);
//     } else {
//       console.log('✅ Timetable Entries table is ready.');
//     }
//   });

//   // ⚙️ Config table
//   db.run(`
//     CREATE TABLE IF NOT EXISTS config (
//       working_days INTEGER,
//       periods_per_day INTEGER
//     );
//   `, (err) => {
//     if (err) {
//       console.error('❌ Error creating config table:', err.message);
//     } else {
//       console.log('✅ Config table is ready.');

//       // Insert default config only if the table is empty
//       db.get('SELECT COUNT(*) as count FROM config', (err, row) => {
//         if (err) {
//           console.error('❌ Error checking config table:', err.message);
//         } else if (row.count === 0) {
//           db.run(`
//             INSERT INTO config (working_days, periods_per_day)
//             VALUES (5, 8);
//           `, (err) => {
//             if (err) {
//               console.error('❌ Error inserting default config:', err.message);
//             } else {
//               console.log('✅ Default config values are set.');
//             }
//           });
//         }
//       });
//     }
//   });
// });

// // Export the database object
// module.exports = db;




const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use this for local dev
const dbPath = path.resolve(__dirname, 'timetable.db');

// For production on platforms like Render:
// const dbPath = path.resolve('/tmp', 'timetable.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to the database:', err.message);
  } else {
    console.log(`✅ Connected to SQLite database at ${dbPath}`);
  }
});

// Create the Teachers table
db.run(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subjects TEXT NOT NULL,
    classes TEXT NOT NULL
  )
`, () => console.log('✅ Teachers table is ready.'));

// Create the Timetable Entries table
db.run(`
  CREATE TABLE IF NOT EXISTS timetable_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    className TEXT,
    teacherName TEXT,
    subject TEXT,
    day TEXT,
    period INTEGER
  )
`, () => console.log('✅ Timetable Entries table is ready.'));

// ✅ Create the Config table
db.run(`
  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    workingDays INTEGER NOT NULL DEFAULT 5,
    periodsPerDay INTEGER NOT NULL DEFAULT 6
  )
`, () => {
  console.log('✅ Config table is ready.');

  // Insert default config if not present
  db.get('SELECT COUNT(*) as count FROM config', (err, row) => {
    if (err) {
      console.error('❌ Error checking config table:', err.message);
    } else if (row.count === 0) {
      db.run(`
        INSERT INTO config (working_days, periods_per_day)
        VALUES (5, 8);
      `, (err) => {
        if (err) {
          console.error('❌ Error inserting default config:', err.message);
        } else {
          console.log('✅ Default config values are set.');
        }
      });
    }
  });
}); // Add missing closing brace for db.get callback

module.exports = db;
