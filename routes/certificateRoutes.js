const express = require('express');
const router = express.Router();
const multer = require('multer');
const certificateController = require('../controllers/certificateController');
const { authMiddleware, authorize } = require('../middleware/authMiddleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const staffAccess = authorize('founder', 'admin', 'accounts', 'frontoffice');

// --- Student Actions ---
router.post('/student/request-certificate', authMiddleware, authorize('student'), certificateController.requestCertificate);
router.get('/student/certificate/download', authMiddleware, authorize('student'), certificateController.downloadCertificatePdf);

// --- Admin Verification & Upload ---
router.get('/admin/certificate-requests', authMiddleware, staffAccess, certificateController.getCertificateRequests);
router.post('/admin/certificates/upload/:studentId', authMiddleware, staffAccess, upload.single('certificatePdf'), certificateController.uploadCertificatePdf);

module.exports = router;