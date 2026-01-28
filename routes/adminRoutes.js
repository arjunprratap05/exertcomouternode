const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/login', adminController.adminLogin);

// Registration Collection
router.get('/registrations', authMiddleware, adminController.getAllStudents);
router.patch('/registrations/:id/update-payment', authMiddleware, adminController.updateStudentPayment);

// Inquiry Collection
router.get('/enquiries', authMiddleware, adminController.getEnquiries);
// FIX: Changed to /:id/status to resolve the 404 error
router.patch('/enquiries/:id/status', authMiddleware, adminController.updateEnquiryStatus);

// Audit Collection
router.get('/audit-logs', authMiddleware, adminController.getAuditLogs);

module.exports = router;