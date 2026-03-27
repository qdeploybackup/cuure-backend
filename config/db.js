const { Pool } = require("pg");

/* ===============================
   POSTGRESQL CONNECTION
================================ */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Debug connection
pool.connect()
  .then(() => console.log("✅ Connected to Railway PostgreSQL"))
  .catch(err => console.error("❌ DB Connection Error:", err));

/* ===============================
   APPOINTMENTS CACHE
================================ */
const appointmentsCache = [];

/* ===============================
   INIT DB TABLES
================================ */
async function initDB() {
  try {
    /* ===============================
       USERS TABLE
    ================================ */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone TEXT UNIQUE,
        name TEXT,
        age INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    /* ===============================
       APPOINTMENTS TABLE (UPDATED ✅)
    ================================ */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        phone TEXT,
        patient_name TEXT,
        age INTEGER,
        email TEXT,
        date TEXT,
        time_label TEXT,
        time_value TEXT,
        address TEXT,
        location_link TEXT,
        doctor_name TEXT,
        doctor_specialization TEXT,
        source TEXT DEFAULT 'WHATSAPP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    /* ===============================
       PAYMENT REQUESTS TABLE (UPDATED ✅)
    ================================ */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_requests (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER,
        doctor_name TEXT,
        patient_phone TEXT,
        patient_name TEXT,
        email TEXT,
        amount INTEGER,
        payment_link TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id)
      )
    `);

    /* ===============================
       PRELOAD CACHE
    ================================ */
    try {
      const res = await pool.query(
        `SELECT phone, patient_name, date, time_label, time_value FROM appointments`
      );

      appointmentsCache.push(...res.rows);

      console.log(`✅ Loaded ${res.rows.length} appointments into cache`);
    } catch (err) {
      console.error("❌ Error loading appointments cache:", err);
    }

  } catch (err) {
    console.error("❌ Error initializing DB:", err);
  }
}

// auto-init
initDB();

module.exports = {
  pool,
  appointmentsCache,
};