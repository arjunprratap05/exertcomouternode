const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const couponController = require('../controllers/couponController');
const { authMiddleware, authorize } = require('../middleware/authMiddleware');
const { getWhatsAppLeads,getWhatsAppChat,toggleAiControl,sendManualWhatsAppMessage} = require('../controllers/adminController');
const { globalSearch } = require('../controllers/globalSearchController');
const { tracePersonWithRelatives } = require('../controllers/traceController');
const { getDirectWhatsAppChats } = require('../controllers/whatsappController');
const Instructor = require('../models/Instructor');

router.get('/global-search', globalSearch);
router.get('/trace/:phone', tracePersonWithRelatives);
router.get('/whatsapp/direct-chats', getDirectWhatsAppChats);

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

router.get('/instructors', async (req, res) => {
    try {
        const instructors = await Instructor.find().sort({ createdAt: -1 });
        res.status(200).json(instructors);
    } catch (error) {
        console.error("Error fetching instructors:", error);
        res.status(500).json({ success: false, message: "Failed to fetch instructors" });
    }
});

// 2. Add a new instructor
router.post('/instructors', async (req, res) => {
    try {
        const { name, subject, phone, totalHours, activeBatches, status } = req.body;
        
        const newInstructor = new Instructor({
            name,
            subject,
            phone,
            totalHours: totalHours || 0,
            activeBatches: activeBatches || 0,
            status: status || 'Active'
        });

        await newInstructor.save();
        res.status(201).json({ success: true, instructor: newInstructor });
    } catch (error) {
        console.error("Error adding instructor:", error);
        res.status(500).json({ success: false, message: "Failed to add instructor" });
    }
});

// 3. Update instructor status (Active <-> On Leave)
router.patch('/instructors/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedInstructor = await Instructor.findByIdAndUpdate(
            req.params.id, 
            { status }, 
            { new: true }
        );
        
        if (!updatedInstructor) {
            return res.status(404).json({ success: false, message: "Instructor not found" });
        }
        
        res.status(200).json({ success: true, instructor: updatedInstructor });
    } catch (error) {
        console.error("Error updating instructor:", error);
        res.status(500).json({ success: false, message: "Failed to update status" });
    }
});

module.exports = router;