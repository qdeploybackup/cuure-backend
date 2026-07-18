const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { patient_name, phone, email, age, date, time_value, doctor_name, address } = req.body;
    
    // Validate required fields
    if (!patient_name || !phone || !date || !time_value || !doctor_name) {
      return res.status(400).json({ error: 'Missing required booking fields' });
    }

    // Validate phone (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Insert booking into database (align with DB columns)
    await pool.query(
      `INSERT INTO appointments 
      (phone, patient_name, age, email, date, time_label, time_value, address, doctor_name, doctor_specialization, source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);`,
      [
        phone,
        patient_name,
        age || null,
        email || null,
        date,
        time_value, // using same value for time_label
        time_value,
        address,
        doctor_name,
        null,
        "CHATBOT"
      ]
    );

    res.json({
      success: true,
      message: 'Appointment booked successfully',
      bookingId: 'BKG-' + Math.floor(Math.random() * 1000000)
    });
  } catch (error) {
    console.error('Booking API Error:', error);
    res.status(500).json({ error: 'Failed to process booking request' });
  }
});

module.exports = router;
