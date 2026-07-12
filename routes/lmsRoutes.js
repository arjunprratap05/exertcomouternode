const express = require('express');
const router = express.Router();
const multer = require('multer');
const lmsController = require('../controllers/lmsController');
const { authMiddleware, authorize } = require('../middleware/authMiddleware');


// 1. INITIALIZE VARIABLES FIRST
const staffAccess = authorize('founder', 'accounts', 'frontoffice');
const adminAccess = authorize('founder', 'frontoffice', 'accounts');

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 } 
});

// 2. DEFINE ROUTES (Using functional wrappers to ensure Express loads them correctly)

// --- ADMIN ROUTES ---
router.post('/add-lecture', authMiddleware, staffAccess, (req, res, next) => lmsController.addLecture(req, res, next));
router.post('/add-material', authMiddleware, adminAccess, upload.single('file'), (req, res, next) => lmsController.addMaterial(req, res, next));
router.get('/lectures', authMiddleware, staffAccess, (req, res, next) => lmsController.getAllLectures(req, res, next));
router.delete('/delete-lecture/:id', authMiddleware, staffAccess, (req, res, next) => lmsController.deleteLecture(req, res, next));
router.get('/materials', authMiddleware, staffAccess, (req, res, next) => lmsController.getAllMaterials(req, res, next));
router.delete('/delete-material/:id', authMiddleware, staffAccess, (req, res, next) => lmsController.deleteMaterial(req, res, next));
router.post('/chat', lmsController.handleStudentChat);

// --- STUDENT ROUTES ---
router.get('/download/:id', 
    (req, res, next) => authMiddleware(req, res, next), 
    (req, res, next) => lmsController.downloadMaterial(req, res, next)
);

router.post('/sync-multi', authMiddleware, (req, res, next) => lmsController.syncMultiBatchLMS(req, res, next));
router.get('/add-lecture', authMiddleware, (req, res, next) => lmsController.getAllLectures(req, res, next));

module.exports = router;