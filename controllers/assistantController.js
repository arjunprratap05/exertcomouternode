const assistantService = require('../services/assistantService');
const Inquiry = require('../models/Inquiry');
const ChatSession = require('../models/ChatSession');
const { sendInquiryEmail } = require('../services/mailService');

exports.handleAssistantRequest = async (req, res) => {
    try {
        const { type, message, agentId, sessionId } = req.body;

        if (!sessionId && type === 'chat') {
            return res.status(400).json({ success: false, reply: "Session ID required." });
        }

        if (type === 'chat') {
            let session = await ChatSession.findOne({ sessionId });
            if (!session) {
                session = await ChatSession.create({
                    sessionId,
                    history: [],
                    leadData: { name: null, contact: null, course: null },
                    isLeadSaved: false
                });
            }

            const botResponse = await assistantService.getBotReply(message, session);
            
            if (!botResponse || !botResponse.reply) {
                return res.json({ 
                    success: true, 
                    reply: "I'm having a little trouble connecting right now. Please call us at 7282983335!" 
                });
            }

            if (botResponse.extracted) {
                if (botResponse.extracted.name) session.leadData.name = botResponse.extracted.name;
                if (botResponse.extracted.contact) session.leadData.contact = botResponse.extracted.contact;
                if (botResponse.extracted.course) session.leadData.course = botResponse.extracted.course;
            }

            // --- SILENT LEAD SAVING TO MONGODB ---
            if (session.leadData.name && session.leadData.contact && !session.leadData.isLeadSaved) {
                let phone = "Not Provided";
                let email = "Not Provided";
                
                if (session.leadData.contact.includes("@")) {
                    email = session.leadData.contact.toLowerCase().trim();
                } else {
                    phone = session.leadData.contact.replace(/\D/g, '');
                }

                const duplicateQuery = [];
                if (phone !== "Not Provided") duplicateQuery.push({ phone: phone });
                if (email !== "Not Provided") duplicateQuery.push({ email: email });

                const existingInquiry = duplicateQuery.length > 0 
                    ? await Inquiry.findOne({ $or: duplicateQuery }) 
                    : null;

                if (!existingInquiry) {
                    const newInquiry = new Inquiry({
                        name: session.leadData.name,
                        email: email,
                        phone: phone,
                        course: session.leadData.course || "General Inquiry",
                        message: "Lead captured automatically via AI Assistant.",
                        source: "AI Chatbot"
                    });
                    
                    await newInquiry.save();
                    console.log("🔥 NEW AI LEAD SAVED TO MONGODB:", session.leadData.name);

                    try {
                        await sendInquiryEmail(newInquiry);
                    } catch (mailErr) {
                        console.warn("Mail failed for AI Lead, but lead saved securely.");
                    }
                }
                session.leadData.isLeadSaved = true; 
            }
            
            session.history.push({ role: 'user', content: message });
            session.history.push({ role: 'assistant', content: botResponse.reply });

            if (session.history.length > 10) {
                session.history = session.history.slice(-10);
            }

            await session.save();
            return res.json({ success: true, reply: botResponse.reply });
        }

        if (type === 'redirect') {
            const secureUrl = assistantService.generateSecureLink(agentId);
            return res.json({ success: true, url: secureUrl });
        }

    } catch (error) {
        console.error("ASSISTANT ERROR:", error);
        res.status(500).json({ 
            success: false, 
            reply: "Expert AI is syncing. Please call 7282983335 for immediate assistance." 
        });
    }
};