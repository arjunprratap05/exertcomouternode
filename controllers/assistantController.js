const assistantService = require('../services/assistantService');

exports.handleAssistantRequest = async (req, res) => {
    try {
        const { type, message, agentId } = req.body;

        // 1. Handle AI Chatbot Logic
        if (type === 'chat') {
            const reply = await assistantService.getBotReply(message);
            return res.json({ success: true, reply });
        }

        // 2. Handle Secure WhatsApp Redirect (No numbers exposed)
        if (type === 'redirect') {
            const secureUrl = assistantService.generateSecureLink(agentId);
            return res.json({ success: true, url: secureUrl });
        }

        res.status(400).json({ success: false, message: "Invalid Request Type" });
    } catch (error) {
        res.status(500).json({ success: false, reply: "System busy. Call 7282983335." });
    }
};