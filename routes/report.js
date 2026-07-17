const express = require('express');
const router = express.Router();
const { uploadReport } = require('../controllers/reportController');

router.post('/', uploadReport);

module.exports = router;
