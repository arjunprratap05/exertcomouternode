const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware'); // Fixed Destructuring

// Student Routes
router.post('/login', authController.studentLogin);
router.post('/logout', authController.studentLogout);
router.get('/my-profile', authMiddleware, authController.getStudentProfile);

// OTP & Password Routes
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/forgot-password-request', authController.forgotPasswordRequest);
router.post('/reset-password', authController.resetPasswordWithOTP);

module.exports = router;