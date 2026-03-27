const express = require("express");
const router = express.Router();

const { pool, appointmentsCache } = require("../config/db");

/* ===============================
   GET ALL APPOINTMENTS (ADMIN)
================================ */
router.get("/appointments", async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT 
    a.id,
    a.patient_name,
    a.phone,
    a.age AS age,
    a.email,
    a.date,
    a.time_label,
    a.time_value,
    a.address,
    a.location_link,
    a.doctor_name,
    a.doctor_specialization,
    a.source,
    'Booked' AS status
  FROM appointments a
  LEFT JOIN users u ON u.phone = a.phone
  ORDER BY a.created_at DESC
`);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Admin appointments error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
    });
  }
});

/* ===============================
   ADD APPOINTMENT MANUALLY (ADMIN)
================================ */
router.post("/appointments", async (req, res) => {
  console.log("ADMIN DB URL:", process.env.DATABASE_URL);

  let {
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
  } = req.body || {};

  /* ===============================
     VALIDATIONS
  ================================ */

  // normalize phone (remove spaces, country code, non-digits)
  phone = (phone || "")
    .toString()
    .trim()
    .replace(/\D/g, "")
    .replace(/^91/, "");

  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Phone number must be exactly 10 digits",
    });
  }

  if (!patient_name || !/^[a-zA-Z\s]+$/.test(patient_name)) {
    return res.status(400).json({
      success: false,
      message: "Patient name must contain only letters and spaces",
    });
  }

  if (age !== undefined && age !== null && age !== "") {
    age = Number(age);
    if (Number.isNaN(age) || age < 1 || age > 110) {
      return res.status(400).json({
        success: false,
        message: "Age must be between 1 and 110",
      });
    }
  } else {
    age = null;
  }

  if (!date || !time_value || !doctor_name) {
    return res.status(400).json({
      success: false,
      message: "Missing required appointment fields",
    });
  }

  try {
    /* ===============================
       SAVE / UPDATE USER (AGE FIX ✅)
    ================================ */
    if (age !== null) {
      await pool.query(
        `
        INSERT INTO users (phone, name, age)
        VALUES ($1, $2, $3)
        ON CONFLICT (phone)
        DO UPDATE SET
          name = EXCLUDED.name,
          age = EXCLUDED.age
        `,
        [phone, patient_name, age]
      );
    }

    /* ===============================
       SAVE APPOINTMENT
    ================================ */
    const result = await pool.query(
      `
      INSERT INTO appointments (
        phone,
        patient_name,
        email,
        date,
        time_label,
        time_value,
        address,
        location_link,
        doctor_name,
        doctor_specialization
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
      `,
      [
        phone,
        patient_name,
        email,
        date,
        time_label || time_value,
        time_value,
        address || null,
        location_link || null,
        doctor_name,
        doctor_specialization || null,
      ]
    );

    /* ===============================
       KEEP CACHE IN SYNC
    ================================ */
    appointmentsCache.push({
      phone,
      patient_name,
      date,
      time_label: time_label || time_value,
      time_value,
    });

    return res.json({
      success: true,
      id: result.rows[0].id,
    });
  } catch (err) {
    console.error("Admin appointment insert error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add appointment",
    });
  }
});

/* ===============================
   GET PAYMENT REQUESTS (ADMIN)
================================ */
router.get("/payments", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        appointment_id,
        email,
        doctor_name,
        patient_name,
        patient_phone,
        amount,
        status,
        payment_link,
        created_at
      FROM payment_requests
      ORDER BY created_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Admin payments error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment requests",
    });
  }
});

/* ===============================
   CREATE PAYMENT REQUEST (ADMIN)
================================ */
router.post("/payments", async (req, res) => {
  const {
    appointment_id,
    doctor_name,
    patient_name,
    email,
    patient_phone,
    amount,
    payment_link,
    status,
  } = req.body || {};

  if (!patient_phone || !amount) {
    return res.status(400).json({
      success: false,
      message: "patient_phone and amount are required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO payment_requests (
        appointment_id,
        doctor_name,
        patient_name,
        email,
        patient_phone,
        amount,
        payment_link,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id`,
      [
        appointment_id || null,
        doctor_name || null,
        patient_name || null,
        patient_phone,
        amount,
        payment_link || null,
        status || "PENDING",
      ]
    );

    res.json({
      success: true,
      id: result.rows[0].id,
    });
  } catch (err) {
    console.error("Failed to create payment request:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to create payment request",
    });
  }
});

module.exports = router;