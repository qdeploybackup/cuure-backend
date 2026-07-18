const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const appointmentService = require('../services/appointmentService');

router.post('/', async (req, res) => {
  try {
    const { messages, conversationState = {} } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Valid messages array is required' });
    }

    // Call Gemini to get response
    const { text, questionType, options, showBookingButton } = await geminiService.generateResponse(messages, conversationState);
    
    // Check if we need to show booking button
    const bookingDetails = showBookingButton ? appointmentService.getBookingLink() : null;

    res.json({
      text,
      questionType,
      options,
      showBookingButton,
      bookingDetails
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

module.exports = router;
