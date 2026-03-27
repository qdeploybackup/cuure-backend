const { Pool } = require("pg");

/* ===============================
   POSTGRESQL CONNECTION
================================ */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/* ===============================
   APPOINTMENTS CACHE
================================ */
const appointmentsCache = [];

/* ===============================
   INIT DB TABLES
================================ */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      phone TEXT UNIQUE,
      name TEXT,
      age INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      phone TEXT,
      patient_name TEXT,
      date TEXT,
      time_label TEXT,
      time_value TEXT,
      address TEXT,
      location_link TEXT,
      doctor_name TEXT,
      doctor_specialization TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_requests (
      id SERIAL PRIMARY KEY,
      appointment_id INTEGER,
      doctor_name TEXT,
      patient_phone TEXT,
      patient_name TEXT,
      amount INTEGER,
      payment_link TEXT,
      status TEXT DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    )
  `);

  // preload appointments cache
  try {
    const res = await pool.query(
      `SELECT phone, patient_name, date, time_label, time_value FROM appointments`
    );
    appointmentsCache.push(...res.rows);
    console.log(`✅ Loaded ${res.rows.length} appointments into cache`);
  } catch (err) {
    console.error("❌ Error loading appointments cache:", err);
  }
}

// auto-init
initDB().catch(console.error);

module.exports = {
  pool,
  appointmentsCache,
};