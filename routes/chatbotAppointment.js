const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { sendAppointmentMail } = require('../utils/mailer');

router.post('/', async (req, res) => {
  console.log('🔥 CHATBOT APPOINTMENT API HIT');
  console.log('📦 Request body:', JSON.stringify(req.body));

  let { patient_name, phone, email, gender, address } = req.body || {};

  // Normalize phone – strip non-digits and leading country code 91
  phone = (phone || '').toString().trim().replace(/\D/g, '').replace(/^91/, '');

  // Required fields: patient_name + phone (10 digits) + gender
  if (!patient_name || !gender) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: Full Name and Gender are required.'
    });
  }

  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: 'Phone must be exactly 10 digits.'
    });
  }

  try {
    // ── 1. Save to database ──────────────────────────────────────────
    const result = await pool.query(
      `INSERT INTO appointments
       (phone, patient_name, email, address, source)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id;`,
      [
        phone,
        patient_name,
        email ? email.trim() : null,
        address || null,
        'CHATBOT'
      ]
    );

    const appointmentId = result.rows[0]?.id;
    console.log(`✅ Chatbot appointment saved — DB id: ${appointmentId}`);

    // ── 2. Send confirmation email (non-blocking, but logged) ────────
    sendAppointmentMail({
      email: email ? email.trim() : null,
      patient_name,
      gender,
      address: address || 'Not specified',
      phone
    })
      .then(() => {
        console.log(`📧 Email notification dispatched for appointment #${appointmentId}`);
      })
      .catch((err) => {
        console.error(`❌ Email failed for appointment #${appointmentId}:`, err.message);
      });

    // ── 3. Respond to client immediately ────────────────────────────
    return res.json({
      success: true,
      message: 'Appointment booked successfully!',
      appointment_id: appointmentId
    });

  } catch (err) {
    console.error('❌ Chatbot booking error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to book appointment. Please try again.'
    });
  }
});

module.exports = router;
