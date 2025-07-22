const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db/database');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const { Parser } = require('json2csv');
const util = require('util');

const app = express();
// Simple maintenance mode toggle (FREE)
const maintenanceMode = false; // Change this to true when needed

app.use((req, res, next) => {
  if (maintenanceMode) {
    return res.send(`
      <html>
        <head><title>Maintenance</title></head>
        <body style="text-align:center;padding:50px;font-family:sans-serif;">
          <h1>🛠️ We'll be back soon!Tommorow Grand Launch BY:Kathuma Stay tuned...</h1>
          <p>Our site is undergoing scheduled maintenance. Please check back later.</p>
        </body>
      </html>
    `);
  }
  next();
});


const PORT = 3000;

// Setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Promisify DB methods
const dbRun = util.promisify(db.run.bind(db));
const dbAll = util.promisify(db.all.bind(db));
const dbGet = util.promisify(db.get.bind(db));

// 🏠 Home
app.get('/', (req, res) => {
  res.render('index');
});

// ➕ Add Teacher
app.post('/add-teacher', async (req, res) => {
  const { teacherName, className, subject, periods } = req.body;
  if (!teacherName || !className || !subject || !periods) return res.status(400).send("Invalid input.");

  const classes = Array.isArray(className) ? className : [className];
  const subjects = Array.isArray(subject) ? subject : [subject];
  const periodsArray = Array.isArray(periods) ? periods : [periods];

  try {
    for (let i = 0; i < classes.length; i++) {
      await dbRun(
        'INSERT INTO teachers (teacherName, className, subject, periods) VALUES (?, ?, ?, ?)',
        [teacherName.trim(), classes[i].trim(), subjects[i].trim(), parseInt(periodsArray[i])]
      );
    }
    res.redirect('/teachers');
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to add teacher.");
  }
});

// 📋 View All Teachers
app.get('/teachers', async (req, res) => {
  try {
    const teachers = await dbAll('SELECT * FROM teachers');
    res.render('teachers', { teachers });
  } catch (err) {
    res.status(500).send("Error fetching teachers.");
  }
});

// ✏️ Edit Teacher
app.get('/edit-teacher/:id', async (req, res) => {
  const teacher = await dbGet('SELECT * FROM teachers WHERE id = ?', [req.params.id]);
  if (!teacher) return res.send('Teacher not found');
  res.render('editTeacher', { teacher });
});

app.post('/edit-teacher/:id', async (req, res) => {
  const { teacherName, className, subject, periods } = req.body;
  const { id } = req.params;
  if (!teacherName || !className || !subject || isNaN(periods)) return res.status(400).send("Invalid input.");

  try {
    await dbRun(
      'UPDATE teachers SET teacherName = ?, className = ?, subject = ?, periods = ? WHERE id = ?',
      [teacherName, className, subject, parseInt(periods), id]
    );
    res.redirect('/teachers');
  } catch (err) {
    res.send("Update failed.");
  }
});

// 🗑️ Delete Teacher
app.post('/delete-teacher/:id', async (req, res) => {
  await dbRun('DELETE FROM teachers WHERE id = ?', [req.params.id]);
  res.redirect('/teachers');
});

// 📤 Export Teachers to CSV
app.get('/download/teachers-csv', async (req, res) => {
  const teachers = await dbAll('SELECT * FROM teachers');
  const parser = new Parser({ fields: ['id', 'teacherName', 'className', 'subject', 'periods'] });
  const csv = parser.parse(teachers);
  res.setHeader('Content-disposition', 'attachment; filename=teachers.csv');
  res.set('Content-Type', 'text/csv');
  res.status(200).send(csv);
});

// 📅 Generate Class-wise Timetables
app.get('/generate', async (req, res) => {
  const teachers = await dbAll('SELECT * FROM teachers');
  const config = await dbGet('SELECT * FROM config LIMIT 1');
  const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const days = fullDays.slice(0, config.working_days);
  const periodsPerDay = config.periods_per_day;

  const breakPeriod = 4;

  const classTimetables = {};
  const teacherTimetables = {};
  const teacherSlots = teachers.map(t => ({ ...t, remaining: t.periods }));
  const classSubjectsMap = {};

  teacherSlots.forEach(t => {
    if (!classSubjectsMap[t.className]) classSubjectsMap[t.className] = [];
    classSubjectsMap[t.className].push({
      teacherName: t.teacherName,
      subject: t.subject,
      periods: t.periods,
      remaining: t.periods
    });
  });

  for (const cls in classSubjectsMap)
    classTimetables[cls] = Array.from({ length: days.length }, () => Array(periodsPerDay).fill(null));

  teachers.forEach(t =>
    teacherTimetables[t.teacherName] = Array.from({ length: days.length }, () => Array(periodsPerDay).fill(null))
  );

  await dbRun('DELETE FROM timetable_entries');

  for (const cls in classSubjectsMap) {
    const subjectSlots = classSubjectsMap[cls];
    for (let d = 0; d < days.length; d++) {
      const usedSubjects = new Set();
      for (let p = 0; p < periodsPerDay; p++) {
        if (p === breakPeriod) continue;

        const available = subjectSlots.filter(s => s.remaining > 0 && !usedSubjects.has(s.subject));
        if (!available.length) continue;

        const selected = available[Math.floor(Math.random() * available.length)];

        if (teacherTimetables[selected.teacherName][d][p] || classTimetables[cls][d][p]) continue;

        classTimetables[cls][d][p] = {
          className: cls,
          subject: selected.subject,
          teacherName: selected.teacherName
        };

        teacherTimetables[selected.teacherName][d][p] = {
          subject: selected.subject,
          className: cls
        };

        selected.remaining--;
        usedSubjects.add(selected.subject);

        await dbRun(
          'INSERT INTO timetable_entries (className, teacherName, subject, day, period) VALUES (?, ?, ?, ?, ?)',
          [cls, selected.teacherName, selected.subject, days[d], p + 1]
        );
      }
    }
  }

  res.render('classTimetables', { classTimetables, days });
});

// 👨‍🏫 Generate Teacher-wise Timetables
app.get('/teacher-timetables', async (req, res) => {
  const teachers = await dbAll('SELECT * FROM teachers');
  const config = await dbGet('SELECT * FROM config LIMIT 1');
  const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const days = fullDays.slice(0, config.working_days);
  const periodsPerDay = config.periods_per_day;
  
  const breakPeriod = 4;

  const teacherTimetables = {};
  const classTimetables = {};
  const teacherSlots = teachers.map(t => ({ ...t, remaining: t.periods }));
  const classSubjectsMap = {};

  teacherSlots.forEach(t => {
    if (!classSubjectsMap[t.className]) classSubjectsMap[t.className] = [];
    classSubjectsMap[t.className].push({
      teacherName: t.teacherName,
      subject: t.subject,
      periods: t.periods,
      remaining: t.periods
    });
  });

  for (const cls in classSubjectsMap)
    classTimetables[cls] = Array.from({ length: days.length }, () => Array(periodsPerDay).fill(null));

  teachers.forEach(t =>
    teacherTimetables[t.teacherName] = Array.from({ length: days.length }, () => Array(periodsPerDay).fill(null))
  );

  for (const cls in classSubjectsMap) {
    const subjectSlots = classSubjectsMap[cls];
    for (let d = 0; d < days.length; d++) {
      const usedSubjects = new Set();
      for (let p = 0; p < periodsPerDay; p++) {
        if (p === breakPeriod) continue;

        const available = subjectSlots.filter(s => s.remaining > 0 && !usedSubjects.has(s.subject));
        if (!available.length) continue;

        const selected = available[Math.floor(Math.random() * available.length)];

        if (teacherTimetables[selected.teacherName][d][p] || classTimetables[cls][d][p]) continue;

        classTimetables[cls][d][p] = {
          subject: selected.subject,
          teacherName: selected.teacherName
        };

        teacherTimetables[selected.teacherName][d][p] = {
          subject: selected.subject,
          className: cls
        };

        selected.remaining--;
        usedSubjects.add(selected.subject);
      }
    }
  }

  res.render('teacherTimetables', { teacherTimetables, days });
});

// 📥 PDF Export
app.get('/download/class-timetables', async (req, res) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/generate`, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="class-timetables.pdf"');
  res.send(pdfBuffer);
});

app.get('/download/teacher-timetables', async (req, res) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/teacher-timetables`, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="teacher-timetables.pdf"');
  res.send(pdfBuffer);
});

// Legacy redirect
app.get('/generate/teachers', (req, res) => {
  res.redirect('/teacher-timetables');
});

app.use(express.json());

app.post('/update-timetable-entry', (req, res) => {
  const { teacherName, className, subject, day, period } = req.body;

  if (!teacherName || !subject || !day || !period || !className) {
    return res.status(400).send('Missing data.');
  }

  db.run(`
    INSERT INTO timetable_entries (className, teacherName, subject, day, period)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(className, day, period) DO UPDATE SET
      teacherName = excluded.teacherName,
      subject = excluded.subject;
  `, [className, teacherName, subject, day, parseInt(period)], (err) => {
    if (err) {
      console.error('DB Error:', err);
      return res.status(500).send('Database error');
    }
    res.sendStatus(200);
  });
});

// 📚 Subject–Teacher Chart
app.get('/subject-chart', async (req, res) => {
  try {
    const rows = await dbAll('SELECT DISTINCT subject, className, teacherName FROM teachers');
    const classSet = new Set();
    const subjectMap = {};

    rows.forEach(({ subject, className, teacherName }) => {
      classSet.add(className);
      if (!subjectMap[subject]) subjectMap[subject] = {};
      subjectMap[subject][className] = teacherName;
    });

    const allClasses = Array.from(classSet).sort();
    const allSubjects = Object.keys(subjectMap).sort();

    res.render('subjectChart', { subjectMap, allClasses, allSubjects });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to generate subject chart.");
  }
});

// 🛠️ Configuration (GET & POST)
app.get('/config', async (req, res) => {
  try {
    const config = await dbGet('SELECT * FROM config LIMIT 1');
    res.render('config', { config });
  } catch (err) {
    console.error('Error loading config:', err);
    res.status(500).send("Failed to load config.");
  }
});

app.post('/config', async (req, res) => {
  const { working_days, periods_per_day } = req.body;
  if (!working_days || !periods_per_day) return res.status(400).send("Missing config values.");

  try {
    await dbRun('UPDATE config SET working_days = ?, periods_per_day = ?', [
      parseInt(working_days),
      parseInt(periods_per_day)
    ]);
    res.redirect('/config');
  } catch (err) {
    console.error('Error updating config:', err);
    res.status(500).send("Failed to update config.");
  }
});



// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
