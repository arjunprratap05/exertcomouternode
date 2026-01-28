const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistantController');

// Single endpoint to handle both AI chat and secure redirects
router.post('/process', assistantController.handleAssistantRequest);

module.exports = router;