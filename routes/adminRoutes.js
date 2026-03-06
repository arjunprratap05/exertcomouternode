const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/login', adminController.adminLogin);

router.get('/registrations', authMiddleware, adminController.getAllStudents);
router.patch('/registrations/:id/update-payment', authMiddleware, adminController.updateStudentPayment);

router.get('/enquiries', authMiddleware, adminController.getEnquiries);
router.patch('/enquiries/:id/status', authMiddleware, adminController.updateEnquiryStatus);

router.get('/audit-logs', authMiddleware, adminController.getAuditLogs);
router.get('/pending-students', authMiddleware, adminController.getPendingStudents);
router.patch('/approve-student/:id', authMiddleware, adminController.approveStudent);

router.post('/batches/create', authMiddleware, adminController.createBatch);
router.get('/batches/active', authMiddleware, adminController.getActiveBatches);

router.delete('/batches/:id', authMiddleware, adminController.deleteBatch);

router.patch('/registrations/:id/grant-access', authMiddleware, adminController.grantPortalAccess);

module.exports = router;