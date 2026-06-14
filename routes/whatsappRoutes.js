const express = require('express');
const router = express.Router();

// 1. Single combined import from your controller
const { 
    verifyWebhook, 
    handleIncomingMessage, 
    getMessages, 
    sendManualMessage, 
    toggleAi 
} = require('../controllers/whatsappController');

const { authMiddleware, authorize } = require('../middleware/authMiddleware');
const Student = require('../models/student');

// --- WEBHOOK ROUTES (For Meta) ---
// GET request is for Meta to verify your server
router.get('/', verifyWebhook);

// POST request is for receiving the actual WhatsApp messages
router.post('/', handleIncomingMessage);

// --- DASHBOARD API ROUTES (For React) ---
// 1. Get all active leads
router.get('/leads', authMiddleware, authorize('founder', 'admin', 'frontoffice'), async (req, res) => {
    try {
        const leads = await Student.find({ 
            $or: [{ leadSource: 'WhatsApp' }, { isAiControlled: { $exists: true } }] 
        }).sort({ updatedAt: -1 });
        
        res.json({ success: true, leads });
    } catch (err) {
        console.error("Error fetching WhatsApp leads:", err);
        res.status(500).json({ success: false, message: "Failed to fetch leads" });
    }
});

// 2. Get chat history for a specific lead
router.get('/messages/:phone', authMiddleware, authorize('founder', 'admin', 'frontoffice'), getMessages);

// 3. Send a manual reply
router.post('/send', authMiddleware, authorize('founder', 'admin', 'frontoffice'), sendManualMessage);

// 4. Toggle AI Control
router.patch('/toggle-ai/:id', authMiddleware, authorize('founder', 'admin', 'frontoffice'), toggleAi);

module.exports = router;