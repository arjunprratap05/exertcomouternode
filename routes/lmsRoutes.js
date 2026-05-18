const express = require('express');
const router = express.Router();
const multer = require('multer');
const lmsController = require('../controllers/lmsController');
const { authMiddleware, authorize } = require('../middleware/authMiddleware');

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 } 
});

const staffAccess = authorize('founder', 'accounts', 'frontoffice');

// --- ADMIN ROUTES ---
router.post('/add-lecture', authMiddleware, staffAccess, lmsController.addLecture);
router.post(
    '/add-material', 
    authMiddleware, 
    authorize('founder', 'frontoffice', 'accounts'), // Ensure 'founder' is here!
    upload.single('file'), 
    lmsController.addMaterial
);
router.get('/lectures', authMiddleware, staffAccess, lmsController.getAllLectures);
router.delete('/delete-lecture/:id', authMiddleware, staffAccess, lmsController.deleteLecture);

// NEW: Missing routes to support Admin Directory
router.get('/materials', authMiddleware, staffAccess, lmsController.getAllMaterials);
router.delete('/delete-material/:id', authMiddleware, staffAccess, lmsController.deleteMaterial);

// --- STUDENT ROUTES ---
router.get('/download/:id', authMiddleware, lmsController.downloadMaterial);
router.post('/sync-multi', authMiddleware, lmsController.syncMultiBatchLMS);

router.get('/add-lecture', authMiddleware, lmsController.getAllLectures);

module.exports = router;