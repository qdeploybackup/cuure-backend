import { sendPromo } from "./meta/sendPromo.js";

await sendPromo(patientPhone, patientName);

const sqlite3 = require("sqlite3").verbose();
const XLSX = require("xlsx");

const db = new sqlite3.Database("./cuure.db");

db.all(
  `SELECT
      id,
      phone,
      age,v 
      patient_name,
      date,
      time_label,
      time_value,
      created_at
    FROM appointments
    ORDER BY date, time_value`,
  (err, rows) => {
    if (err) {
      console.error("DB query error:", err.message);
      process.exit(1);
    }

    const data = rows.map((r) => ({
      ID: r.id,
      Phone: r.phone,
      Name: r.patient_name,
      Date: r.date,
      "Time Slot": r.time_label,
      "Time (24h)": r.time_value,
      "Booked At": r.created_at,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Appointments");

    XLSX.writeFile(wb, "appointments.xlsx");
    console.log("✅ appointments.xlsx created successfully");
    process.exit(0);
  }
);