const { Pool } = require("pg");
const { DATABASE_URL, NODE_ENV } = require("./env");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

module.exports = pool;