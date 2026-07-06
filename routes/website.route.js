const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { sendAppointmentMail } = require("../utils/mailer");

router.post("/book-appointment", async (req, res) => {
  console.log("DB URL:", process.env.DATABASE_URL);
  console.log("🔥 BOOK APPOINTMENT API HIT");

  let {
    phone,
    patient_name,
    email,
    gender,
    address
  } = req.body || {};

  // Normalize phone
  phone = (phone || "")
    .toString()
    .trim()
    .replace(/\D/g, "")
    .replace(/^91/, "");

  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Phone must be 10 digits"
    });
  }

  if (!patient_name) {
    return res.status(400).json({
      success: false,
      message: "Patient name is required"
    });
  }

  try {

    await pool.query(
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
        location_link,
        doctor_name,
        doctor_specialization,
        source
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      );
      `,
      [
        phone,
        patient_name,
        null,              // age
        email || null,
        null,              // date
        null,              // time_label
        null,              // time_value
        address || null,
        null,              // location_link
        null,              // doctor_name
        null,              // doctor_specialization
        "WEBSITE"
      ]
    );

    console.log("✅ Appointment saved");

    console.log("📨 Calling mail function...");

    await sendAppointmentMail({
      email,
      patient_name
    });

    return res.json({
      success: true,
      message: "Appointment request submitted successfully."
    });

  } catch (err) {

    console.error("Website booking error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to book appointment"
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

    res.json({
      success: true,
      data: result.rows.map(r => r.time_value)
    });

  } catch (err) {

    console.error("Slot fetch error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch booked slots"
    });

  }

});

module.exports = router;