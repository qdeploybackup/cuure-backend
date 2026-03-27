const { Pool } = require("pg");

// Load env variables (safe for local, ignored in Railway)
require("dotenv").config();

console.log("DB URL:", process.env.DATABASE_URL ? "Loaded ✅" : "Missing ❌");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // required for Railway
  },
});

module.exports = pool;