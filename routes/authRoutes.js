const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST: /api/auth/send-otp
router.post('/send-otp', authController.sendOTP);

// POST: /api/auth/verify-otp
router.post('/verify-otp', authController.verifyOTP);

module.exports = router;