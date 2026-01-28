// routes/registrationRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();

// MUST USE { handleRegistration } with curly braces
const { handleRegistration } = require('../controllers/registrationController');

// If line 6 looks like this, it will now work:
router.post('/submit', upload.single('studentImage'), handleRegistration);

module.exports = router;