const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const couponController = require('../controllers/couponController');
const { authMiddleware, authorize } = require('../middleware/authMiddleware');
const { getWhatsAppLeads,getWhatsAppChat,toggleAiControl,sendManualWhatsAppMessage} = require('../controllers/adminController');


router.post('/login', adminController.adminLogin);

router.get('/registrations', authMiddleware, adminController.getAllStudents);
router.patch('/registrations/:id/update-payment', authMiddleware, adminController.updateStudentPayment);

router.get('/enquiries', authMiddleware, adminController.getEnquiries);
router.patch('/enquiries/:id/status', authMiddleware, adminController.updateEnquiryStatus);

router.get('/audit-logs', authMiddleware, adminController.getAuditLogs);
router.get('/pending-students', authMiddleware, adminController.getPendingStudents);
router.patch('/approve-student/:id', authMiddleware, adminController.approveStudent);

router.post('/batches/create', authMiddleware, adminController.createBatch);
router.get(
    '/batches/active', 
    authMiddleware, 
    authorize('founder', 'accounts', 'frontoffice', 'student'), // Added 'student'
    adminController.getActiveBatches
);

router.delete('/batches/:id', authMiddleware, adminController.deleteBatch);

router.patch('/registrations/:id/grant-access', authMiddleware, adminController.grantPortalAccess);

router.post('/coupons', authMiddleware, authorize('founder', 'accounts'), couponController.createCoupon);
router.get('/coupons', authMiddleware, authorize('founder', 'accounts'), couponController.getAllCoupons);
router.delete('/coupons/:id', authMiddleware, authorize('founder'), couponController.deleteCoupon);

// Public Validation (For Checkout Form)

router.get('/coupons/history', authMiddleware, couponController.getCouponHistory);

router.post('/coupons/validate', couponController.validateCoupon);

router.patch('/registrations/:id/update-ledger', authMiddleware, adminController.updateLedger);

router.patch(
    '/registrations/:id/request-discount', 
    authMiddleware, 
    adminController.requestDiscount
);

// Route for Founder to finalize (Limited to Founder role only)
router.patch(
    '/registrations/:id/approve-discount', 
    authMiddleware, 
    authorize('founder'), 
    adminController.approveDiscount
);

router.patch('/approve-student/:id', authMiddleware, adminController.approveStudent);

router.patch(
    '/registrations/:id/authorize-batch', 
    authMiddleware, 
    authorize('founder', 'accounts', 'frontoffice'), 
    adminController.authorizeStudentBatch
);

router.get('/whatsapp-leads', getWhatsAppLeads);
router.get('/whatsapp-chat/:phone', getWhatsAppChat);
router.patch('/student/:id/ai-toggle', toggleAiControl);
router.post('/send-whatsapp', sendManualWhatsAppMessage);

router.post('/reports/dispatch-founder-report', adminController.dispatchFounderReport);

router.post('/chat', adminController.handleAdminChat);

module.exports = router;