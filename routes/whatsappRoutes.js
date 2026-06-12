const express = require('express');
const router = express.Router();
const { verifyWebhook, handleIncomingMessage } = require('../controllers/whatsappController'); // Note: ensure this matches your controller file name exactly
const { authMiddleware, authorize } = require('../middleware/authMiddleware');
// GET request is for Meta to verify your server
router.get('/', verifyWebhook);

// POST request is for receiving the actual WhatsApp messages
router.post('/', handleIncomingMessage);

router.get('/whatsapp/leads', authorize('founder', 'admin', 'frontoffice'), async (req, res) => {
    try {
        const leads = await Student.find({ 
            $or: [{ leadSource: 'WhatsApp' }, { isAiControlled: { $exists: true } }] 
        }).sort({ updatedAt: -1 });
        res.json({ success: true, leads });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch leads" });
    }
});

module.exports = router;