const assistantService = require('../services/assistantService');

// In-memory session store (For high-traffic production, use Redis)
const chatSessions = {};

exports.handleAssistantRequest = async (req, res) => {
    try {
        const { type, message, agentId, sessionId } = req.body;

        // Validation for sessionId (Essential for state tracking)
        if (!sessionId && type === 'chat') {
            return res.status(400).json({ success: false, reply: "Session ID required for AI sync." });
        }

        // 1. Handle AI Chatbot Logic
        if (type === 'chat') {
            // Initialize session if it doesn't exist
            if (!chatSessions[sessionId]) {
                chatSessions[sessionId] = {
                    collectingLead: false,
                    tempName: null,
                    tempEmail: null,
                    lastInteractedCourse: "General Inquiry"
                };
            }

            // Process message with the specific user's session data
            const reply = await assistantService.getBotReply(message, chatSessions[sessionId]);
            
            return res.json({ success: true, reply });
        }

        // 2. Handle Secure WhatsApp Redirect
        if (type === 'redirect') {
            const secureUrl = assistantService.generateSecureLink(agentId);
            return res.json({ success: true, url: secureUrl });
        }

        res.status(400).json({ success: false, message: "Invalid Request Type" });
    } catch (error) {
        console.error("ASSISTANT ERROR:", error);
        res.status(500).json({ success: false, reply: "Expert AI is syncing. Please call 7282983335 for immediate admission." });
    }
};