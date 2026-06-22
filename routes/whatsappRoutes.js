const express = require('express');
const router = express.Router();

const { 
    verifyWebhook, 
    handleIncomingMessage, 
    getMessages, 
    sendManualMessage, 
    toggleAi 
} = require('../controllers/whatsappController');

const { authMiddleware, authorize } = require('../middleware/authMiddleware');


// --- WEBHOOK ROUTES (For Meta) ---
router.get('/', verifyWebhook);
router.post('/', handleIncomingMessage);

// --- DASHBOARD API ROUTES (For React) ---
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

router.get('/messages/:phone', authMiddleware, authorize('founder', 'admin', 'frontoffice'), getMessages);
router.post('/send', authMiddleware, authorize('founder', 'admin', 'frontoffice'), sendManualMessage);
router.patch('/toggle-ai/:id', authMiddleware, authorize('founder', 'admin', 'frontoffice'), toggleAi);

module.exports = router;