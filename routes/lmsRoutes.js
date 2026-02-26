const express = require('express');
const router = express.Router();
const multer = require('multer');
const lmsController = require('../controllers/lmsController');
const { authMiddleware, authorize } = require('../middleware/authMiddleware');

// Setup Multer for Memory Storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 } // 16MB MongoDB Limit
});

// Roles allowed to manage LMS
const staffAccess = authorize('founder', 'accounts', 'frontoffice');

// Lecture Route
router.post('/add-lecture', authMiddleware, staffAccess, lmsController.addLecture);

// Material Route (Uses upload.single middleware)
router.post('/add-material', authMiddleware, staffAccess, upload.single('file'), lmsController.addMaterial);

// Student Sync Route
router.get('/sync/:courseId', authMiddleware, lmsController.getCourseContent);

// Add this below your sync route
router.get('/download/:id', authMiddleware, lmsController.downloadMaterial);

router.get('/lectures', 
    authMiddleware, 
    authorize('founder', 'accounts', 'frontoffice'), 
    lmsController.getAllLectures
);

router.delete('/delete-lecture/:id', 
    authMiddleware, 
    authorize('founder', 'accounts', 'frontoffice'), 
    lmsController.deleteLecture
);

module.exports = router;