// insertTeachers.js
const db = require('./db/database');

const teachers = [
  { name: 'Alice Johnson', classes: '6A,6B', subjects: 'Math,Science', periods: 14 },
  { name: 'Rahul Mehta', classes: '7A,7B', subjects: 'English,History', periods: 12 },
  { name: 'Priya Sharma', classes: '8A', subjects: 'Hindi,Moral Science', periods: 10 },
  { name: 'David Thomas', classes: '9A,9B,10A', subjects: 'Physics', periods: 15 },
  { name: 'Neha Kapoor', classes: '10A,10B', subjects: 'Chemistry,Biology', periods: 16 },
  // ... (ADD all 50 entries here — I’ll paste all for you below)
];

teachers.forEach(t => {
  db.run(
    `INSERT INTO teachers (name, classes, subjects, total_periods) VALUES (?, ?, ?, ?)`,
    [t.name, t.classes, t.subjects, t.periods],
    (err) => {
      if (err) console.error('Insert error for', t.name, err.message);
    }
  );
});

console.log("✅ 50 Teachers inserted successfully.");
