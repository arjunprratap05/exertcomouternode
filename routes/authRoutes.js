const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// --- STARTUP DIAGNOSTICS ---
console.log("-----------------------------------------");
console.log("Checking Auth Route Handlers:");
Object.keys(authController).forEach(key => {
    console.log(`- ${key}: ${typeof authController[key] === 'function' ? 'OK' : 'MISSING'}`);
});
console.log("-----------------------------------------");

// Verify that functions exist before mounting to prevent TypeError
const safePost = (path, handler) => {
    if (typeof handler === 'function') {
        router.post(path, handler);
    } else {
        console.error(`CRITICAL: Route handler for ${path} is undefined! Check authController.js exports.`);
    }
};

// Defining Routes
safePost('/send-otp', authController.sendOTP);
safePost('/verify-otp', authController.verifyOTP);
safePost('/forgot-password-request', authController.forgotPasswordRequest);
safePost('/reset-password', authController.resetPasswordWithOTP);
router.post('/login', authController.studentLogin);
safePost('/reset-password', authController.resetPasswordWithOTP);
router.post('/logout', authController.studentLogout);

module.exports = router;