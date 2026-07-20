const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { sendWebsiteAppointmentMail } = require("../utils/mailer");

/* ===============================
   BOOK APPOINTMENT
================================ */

router.post("/book-appointment", async (req, res) => {
  console.log("========================================");
  console.log("🔥 BOOK APPOINTMENT API HIT");
  console.log("========================================");
  console.log("DB URL:", process.env.DATABASE_URL);
  console.log("Request Body:", req.body);

  let {
    phone,
    patient_name,
    email,
    age,
    date,
    time_value,
    time_label,
    doctor_name,
    doctor_specialization,
    address
  } = req.body || {};

  // Normalize phone
  phone = (phone || "")
    .toString()
    .trim()
    .replace(/\D/g, "")
    .replace(/^91/, "");

  console.log("Processed Data:", {
    patient_name,
    phone,
    email,
    age,
    date,
    time_value,
    doctor_name,
    doctor_specialization,
    address
  });

  // Phone validation
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Phone must be exactly 10 digits"
    });
  }

  // Required fields validation
  const missingFields = [];

  if (!patient_name) missingFields.push("patient_name");
  if (!date) missingFields.push("date");
  if (!time_value) missingFields.push("time_value");
  if (!doctor_name) missingFields.push("doctor_name");

  if (missingFields.length > 0) {
    console.log("❌ Missing Fields:", missingFields);

    return res.status(400).json({
      success: false,
      message: "Missing required fields",
      missingFields
    });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO appointments
      (
        phone,
        patient_name,
        age,
        email,
        date,
        time_label,
        time_value,
        address,
        doctor_name,
        doctor_specialization,
        source
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
      `,
      [
        phone,
        patient_name,
        age || null,
        email || null,
        date,
        time_value,
        time_value,
        address || null,
        doctor_name,
        doctor_specialization || null,
        "WEBSITE"
      ]
    );

    console.log("✅ Appointment Saved");
    console.log(result.rows[0]);

    sendWebsiteAppointmentMail({
      email,
      patient_name,
      date,
      time: time_value,
      doctor: doctor_name
    }).catch(err => {
      console.error("❌ Mail Error:", err.message);
    });

    return res.status(200).json({
      success: true,
      message: "Appointment booked successfully",
      appointment: result.rows[0]
    });

  } catch (err) {
    console.error("========================================");
    console.error("❌ DATABASE ERROR");
    console.error(err);
    console.error("Message:", err.message);
    console.error("Detail:", err.detail);
    console.error("Constraint:", err.constraint);
    console.error("========================================");

    return res.status(500).json({
      success: false,
      message: "Failed to book appointment",
      error: err.message,
      detail: err.detail || null,
      constraint: err.constraint || null
    });
  }
});

/* ===============================
   GET BOOKED SLOTS
================================ */

router.get("/booked-slots", async (req, res) => {
  const { doctor_name, date } = req.query;

  if (!doctor_name || !date) {
    return res.json({
      success: true,
      data: []
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT time_value
      FROM appointments
      WHERE doctor_name = $1
      AND date = $2
      `,
      [doctor_name, date]
    );

    return res.json({
      success: true,
      data: result.rows.map(r => r.time_value)
    });

  } catch (err) {
    console.error("Slot Fetch Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch booked slots"
    });
  }
});

module.exports = router;