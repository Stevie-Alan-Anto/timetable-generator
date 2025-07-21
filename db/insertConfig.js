const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'timetable.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY,
      working_days INTEGER,
      periods_per_day INTEGER
    )
  `);

  db.get("SELECT COUNT(*) as count FROM config", (err, row) => {
    if (err) {
      console.error("Error checking config table:", err);
      return;
    }

    if (row.count === 0) {
      db.run(`
        INSERT INTO config (working_days, periods_per_day)
        VALUES (5, 8)
      `, (err) => {
        if (err) {
          console.error("Error inserting default config:", err);
        } else {
          console.log("✅ Default config inserted successfully.");
        }
        db.close();
      });
    } else {
      console.log("✅ Config already exists.");
      db.close();
    }
  });
});
