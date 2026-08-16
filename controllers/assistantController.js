const assistantService = require('../services/assistantService');
const Inquiry = require('../models/Inquiry'); // Your Mongo Model
const { sendInquiryEmail } = require('../services/mailService'); // Your Mail Service

const chatSessions = {};

exports.handleAssistantRequest = async (req, res) => {
    try {
        const { type, message, agentId, sessionId } = req.body;

        if (!sessionId && type === 'chat') {
            return res.status(400).json({ success: false, reply: "Session ID required." });
        }

        if (type === 'chat') {
            // Initialize Session
            if (!chatSessions[sessionId]) {
                chatSessions[sessionId] = {
                    history: [],
                    leadData: { name: null, contact: null, course: null },
                    isLeadSaved: false
                };
            }

            const session = chatSessions[sessionId];

            // 1. Get AI Response and Extracted Data
            const botResponse = await assistantService.getBotReply(message, session);
            
            // Safety Check in case LLM fails to return proper JSON structure
            if (!botResponse || !botResponse.reply) {
                return res.json({ 
                    success: true, 
                    reply: "I'm having a little trouble connecting right now. Please call us at 7282983335!" 
                });
            }

            // 2. Silently update session with new extracted data
            if (botResponse.extracted) {
                if (botResponse.extracted.name) session.leadData.name = botResponse.extracted.name;
                if (botResponse.extracted.contact) session.leadData.contact = botResponse.extracted.contact;
                if (botResponse.extracted.course) session.leadData.course = botResponse.extracted.course;
            }

            // 3. --- SILENT LEAD SAVING TO MONGODB ---
            if (session.leadData.name && session.leadData.contact && !session.leadData.isLeadSaved) {
                
                // Parse contact to determine if it is an email or a phone number
                let phone = "Not Provided";
                let email = "Not Provided";
                
                if (session.leadData.contact.includes("@")) {
                    email = session.leadData.contact.toLowerCase().trim();
                } else {
                    phone = session.leadData.contact.replace(/\D/g, ''); // Strip non-numeric chars
                }

                // SMART DUPLICATE CHECK (Matches manual form logic)
                const duplicateQuery = [];
                if (phone !== "Not Provided") duplicateQuery.push({ phone: phone });
                if (email !== "Not Provided") duplicateQuery.push({ email: email });

                const existingInquiry = duplicateQuery.length > 0 
                    ? await Inquiry.findOne({ $or: duplicateQuery }) 
                    : null;

                if (!existingInquiry) {
                    // Create and save the new lead
                    const newInquiry = new Inquiry({
                        name: session.leadData.name,
                        email: email,
                        phone: phone,
                        course: session.leadData.course || "General Inquiry",
                        message: "Lead captured automatically via AI Assistant.",
                        source: "AI Chatbot" // Flags where the lead came from in Admin Panel
                    });
                    
                    await newInquiry.save();
                    console.log("🔥 NEW AI LEAD SAVED TO MONGODB:", session.leadData.name);

                    // Trigger your existing mail notification
                    try {
                        await sendInquiryEmail(newInquiry);
                    } catch (mailErr) {
                        console.warn("Mail failed for AI Lead, but lead saved securely.");
                    }
                } else {
                    console.log("⚠️ AI Lead skipped - Duplicate found in DB.");
                }
                
                // Lock the session so we don't save the same person twice in one chat
                session.leadData.isLeadSaved = true; 
            }
            
            // 4. Update Conversation History
            session.history.push({ role: 'user', content: message });
            session.history.push({ role: 'assistant', content: botResponse.reply });

            if (session.history.length > 10) session.history = session.history.slice(-10);

            // 5. Send only the conversational text back to the React widget
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