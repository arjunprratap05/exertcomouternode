const express = require('express');
const router = express.Router();
const { handleAssistantRequest } = require('../controllers/assistantController');

// The frontend will hit this at: /api/assistant/chat
router.post('/chat', handleAssistantRequest);

module.exports = router;