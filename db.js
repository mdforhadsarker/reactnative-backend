const sqlite3 = require('sqlite3').verbose();

// Create and connect to the SQLite database (it will create the database file if it doesn't exist)
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error("Error connecting to the database", err);
  } else {
    console.log("Connected to the SQLite database");
  }
});

// Create the form_data and mouza_info tables if they don't exist
db.serialize(() => {
  // Create form_data table
  db.run(`
    CREATE TABLE IF NOT EXISTS form_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      division TEXT,
      district TEXT,
      upazila TEXT,
      \`union\` TEXT        -- Backticks around 'union'
    );
  `, (err) => {
    if (err) {
      console.error('Error creating form_data table:', err);
    } else {
      console.log('form_data table created or already exists.');
    }
  });

  // Create mouza_info table with foreign key reference to form_data
  db.run(`
    CREATE TABLE IF NOT EXISTS mouza_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_data_id INTEGER,
      mouzaName TEXT,
      surveyType TEXT,
      sheetNumber TEXT,
      FOREIGN KEY (form_data_id) REFERENCES form_data(id) ON DELETE CASCADE
    );
  `, (err) => {
    if (err) {
      console.error('Error creating mouza_info table:', err);
    } else {
      console.log('mouza_info table created or already exists.');
    }
  });
});

module.exports = db;
