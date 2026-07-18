const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, consultationType, preferredDate, preferredTime, reason } = req.body;
    
    // Validate required fields
    if (!name || !phone || !consultationType || !preferredDate || !preferredTime || !reason) {
      return res.status(400).json({ error: 'Missing required booking fields' });
    }

    // In a real application, you would save this to a database here
    console.log('New Appointment Booking received:', req.body);

    // Simulate booking process delay
    await new Promise(resolve => setTimeout(resolve, 1000));

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
