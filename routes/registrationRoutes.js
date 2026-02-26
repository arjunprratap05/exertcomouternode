const express = require('express');
const router = express.Router();
const multer = require('multer');
const { handleRegistration } = require('../controllers/registrationController');

// Use Memory Storage instead of Disk Storage
const storage = multer.memoryStorage();

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Optional: Limit size to 5MB
});

// The flow remains the same, but req.file will now contain a buffer
router.post('/submit', upload.single('studentImage'), handleRegistration);

module.exports = router;